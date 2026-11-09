-- =====================================================================
-- BEYONDCY TRACKER - UPDATE v2
-- Run ONCE in Supabase: SQL Editor -> New query -> paste all -> Run.
-- Requires 01_schema.sql, 02_seed.sql and 03_assign_users.sql to have run.
--
-- What this changes:
--   1. PIC on every content item (whose target it counts toward)
--   2. Targets: per person x brand x month, split into Reels + Feed,
--      plus an admin "Status & notes" text. REPLACES monthly_targets
--      (old targets are deleted - re-enter them on the new Targets page).
--   3. Tracker banners (table + private storage bucket)
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. PIC (person in charge) on content items
-- ---------------------------------------------------------------------
alter table public.content_items
  add column if not exists pic_id uuid references public.profiles(id);
create index if not exists content_items_pic_idx on public.content_items (pic_id);

-- the only active member of a tracker, or null when there are several (Behomy)
create or replace function public.role_single_member(p_role_id text)
returns uuid language sql stable security definer set search_path = public as $$
  select case when count(*) = 1 then (array_agg(p.id))[1] end
  from public.profiles p
  where p.role_id = p_role_id and p.is_active
$$;

-- fill PIC on existing items without touching their history or "last edited"
alter table public.content_items disable trigger content_items_before_write;
alter table public.content_items disable trigger content_items_log;

update public.content_items ci
set pic_id = ci.owner_id
from public.profiles p
left join public.roles r on r.id = p.role_id
where p.id = ci.owner_id
  and ci.pic_id is null
  and coalesce(r.is_admin, false) = false;

update public.content_items ci
set pic_id = public.role_single_member(ci.role_id)
where ci.pic_id is null;
-- anything still without a PIC (Admin-created Behomy items) shows
-- "Needs a PIC" in the app until Admin picks one.

alter table public.content_items enable trigger content_items_before_write;
alter table public.content_items enable trigger content_items_log;

-- status rules + link lock (unchanged) + PIC rules (new)
create or replace function public.content_items_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_missing     text[] := '{}';
  v_has_pillars boolean;
  v_unknown     text[];
  v_is_admin    boolean := public.is_admin();
