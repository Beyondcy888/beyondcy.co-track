-- =====================================================================
-- BEYONDCY TRACKER - UPDATE v3
-- Run ONCE in Supabase: SQL Editor -> New query -> paste all -> Run.
-- Requires 01-03 and 04_update_v2.sql to have run already.
--
-- What this adds (nothing existing is removed or changed):
--   1. Profile photos (column on profiles + private 'avatars' bucket)
--   2. "people" view: every signed-in user can see every person's
--      display name and photo - but NOT their email
--   3. Projects: name, description, deadline, assigned staff,
--      open / done (Admin and assigned staff can mark done)
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. PROFILE PHOTOS
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists avatar_path       text,          -- '<profile_id>/<file>.webp' in bucket 'avatars'
  add column if not exists avatar_updated_at timestamptz;

-- Set or remove a photo. Each person may change their own; Admin may change anyone's.
-- p_path = null removes the photo (the app deletes the file itself).
create or replace function public.set_profile_avatar(p_profile_id uuid, p_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or (auth.uid() <> p_profile_id and not public.is_admin()) then
    raise exception 'You can only change your own photo.';
  end if;
  if p_path is not null and split_part(p_path, '/', 1) <> p_profile_id::text then
    raise exception 'The photo must be stored in that person''s folder.';
  end if;
  update public.profiles
     set avatar_path = nullif(btrim(p_path), ''),
         avatar_updated_at = now(),
         updated_at = now()
   where id = p_profile_id;
  if not found then
    raise exception 'Person not found.';
  end if;
end $$;

revoke execute on function public.set_profile_avatar(uuid, text) from public, anon;
grant  execute on function public.set_profile_avatar(uuid, text) to authenticated;

-- private bucket: max 2 MB, JPG / PNG / WebP (the app uploads a 512x512 WebP)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- every signed-in user may view photos; only the owner or Admin may add/replace/delete
create policy "avatars: read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
create policy "avatars: upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars'
              and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "avatars: replace" on storage.objects for update to authenticated
  using (bucket_id = 'avatars'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()))
  with check (bucket_id = 'avatars'
              and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "avatars: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));


-- ---------------------------------------------------------------------
-- 2. PEOPLE: names + photos for everyone signed in (no emails)
-- ---------------------------------------------------------------------
-- Runs with the owner's rights on purpose, so it can show people from other
-- trackers (needed for projects). It exposes ONLY these columns.
create or replace view public.people as
  select p.id, p.display_name, p.avatar_path, p.avatar_updated_at,
         p.role_id, r.name as role_name, coalesce(r.is_admin, false) as is_admin, p.is_active
  from public.profiles p
  left join public.roles r on r.id = p.role_id;

revoke all on public.people from public, anon;
grant select on public.people to authenticated;


-- ---------------------------------------------------------------------
-- 3. PROJECTS
-- ---------------------------------------------------------------------
create type public.project_status as enum ('open', 'done');

create table public.projects (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (length(btrim(name)) between 1 and 200),
  description       text check (description is null or length(description) <= 10000),
  due_date          date not null,                                  -- the deadline
  status            public.project_status not null default 'open',
  completed_at      timestamptz,
  completed_by      uuid references public.profiles(id),
  completed_by_name text,
  created_by        uuid references public.profiles(id) default auth.uid(),
  created_by_name   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  updated_by        uuid references public.profiles(id),
  updated_by_name   text
);
create index projects_due_idx on public.projects (due_date);

create table public.project_assignees (
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  added_at   timestamptz not null default now(),
  primary key (project_id, profile_id)
);
create index project_assignees_profile_idx on public.project_assignees (profile_id);

-- is the signed-in person assigned to this project?
create or replace function public.is_project_member(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_assignees a
                 where a.project_id = p_project_id and a.profile_id = auth.uid())
$$;

-- housekeeping + "staff may only mark done / not done"
create or replace function public.projects_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_admin boolean := public.is_admin();
begin
  new.name        := btrim(new.name);
  new.description := nullif(btrim(new.description), '');

  if tg_op = 'INSERT' then
    new.created_by      := coalesce(auth.uid(), new.created_by);
    new.created_by_name := coalesce(public.my_display_name(), new.created_by_name);
    new.created_at      := now();
  else
    new.id              := old.id;
    new.created_by      := old.created_by;
    new.created_by_name := old.created_by_name;
    new.created_at      := old.created_at;
    if not v_admin and auth.uid() is not null then
      -- assigned staff: everything except the status stays as it was
      new.name        := old.name;
      new.description := old.description;
      new.due_date    := old.due_date;
    end if;
  end if;

  if tg_op = 'INSERT' or new.status is distinct from old.status then
    if new.status = 'done' then
      new.completed_at      := now();
      new.completed_by      := auth.uid();
      new.completed_by_name := public.my_display_name();
    else
      new.completed_at := null; new.completed_by := null; new.completed_by_name := null;
    end if;
  else
    new.completed_at := old.completed_at; new.completed_by := old.completed_by;
    new.completed_by_name := old.completed_by_name;
  end if;

  new.updated_at      := now();
  new.updated_by      := coalesce(auth.uid(), new.updated_by);
  new.updated_by_name := coalesce(public.my_display_name(), new.updated_by_name);
  return new;
end $$;

create trigger projects_before_write
  before insert or update on public.projects
  for each row execute function public.projects_before_write();

-- only active staff (not Admin, must have a tracker) can be assigned
create or replace function public.project_assignees_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles p join public.roles r on r.id = p.role_id
                 where p.id = new.profile_id and p.is_active and not r.is_admin) then
    raise exception 'Only active staff members can be assigned to a project.';
  end if;
  new.added_at := now();
  return new;
