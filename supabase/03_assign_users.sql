-- =====================================================================
-- BEYONDCY TRACKER - GIVE EACH PERSON A NAME AND A ROLE
-- Run THIRD, after creating the 7 users in Supabase:
--   Authentication -> Users -> Add user -> Create new user
--   (enter email + password, tick "Auto Confirm User").
-- Replace each email below with the real one, then Run.
-- To move someone to another brand later, change their role_id and run
-- just that line again.
-- =====================================================================

update public.profiles set display_name = 'Admin Beyondcy', role_id = 'admin'         where email = 'ADMIN_EMAIL_HERE';
update public.profiles set display_name = 'Excel',          role_id = 'lahap_makmoer' where email = 'EXCEL_EMAIL_HERE';
update public.profiles set display_name = 'Dika',           role_id = 'beefix'        where email = 'DIKA_EMAIL_HERE';
update public.profiles set display_name = 'Zaki',           role_id = 'homy8'         where email = 'ZAKI_EMAIL_HERE';
update public.profiles set display_name = 'Arum',           role_id = 'behomy'        where email = 'ARUM_EMAIL_HERE';
update public.profiles set display_name = 'Ilyas',          role_id = 'behomy'        where email = 'ILYAS_EMAIL_HERE';
update public.profiles set display_name = 'Anne',           role_id = 'behomy'        where email = 'ANNE_EMAIL_HERE';

-- Check: every person should show a name and a role. A missing row or an
-- empty role_id means the email above does not match the user you created.
select email, display_name, role_id, is_active from public.profiles order by role_id, display_name;