begin
  -- fields the app may never change
  if tg_op = 'INSERT' then
    new.owner_id   := coalesce(auth.uid(), new.owner_id);
    new.created_at := now();
  else
    new.id         := old.id;
    new.owner_id   := old.owner_id;
    new.role_id    := old.role_id;
    new.created_at := old.created_at;
  end if;

  -- outside your tracker: say so plainly (row level security also blocks it)
  if auth.uid() is not null and not public.can_access_role(new.role_id) then
    raise exception 'You don''t have access to this tracker.';
  end if;

  -- PIC: staff = themselves; Admin = the tracker's only person, or chosen (Behomy)
  if tg_op = 'INSERT' then
    if v_is_admin then
      new.pic_id := coalesce(new.pic_id, public.role_single_member(new.role_id));
      if new.pic_id is null then
        raise exception 'Choose the PIC for this content.';
      end if;
    elsif auth.uid() is not null then
      new.pic_id := auth.uid();
    else
      new.pic_id := coalesce(new.pic_id, new.owner_id);   -- SQL editor / migrations
    end if;
  else
    if not v_is_admin and auth.uid() is not null then
      new.pic_id := old.pic_id;                         -- only Admin can change the PIC
    elsif v_is_admin and new.pic_id is null and old.pic_id is not null then
      raise exception 'Choose the PIC for this content.';
    end if;
  end if;

  if new.pic_id is not null
     and (tg_op = 'INSERT' or new.pic_id is distinct from old.pic_id)
     and not exists (select 1 from public.profiles p
                     where p.id = new.pic_id and p.role_id = new.role_id and p.is_active) then
    raise exception 'The PIC must be an active member of this tracker.';
  end if;

  -- the brand must belong to this tracker
  if not exists (select 1 from public.role_brands rb
                 where rb.role_id = new.role_id and rb.brand_id = new.brand_id) then
    raise exception 'Brand "%" is not part of this tracker.', new.brand_id;
  end if;

  -- treat blank text as empty
  new.content       := nullif(btrim(new.content), '');
  new.brief         := nullif(btrim(new.brief), '');
  new.caption       := nullif(btrim(new.caption), '');
  new.notes         := nullif(btrim(new.notes), '');
  new.reference     := nullif(btrim(new.reference), '');
  new.instagram_url := nullif(btrim(new.instagram_url), '');

  if new.content      is null then v_missing := v_missing || 'content'::text;      end if;
  if new.type         is null then v_missing := v_missing || 'type'::text;         end if;
  if new.brief        is null then v_missing := v_missing || 'brief'::text;        end if;
  if new.caption      is null then v_missing := v_missing || 'caption'::text;      end if;
  if new.notes        is null then v_missing := v_missing || 'notes'::text;        end if;
  if new.publish_date is null then v_missing := v_missing || 'publish_date'::text; end if;
  if new.reference    is null then v_missing := v_missing || 'reference'::text;    end if;

  -- content pillars (only for brands that have pillars, i.e. Homy8)
  v_has_pillars := exists (select 1 from public.brand_pillars bp where bp.brand_id = new.brand_id);
  if v_has_pillars then
    select array_agg(p) into v_unknown
    from unnest(coalesce(new.content_pillars, '{}')) as p
    where p not in (select bp.name from public.brand_pillars bp where bp.brand_id = new.brand_id);
    if v_unknown is not null then
      raise exception 'Unknown content pillar(s): %', array_to_string(v_unknown, ', ');
    end if;
    new.content_pillars := array(
      select bp.name from public.brand_pillars bp
      where bp.brand_id = new.brand_id and bp.name = any(coalesce(new.content_pillars, '{}'))
      order by bp.sort_order);
    if cardinality(new.content_pillars) = 0 then
      v_missing := v_missing || 'content_pillars'::text;
    end if;
  else
    new.content_pillars := '{}';
  end if;

  new.missing_fields := v_missing;

  -- Instagram link: locked until everything else is filled
  if new.instagram_url is not null then
    if cardinality(v_missing) > 0 then
      if tg_op = 'UPDATE' and old.instagram_url is not null then
        raise exception 'This item is already uploaded, so every field must stay filled. Missing: %',
          array_to_string(v_missing, ', ');
      end if;
      raise exception 'Fill in every field before adding the Instagram link. Missing: %',
        array_to_string(v_missing, ', ');
    end if;
    if new.instagram_url !~* '^https?://([a-z0-9-]+\.)?instagram\.com/.+' then
      raise exception 'Uploaded content must be an Instagram post link, e.g. https://www.instagram.com/p/...';
    end if;
    new.status := 'uploaded';
    if tg_op = 'INSERT' or old.instagram_url is distinct from new.instagram_url then
      new.uploaded_at := now();
    end if;
  elsif cardinality(v_missing) = 0 then
    new.status := 'planned';
    new.uploaded_at := null;
  else
    new.status := 'not_started';
    new.uploaded_at := null;
  end if;

  new.updated_at      := now();
  new.updated_by      := coalesce(auth.uid(), new.updated_by, new.owner_id);
  new.updated_by_name := coalesce(public.my_display_name(), new.updated_by_name);
  return new;
end $$;

-- history now also records PIC changes
create or replace function public.log_content_item_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_changes jsonb := '{}'::jsonb;
  v_old jsonb;
  v_new jsonb;
  f text;
  tracked text[] := array['content','type','brief','caption','notes','publish_date',
                          'reference','content_pillars','instagram_url','brand_id','status','pic_id'];