end $$;

create trigger project_assignees_before_insert
  before insert on public.project_assignees
  for each row execute function public.project_assignees_before_insert();

-- history (stored in activity_log under role_id 'projects'; visible to Admin)
create or replace function public.log_project_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_changes jsonb := '{}'::jsonb;
  f text;
begin
  if tg_op = 'INSERT' then
    insert into public.activity_log (role_id, actor_id, actor_name, action, summary, changes)
    values ('projects', auth.uid(), public.my_display_name(), 'project_created', new.name,
            jsonb_build_object('project_id', new.id, 'due_date', new.due_date));
    return new;
  elsif tg_op = 'UPDATE' then
    foreach f in array array['name','description','due_date','status'] loop
      if to_jsonb(old) -> f is distinct from to_jsonb(new) -> f then
        v_changes := v_changes || jsonb_build_object(f, jsonb_build_object('old', to_jsonb(old) -> f, 'new', to_jsonb(new) -> f));
      end if;
    end loop;
    if v_changes <> '{}'::jsonb then
      insert into public.activity_log (role_id, actor_id, actor_name, action, summary, changes)
      values ('projects', auth.uid(), public.my_display_name(),
              case when old.status is distinct from new.status
                   then (case when new.status = 'done' then 'project_completed' else 'project_reopened' end)
                   else 'project_updated' end,
              new.name, v_changes || jsonb_build_object('project_id', new.id));
    end if;
    return new;
  else
    insert into public.activity_log (role_id, actor_id, actor_name, action, summary, changes)
    values ('projects', auth.uid(), public.my_display_name(), 'project_deleted', old.name,
            jsonb_build_object('deleted_row', to_jsonb(old)));
    return old;
  end if;
end $$;

create trigger projects_log
  after insert or update or delete on public.projects
  for each row execute function public.log_project_change();

-- security rules
alter table public.projects          enable row level security;
alter table public.project_assignees enable row level security;

create policy "read projects" on public.projects for select to authenticated
  using (public.is_admin() or public.is_project_member(id));
create policy "admin creates projects" on public.projects for insert to authenticated
  with check (public.is_admin());
create policy "edit projects" on public.projects for update to authenticated
  using (public.is_admin() or public.is_project_member(id))
  with check (public.is_admin() or public.is_project_member(id));
create policy "admin deletes projects" on public.projects for delete to authenticated
  using (public.is_admin());

create policy "read assignees" on public.project_assignees for select to authenticated
  using (public.is_admin() or public.is_project_member(project_id));
create policy "admin assigns" on public.project_assignees for insert to authenticated
  with check (public.is_admin());
create policy "admin unassigns" on public.project_assignees for delete to authenticated
  using (public.is_admin());

revoke all on public.projects, public.project_assignees from anon;

alter publication supabase_realtime add table public.projects, public.project_assignees;

commit;

-- Check: should list avatar_path, people, projects, project_assignees and the bucket.
select 'column: avatar_path' as created from information_schema.columns
 where table_schema = 'public' and table_name = 'profiles' and column_name = 'avatar_path'
union all select 'view: people'  from information_schema.views  where table_schema = 'public' and table_name = 'people'
union all select 'table: ' || table_name from information_schema.tables
 where table_schema = 'public' and table_name in ('projects', 'project_assignees')
union all select 'bucket: ' || id from storage.buckets where id = 'avatars';
