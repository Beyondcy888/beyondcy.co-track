-- =====================================================================
-- BEYONDCY TRACKER (track.beyondcy.co) - DATABASE SCHEMA
-- Run ONCE in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Run this file first, then 02_seed.sql, then (after creating the users)
-- 03_assign_users.sql.
--
-- What this creates:
--   brands, roles, role_brands, brand_pillars   (setup data)
--   profiles                                     (one row per login)
--   content_items                                (the tracker rows)
--   comments                                     (comment thread per item)
--   activity_log                                 (who changed what, when)
--   monthly_targets                              (content targets, admin only)
-- Plus: automatic status, the Instagram-link lock, edit history,
-- Row Level Security (each person only sees their own tracker),
-- and Realtime for live updates.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TYPES
-- ---------------------------------------------------------------------
create type public.content_type   as enum ('feed', 'reels');
create type public.content_status as enum ('not_started', 'planned', 'uploaded');
create type public.tracker_layout as enum ('single', 'multi_brand', 'team');
-- single      = one brand, one table            (Beefix, Homy8)
-- multi_brand = MASTER + one page per brand     (Lahap & Kedai Makmoer 88)
-- team        = "My work" + MASTER for a team   (Behomy)


-- ---------------------------------------------------------------------
-- 2. SETUP TABLES
-- ---------------------------------------------------------------------
create table public.brands (
  id               text primary key,          -- slug, e.g. 'beefix'
  name             text not null,             -- shown in the UI
  instagram_handle text,
  sort_order       int  not null default 0,
  created_at       timestamptz not null default now()
);

-- A role = access to exactly one tracker. People are given a role;
-- moving someone to another brand = changing their role.
create table public.roles (
  id         text primary key,                -- 'admin', 'beefix', ...
  name       text not null,                   -- shown in the UI
  is_admin   boolean not null default false,  -- admin sees every tracker
  layout     public.tracker_layout,           -- null for admin
  sort_order int not null default 0
);

-- Which brands belong to which tracker.
create table public.role_brands (
  role_id  text not null references public.roles(id)  on delete cascade,
  brand_id text not null references public.brands(id) on delete cascade,
  primary key (role_id, brand_id)
);

-- Content pillar options. A brand that has pillars here REQUIRES a pillar
-- on every item (currently only Homy8).
create table public.brand_pillars (
  id         uuid primary key default gen_random_uuid(),
  brand_id   text not null references public.brands(id) on delete cascade,
  name       text not null,
  sort_order int  not null default 0,
  unique (brand_id, name)
);


-- ---------------------------------------------------------------------
-- 3. PROFILES (one per login; created automatically when a user is added)
-- ---------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text not null,                 -- e.g. 'Dika', 'Admin Beyondcy'
  role_id      text references public.roles(id),
  is_active    boolean not null default true, -- deactivate instead of deleting
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------
-- 4. ACCESS HELPERS (used by the security rules below)
-- ---------------------------------------------------------------------
create or replace function public.my_role_id()
returns text language sql stable security definer set search_path = public as $$
  select p.role_id from public.profiles p where p.id = auth.uid() and p.is_active
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select r.is_admin
    from public.profiles p join public.roles r on r.id = p.role_id
    where p.id = auth.uid() and p.is_active
  ), false)
$$;

create or replace function public.can_access_role(target_role text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or (target_role is not null and target_role = public.my_role_id())
$$;

create or replace function public.my_display_name()
returns text language sql stable security definer set search_path = public as $$
  select display_name from public.profiles where id = auth.uid()
$$;


-- ---------------------------------------------------------------------
-- 5. CONTENT ITEMS (the tracker rows)
-- ---------------------------------------------------------------------
create table public.content_items (
  id               uuid primary key default gen_random_uuid(),
  role_id          text not null references public.roles(id),   -- which tracker
  brand_id         text not null references public.brands(id),
  owner_id         uuid not null default auth.uid() references public.profiles(id),

  -- the 7 fields that must all be filled for "Planned"
  content          text,                      -- title
  type             public.content_type,       -- feed / reels
  brief            text,
  caption          text,
  notes            text,
  publish_date     date,
  reference        text,                      -- one or more links, one per line

  -- Homy8 only (required there; always empty for other brands)
  content_pillars  text[] not null default '{}',

  -- "Uploaded content": the Instagram post link
  instagram_url    text,

  -- maintained automatically by the trigger below (never written by the app)
  status           public.content_status not null default 'not_started',
  missing_fields   text[] not null default '{}',
  uploaded_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.profiles(id),
  updated_by_name  text
);

create index content_items_role_date_idx on public.content_items (role_id, publish_date);
create index content_items_owner_idx     on public.content_items (owner_id);
create index content_items_brand_idx     on public.content_items (brand_id);

-- Status rules, Instagram-link lock and housekeeping.
create or replace function public.content_items_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_missing     text[] := '{}';
  v_has_pillars boolean;
  v_unknown     text[];
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
    -- de-duplicate and keep the official order
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

create trigger content_items_before_write
  before insert or update on public.content_items
  for each row execute function public.content_items_before_write();


-- ---------------------------------------------------------------------
-- 6. COMMENTS
-- ---------------------------------------------------------------------
create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.content_items(id) on delete cascade,
  role_id     text not null references public.roles(id),     -- copied from the item
  author_id   uuid not null default auth.uid() references public.profiles(id),
  author_name text,                                          -- name at time of writing
  body        text not null check (length(btrim(body)) between 1 and 4000),
  created_at  timestamptz not null default now()
);
create index comments_item_idx on public.comments (item_id, created_at);

