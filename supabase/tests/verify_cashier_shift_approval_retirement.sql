-- Run only on a disposable current-schema copy after the retirement migration.
begin;
insert into auth.users(id) values
  ('d9910000-0000-4000-8000-000000000001'),
  ('d9910000-0000-4000-8000-000000000002'),
  ('d9910000-0000-4000-8000-000000000003');
update public.profiles p set first_name=v.first_name,
  role=v.role::public.user_role, is_active=true
from (values
  ('d9910000-0000-4000-8000-000000000001'::uuid,'Cashier A','cashier'),
  ('d9910000-0000-4000-8000-000000000002'::uuid,'Cashier B','cashier'),
  ('d9910000-0000-4000-8000-000000000003'::uuid,'Customer','customer')
) v(id,first_name,role) where p.id=v.id;
insert into public.cashier_shifts
  (id,cashier_id,terminal,opening_cash,status,ended_at,actual_cash,expected_cash,variance,closed_by)
values
  ('d9910000-0000-4000-8000-000000000011','d9910000-0000-4000-8000-000000000001','A',100,'closed',now(),100,100,0,'d9910000-0000-4000-8000-000000000001'),
  ('d9910000-0000-4000-8000-000000000012','d9910000-0000-4000-8000-000000000002','B',200,'closed',now(),200,200,0,'d9910000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','d9910000-0000-4000-8000-000000000001',true);
do $test$
declare v record; denied boolean := false;
begin
  if (select count(*) from public.get_closed_cashier_shifts()) <> 1 then
    raise exception 'Cashier history owner filter changed';
  end if;
  select * into v from public.get_closed_cashier_shifts();
  if v.shift_id <> 'd9910000-0000-4000-8000-000000000011'::uuid
     or v.opening_cash <> 100 or v.expected_cash <> 100 or v.actual_cash <> 100
     or v.variance <> 0 or v.manager_approved_by is not null or v.manager_approved_at is not null then
    raise exception 'Cashier historical contract or saved settlement changed';
  end if;
  begin
    perform public.get_closed_cashier_shifts(p_cashier_id=>'d9910000-0000-4000-8000-000000000002');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Cross-cashier history was allowed'; end if;
end $test$;
select set_config('request.jwt.claim.sub','d9910000-0000-4000-8000-000000000003',true);
do $test$
declare denied boolean := false;
begin
  begin
    perform public.get_closed_cashier_shifts();
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Customer accessed cashier history'; end if;
end $test$;
rollback;
