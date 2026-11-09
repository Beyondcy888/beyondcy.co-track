-- =====================================================================
-- BEYONDCY TRACKER - SETUP DATA
-- Run SECOND (after 01_schema.sql). Safe to run again.
-- =====================================================================

-- Brands that have a tracker
insert into public.brands (id, name, instagram_handle, sort_order) values
  ('lahap',            'Lahap',            'eatlahap',         10),
  ('kedai_makmoer_88', 'Kedai Makmoer 88', 'kedaimakmoer88',   20),
  ('beefix',           'Beefix',           'beefix.id',        30),
  ('homy8',            'Homy8',            'homyeight',        40),
  ('behomy',           'Behomy',           'behomyid',         50),
  ('behomy_group',     'Behomy Group',     'behomygroup',      51),
  ('corvel',           'Corvel',           'corvel.bybehomy',  52),
  ('hoteru',           'Hoteru',           'hote_ru',          53),
  ('purnava',          'Purnava',          'purnava.bybehomy', 54)
on conflict (id) do update
  set name = excluded.name, instagram_handle = excluded.instagram_handle, sort_order = excluded.sort_order;

-- Roles (a role = access to one tracker)
insert into public.roles (id, name, is_admin, layout, sort_order) values
  ('admin',         'Admin',                    true,  null,          0),
  ('lahap_makmoer', 'Lahap & Kedai Makmoer 88', false, 'multi_brand', 10),
  ('beefix',        'Beefix',                   false, 'single',      20),
  ('homy8',         'Homy8',                    false, 'single',      30),
  ('behomy',        'Behomy',                   false, 'team',        40)
on conflict (id) do update
  set name = excluded.name, is_admin = excluded.is_admin, layout = excluded.layout, sort_order = excluded.sort_order;

-- Which brands each tracker contains
insert into public.role_brands (role_id, brand_id) values
  ('lahap_makmoer', 'lahap'),
  ('lahap_makmoer', 'kedai_makmoer_88'),
  ('beefix',        'beefix'),
  ('homy8',         'homy8'),
  ('behomy',        'behomy'),
  ('behomy',        'behomy_group'),
  ('behomy',        'corvel'),
  ('behomy',        'hoteru'),
  ('behomy',        'purnava')
on conflict do nothing;

-- Homy8 content pillars (multi-select, required for Homy8 only)
insert into public.brand_pillars (brand_id, name, sort_order) values
  ('homy8', 'Design',    1),
  ('homy8', 'Education', 2),
  ('homy8', 'Portfolio', 3),
  ('homy8', 'Interview', 4),
  ('homy8', 'Comedy',    5)
on conflict (brand_id, name) do update set sort_order = excluded.sort_order;