create or replace function public.comments_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select ci.role_id into new.role_id from public.content_items ci where ci.id = new.item_id;
  if new.role_id is null then
    raise exception 'Content item not found.';
  end if;
  new.author_id   := coalesce(auth.uid(), new.author_id);
  new.author_name := coalesce(public.my_display_name(), new.author_name);
  new.body        := btrim(new.body);
  new.created_at  := now();
  return new;
end $$;

create trigger comments_before_insert
  before insert on public.comments
  for each row execute function public.comments_before_insert();


-- ---------------------------------------------------------------------
-- 7. ACTIVITY LOG (edit history; written only by triggers)
-- ---------------------------------------------------------------------
create table public.activity_log (
  id          bigint generated always as identity primary key,
  role_id     text not null,
  item_id     uuid,                 -- kept even after the item is deleted
  actor_id    uuid,
  actor_name  text,                 -- e.g. 'Admin Beyondcy'
  action      text not null,        -- item_created | item_updated | item_deleted
                                    -- comment_added | comment_deleted | target_set
  summary     text,                 -- usually the content title
  changes     jsonb not null default '{}'::jsonb,  -- {"caption": {"old": ..., "new": ...}}
  created_at  timestamptz not null default now()
);
create index activity_log_role_idx on public.activity_log (role_id, created_at desc);
create index activity_log_item_idx on public.activity_log (item_id, created_at desc);

create or replace function public.log_content_item_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_changes jsonb := '{}'::jsonb;
  v_old jsonb;
  v_new jsonb;
  f text;
  tracked text[] := array['content','type','brief','caption','notes','publish_date',
                          'reference','content_pillars','instagram_url','brand_id','status'];
begin
  if tg_op = 'INSERT' then
    insert into public.activity_log (role_id, item_id, actor_id, actor_name, action, summary, changes)
    values (new.role_id, new.id, coalesce(auth.uid(), new.owner_id), public.my_display_name(),
            'item_created', new.content, jsonb_build_object('brand_id', new.brand_id));
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

  else -- DELETE: keep a full copy so nothing is lost
    insert into public.activity_log (role_id, item_id, actor_id, actor_name, action, summary, changes)
    values (old.role_id, old.id, auth.uid(), public.my_display_name(),
            'item_deleted', old.content, jsonb_build_object('deleted_row', to_jsonb(old)));
    return old;
  end if;
end $$;

create trigger content_items_log
  after insert or update or delete on public.content_items
  for each row execute function public.log_content_item_change();

create or replace function public.log_comment_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_log (role_id, item_id, actor_id, actor_name, action, summary, changes)
    values (new.role_id, new.item_id, new.author_id, new.author_name, 'comment_added',
            (select content from public.content_items where id = new.item_id),
            jsonb_build_object('comment_id', new.id, 'body', new.body));
    return new;
  else
    insert into public.activity_log (role_id, item_id, actor_id, actor_name, action, summary, changes)
    values (old.role_id, old.item_id, auth.uid(), public.my_display_name(), 'comment_deleted',
            (select content from public.content_items where id = old.item_id),
            jsonb_build_object('comment_id', old.id, 'body', old.body));
    return old;
  end if;
end $$;

create trigger comments_log
  after insert or delete on public.comments
  for each row execute function public.log_comment_change();


-- ---------------------------------------------------------------------
-- 8. MONTHLY TARGETS (only Admin sets them, via set_monthly_target)
--   single      tracker: one row per month, brand = the tracker's brand
--   multi_brand tracker: one row per brand per month (total = sum)
--   team        tracker: one row per person per month (team total = sum)
-- ---------------------------------------------------------------------
create table public.monthly_targets (
  id          uuid primary key default gen_random_uuid(),
  role_id     text not null references public.roles(id),
  brand_id    text references public.brands(id),
  profile_id  uuid references public.profiles(id),
  month       date not null check (extract(day from month) = 1),  -- first day of month
  target      int  not null check (target between 0 and 1000),
  set_by      uuid references public.profiles(id),
  updated_at  timestamptz not null default now()
);
create unique index monthly_targets_unique_idx on public.monthly_targets (
  role_id,
  coalesce(brand_id, ''),
  coalesce(profile_id, '00000000-0000-0000-0000-000000000000'::uuid),
  month
);