begin
  if tg_op = 'INSERT' then
    insert into public.activity_log (role_id, item_id, actor_id, actor_name, action, summary, changes)
    values (new.role_id, new.id, coalesce(auth.uid(), new.owner_id), public.my_display_name(),
            'item_created', new.content,
            jsonb_build_object('brand_id', new.brand_id, 'pic_id', new.pic_id));
    return new;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    foreach f in array tracked loop
      if v_old -> f is distinct from v_new -> f then
        v_changes := v_changes || jsonb_build_object(f, jsonb_build_object('old', v_old -> f, 'new', v_new -> f));
      end if;
    end loop;
    if v_changes <> '{}'::jsonb then
      insert into public.activity_log (role_id, item_id, actor_id, actor_name, action, summary, changes)
      values (new.role_id, new.id, auth.uid(), public.my_display_name(),
              'item_updated', coalesce(new.content, old.content), v_changes);
    end if;
    return new;
  else
    insert into public.activity_log (role_id, item_id, actor_id, actor_name, action, summary, changes)
    values (old.role_id, old.id, auth.uid(), public.my_display_name(),
            'item_deleted', old.content, jsonb_build_object('deleted_row', to_jsonb(old)));
    return old;
  end if;
end $$;

-- delete: creator, PIC or Admin
drop policy if exists "delete items" on public.content_items;
create policy "delete items" on public.content_items for delete to authenticated
  using (public.is_admin()
         or (role_id = public.my_role_id() and (owner_id = auth.uid() or pic_id = auth.uid())));


-- ---------------------------------------------------------------------
-- 2. TARGETS: person x brand x month, Reels + Feed (replaces monthly_targets)
-- ---------------------------------------------------------------------
drop function if exists public.set_monthly_target(text, date, int, text, uuid);
drop table if exists public.monthly_targets;

create table public.content_targets (
  id            uuid primary key default gen_random_uuid(),
  month         date not null check (extract(day from month) = 1),   -- first day of month
  role_id       text not null references public.roles(id),            -- set automatically
  brand_id      text not null references public.brands(id),
  profile_id    uuid not null references public.profiles(id),         -- the PIC
  target_reels  int  not null default 0 check (target_reels between 0 and 500),
  target_feed   int  not null default 0 check (target_feed  between 0 and 500),
  target_total  int  generated always as (target_reels + target_feed) stored,
  note          text,                                                 -- admin "Status & notes"
  set_by        uuid references public.profiles(id),
  updated_at    timestamptz not null default now(),
  unique (month, brand_id, profile_id)
);
create index content_targets_role_month_idx on public.content_targets (role_id, month);

create or replace function public.content_targets_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  v_name text;
begin
  new.month        := date_trunc('month', new.month)::date;
  new.note         := nullif(btrim(new.note), '');
  new.target_reels := coalesce(new.target_reels, 0);
  new.target_feed  := coalesce(new.target_feed, 0);

  if tg_op = 'UPDATE' and new.profile_id = old.profile_id
     and new.brand_id = old.brand_id and new.month = old.month then
    new.role_id := old.role_id;           -- e.g. editing the note after someone moved roles
  else
    select p.role_id, p.display_name into v_role, v_name
    from public.profiles p where p.id = new.profile_id;
    if v_role is null then
      raise exception 'Choose a person who has a tracker.';
    end if;
    if not exists (select 1 from public.role_brands rb
                   where rb.role_id = v_role and rb.brand_id = new.brand_id) then
      raise exception 'Brand "%" is not in %''s tracker.', new.brand_id, v_name;
    end if;
    new.role_id := v_role;
  end if;

  new.set_by     := coalesce(auth.uid(), new.set_by);
  new.updated_at := now();
  return new;
end $$;

create trigger content_targets_before_write
  before insert or update on public.content_targets
  for each row execute function public.content_targets_before_write();

