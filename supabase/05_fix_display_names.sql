-- =====================================================================
-- OPTIONAL - set the agreed display names (run after 04_update_v2.sql)
-- The left side is the name shown now in the tracker; change the right
-- side if you prefer different spellings (e.g. 'Aroem', 'Ann').
-- Names can also be edited any time on the Admin -> People page.
-- =====================================================================
begin;

update public.profiles set display_name = 'Admin Beyondcy' where display_name = 'beyondcy.id';
update public.profiles set display_name = 'Dika'           where display_name = 'dikakpdarmaisno60rt0304';
update public.profiles set display_name = 'Zaki'           where display_name = 'irawanzaki1916';
update public.profiles set display_name = 'Arum'           where display_name = 'arumhl06';
update public.profiles set display_name = 'Anne'           where display_name = 'anndrive7';
update public.profiles set display_name = 'Ilyas'          where display_name = 'Ilyas | Monopod';

-- refresh names already stored in history, comments, banners and "last edited"
update public.activity_log a set actor_name = p.display_name
from public.profiles p where p.id = a.actor_id and a.actor_name is distinct from p.display_name;

update public.comments c set author_name = p.display_name
from public.profiles p where p.id = c.author_id and c.author_name is distinct from p.display_name;

update public.tracker_banners b set updated_by_name = p.display_name
from public.profiles p where p.id = b.updated_by and b.updated_by_name is distinct from p.display_name;

alter table public.content_items disable trigger content_items_before_write;
alter table public.content_items disable trigger content_items_log;
update public.content_items ci set updated_by_name = p.display_name
from public.profiles p where p.id = ci.updated_by and ci.updated_by_name is distinct from p.display_name;
alter table public.content_items enable trigger content_items_before_write;
alter table public.content_items enable trigger content_items_log;

commit;

select email, display_name, role_id from public.profiles order by role_id, display_name;