-- Set or clear a target. p_target = null removes it.
create or replace function public.set_monthly_target(
  p_role_id    text,
  p_month      date,
  p_target     int,
  p_brand_id   text default null,
  p_profile_id uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_layout public.tracker_layout;
  v_month  date := date_trunc('month', p_month)::date;
  v_old    int;
begin
  if not public.is_admin() then
    raise exception 'Only Admin can set targets.';
  end if;

  select layout into v_layout from public.roles where id = p_role_id;
  if v_layout is null then
    raise exception 'Unknown tracker "%".', p_role_id;
  end if;

  if v_layout in ('single', 'multi_brand') then
    if p_brand_id is null or not exists (
         select 1 from public.role_brands where role_id = p_role_id and brand_id = p_brand_id) then
      raise exception 'Choose a brand that belongs to this tracker.';
    end if;
    p_profile_id := null;
  else -- team: one target per person
    if p_profile_id is null or not exists (
         select 1 from public.profiles where id = p_profile_id and role_id = p_role_id) then
      raise exception 'Choose a person who belongs to this tracker.';
    end if;
    p_brand_id := null;
  end if;

  select target into v_old from public.monthly_targets
  where role_id = p_role_id
    and coalesce(brand_id, '') = coalesce(p_brand_id, '')
    and coalesce(profile_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(p_profile_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and month = v_month;

  if p_target is null then
    delete from public.monthly_targets
    where role_id = p_role_id
      and coalesce(brand_id, '') = coalesce(p_brand_id, '')
      and coalesce(profile_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = coalesce(p_profile_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and month = v_month;
  else
    insert into public.monthly_targets (role_id, brand_id, profile_id, month, target, set_by, updated_at)
    values (p_role_id, p_brand_id, p_profile_id, v_month, p_target, auth.uid(), now())
    on conflict (role_id, coalesce(brand_id, ''),
                 coalesce(profile_id, '00000000-0000-0000-0000-000000000000'::uuid), month)
    do update set target = excluded.target, set_by = excluded.set_by, updated_at = now();
  end if;

  insert into public.activity_log (role_id, actor_id, actor_name, action, summary, changes)
  values (p_role_id, auth.uid(), public.my_display_name(), 'target_set',
          to_char(v_month, 'FMMonth YYYY'),
          jsonb_build_object('brand_id', p_brand_id, 'profile_id', p_profile_id,
                             'target', jsonb_build_object('old', v_old, 'new', p_target)));
end $$;


-- ---------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (the real lock: each person sees only their tracker)
-- ---------------------------------------------------------------------
alter table public.brands          enable row level security;
alter table public.roles           enable row level security;
alter table public.role_brands     enable row level security;
alter table public.brand_pillars   enable row level security;
alter table public.profiles        enable row level security;
alter table public.content_items   enable row level security;
alter table public.comments        enable row level security;
alter table public.activity_log    enable row level security;
alter table public.monthly_targets enable row level security;

-- setup tables: every signed-in user can read; only Admin can change
create policy "read brands"        on public.brands        for select to authenticated using (true);
create policy "admin brands"       on public.brands        for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "read roles"         on public.roles         for select to authenticated using (true);
create policy "admin roles"        on public.roles         for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "read role_brands"   on public.role_brands   for select to authenticated using (true);
create policy "admin role_brands"  on public.role_brands   for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "read pillars"       on public.brand_pillars for select to authenticated using (true);
create policy "admin pillars"      on public.brand_pillars for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- profiles: see yourself, your teammates and the admin; only Admin edits
create policy "read profiles" on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or role_id = public.my_role_id()
    or role_id in (select id from public.roles where is_admin)
  );
create policy "admin updates profiles" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- content items: only your own tracker (admin: all)
create policy "read items"   on public.content_items for select to authenticated
  using (public.can_access_role(role_id));
create policy "create items" on public.content_items for insert to authenticated
  with check (public.can_access_role(role_id) and owner_id = auth.uid());
create policy "edit items"   on public.content_items for update to authenticated
  using (public.can_access_role(role_id)) with check (public.can_access_role(role_id));
create policy "delete items" on public.content_items for delete to authenticated
  using (public.is_admin() or (role_id = public.my_role_id() and owner_id = auth.uid()));

-- comments
create policy "read comments"   on public.comments for select to authenticated
  using (public.can_access_role(role_id));
create policy "add comments"    on public.comments for insert to authenticated
  with check (public.can_access_role(role_id) and author_id = auth.uid());
create policy "delete comments" on public.comments for delete to authenticated
  using (public.is_admin() or author_id = auth.uid());

-- activity log: read-only for the tracker's people
create policy "read activity" on public.activity_log for select to authenticated
  using (public.can_access_role(role_id));

-- targets: read for the tracker's people; writes only through set_monthly_target()
create policy "read targets" on public.monthly_targets for select to authenticated
  using (public.can_access_role(role_id));

-- visitors who are not signed in get nothing at all
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on function public.set_monthly_target(text, date, int, text, uuid) from public, anon;
grant  execute on function public.set_monthly_target(text, date, int, text, uuid) to authenticated;

-- the app must never write these directly
revoke insert, update, delete on public.activity_log    from authenticated;
revoke insert, update, delete on public.monthly_targets from authenticated;


-- ---------------------------------------------------------------------
-- 10. REALTIME (live updates when a teammate edits)
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.content_items, public.comments, public.monthly_targets;
