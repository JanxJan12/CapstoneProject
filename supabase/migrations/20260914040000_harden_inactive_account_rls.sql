begin;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active = true;
$$;

revoke all
on function public.current_user_role()
from public;

revoke all
on function public.current_user_role()
from anon;

grant execute
on function public.current_user_role()
to authenticated;

grant execute
on function public.current_user_role()
to service_role;

drop policy if exists
  riders_view_own_application
on public.riders;

create policy riders_view_own_application
on public.riders
for select
to authenticated
using (
  (
    id = auth.uid()
    and public.current_user_role() is not null
  )
  or public.current_user_role() = 'manager'::public.user_role
);

commit;