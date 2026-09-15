begin;

drop trigger if exists on_auth_user_created_profile
on auth.users;

drop function if exists public.handle_new_user();

commit;