create or replace function public.log_content_target_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r public.content_targets;
  v_action text;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  v_action := case when tg_op = 'DELETE' then 'target_removed' else 'target_set' end;
  insert into public.activity_log (role_id, actor_id, actor_name, action, summary, changes)
  values (r.role_id, auth.uid(), public.my_display_name(), v_action,
          to_char(r.month, 'FMMonth YYYY'),
          jsonb_build_object(
            'brand_id', r.brand_id,
            'profile_id', r.profile_id,
            'reels', jsonb_build_object('old', case when tg_op <> 'INSERT' then old.target_reels end,
                                        'new', case when tg_op <> 'DELETE' then new.target_reels end),
            'feed',  jsonb_build_object('old', case when tg_op <> 'INSERT' then old.target_feed end,
                                        'new', case when tg_op <> 'DELETE' then new.target_feed end),
            'note',  jsonb_build_object('old', case when tg_op <> 'INSERT' then old.note end,
                                        'new', case when tg_op <> 'DELETE' then new.note end)));
  return r;
end $$;

create trigger content_targets_log
  after insert or update or delete on public.content_targets
  for each row execute function public.log_content_target_change();

alter table public.content_targets enable row level security;
create policy "read targets"   on public.content_targets for select to authenticated
  using (public.can_access_role(role_id));
create policy "admin targets"  on public.content_targets for insert to authenticated
  with check (public.is_admin());
create policy "admin targets update" on public.content_targets for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin targets delete" on public.content_targets for delete to authenticated
  using (public.is_admin());
revoke all on public.content_targets from anon;


-- ---------------------------------------------------------------------
-- 3. TRACKER BANNERS (one per tracker; any member or Admin can change it)
-- ---------------------------------------------------------------------
create table public.tracker_banners (
  role_id         text primary key references public.roles(id) on delete cascade,
  image_path      text not null,               -- path inside the 'tracker-banners' bucket
  position_y      numeric(5,2) not null default 50 check (position_y between 0 and 100),
  updated_by      uuid references public.profiles(id),
  updated_by_name text,
  updated_at      timestamptz not null default now()
);

create or replace function public.tracker_banners_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if split_part(new.image_path, '/', 1) <> new.role_id then
    raise exception 'Banner image must be stored in the "%" folder.', new.role_id;
  end if;
  new.updated_by      := coalesce(auth.uid(), new.updated_by);
  new.updated_by_name := coalesce(public.my_display_name(), new.updated_by_name);
  new.updated_at      := now();
  return new;
end $$;

create trigger tracker_banners_before_write
  before insert or update on public.tracker_banners
  for each row execute function public.tracker_banners_before_write();

alter table public.tracker_banners enable row level security;
create policy "read banner"   on public.tracker_banners for select to authenticated
  using (public.can_access_role(role_id));
create policy "add banner"    on public.tracker_banners for insert to authenticated
  with check (public.can_access_role(role_id));
create policy "change banner" on public.tracker_banners for update to authenticated
  using (public.can_access_role(role_id)) with check (public.can_access_role(role_id));
create policy "remove banner" on public.tracker_banners for delete to authenticated
  using (public.can_access_role(role_id));
revoke all on public.tracker_banners from anon;

-- private storage bucket: max 5 MB, JPG / PNG / WebP
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tracker-banners', 'tracker-banners', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- files live at  <role_id>/<file>, e.g. behomy/7f3c....webp
create policy "tracker banners: read" on storage.objects for select to authenticated
  using (bucket_id = 'tracker-banners' and public.can_access_role((storage.foldername(name))[1]));
create policy "tracker banners: upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'tracker-banners' and public.can_access_role((storage.foldername(name))[1]));
create policy "tracker banners: replace" on storage.objects for update to authenticated
  using (bucket_id = 'tracker-banners' and public.can_access_role((storage.foldername(name))[1]))
  with check (bucket_id = 'tracker-banners' and public.can_access_role((storage.foldername(name))[1]));
create policy "tracker banners: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'tracker-banners' and public.can_access_role((storage.foldername(name))[1]));


-- ---------------------------------------------------------------------
-- 4. REALTIME
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.content_targets, public.tracker_banners;

commit;

-- Check: should list content_targets and tracker_banners, and the bucket.
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('content_targets', 'tracker_banners', 'monthly_targets')
union all
select 'bucket: ' || id from storage.buckets where id = 'tracker-banners';
