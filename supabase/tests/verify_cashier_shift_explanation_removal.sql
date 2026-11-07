-- Run only on a disposable database after the explanation-removal migration.
begin;

do $test$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'cashier_shifts'
               and column_name in ('notes', 'variance_reason'))
     or to_regprocedure('public.close_cashier_shift(numeric,text,text)') is not null
     or to_regprocedure('public.close_cashier_shift(numeric)') is null then
    raise exception 'Retired shift explanation schema is still present';
  end if;
end $test$;

insert into auth.users(id) values
  ('9f360000-0000-4000-8000-000000000001'),
  ('9f360000-0000-4000-8000-000000000002'),
  ('9f360000-0000-4000-8000-000000000003'),
  ('9f360000-0000-4000-8000-000000000004');
insert into public.profiles(id, first_name, role, is_active) values
  ('9f360000-0000-4000-8000-000000000001', 'Cashier A', 'cashier', true),
  ('9f360000-0000-4000-8000-000000000002', 'Cashier B', 'cashier', true),
  ('9f360000-0000-4000-8000-000000000003', 'Manager', 'manager', true),
  ('9f360000-0000-4000-8000-000000000004', 'Customer', 'customer', true)
on conflict (id) do update set role = excluded.role, is_active = excluded.is_active;

insert into public.cashier_shifts(id, cashier_id, terminal, opening_cash) values
  ('9f360000-0000-4000-8000-000000000011', '9f360000-0000-4000-8000-000000000001', 'E1', 100);
set local role authenticated;
select set_config('request.jwt.claim.sub', '9f360000-0000-4000-8000-000000000001', true);
do $test$
declare v record;
begin
  select * into v from public.close_cashier_shift(100);
  if v.expected_cash <> 100 or v.actual_cash <> 100 or v.variance <> 0 then
    raise exception 'Balanced closure changed';
  end if;
end $test$;

reset role;
insert into public.cashier_shifts(id, cashier_id, terminal, opening_cash) values
  ('9f360000-0000-4000-8000-000000000012', '9f360000-0000-4000-8000-000000000001', 'E2', 100);
set local role authenticated;
do $test$
declare v record;
begin
  select * into v from public.close_cashier_shift(99);
  if v.expected_cash <> 100 or v.actual_cash <> 99 or v.variance <> -1 then
    raise exception 'Shortage closure without explanation failed';
  end if;
end $test$;

reset role;
insert into public.cashier_shifts(id, cashier_id, terminal, opening_cash) values
  ('9f360000-0000-4000-8000-000000000013', '9f360000-0000-4000-8000-000000000001', 'E3', 100);
set local role authenticated;
do $test$
declare v record; denied boolean := false;
begin
  select * into v from public.close_cashier_shift(101);
  if v.expected_cash <> 100 or v.actual_cash <> 101 or v.variance <> 1 then
    raise exception 'Overage closure without explanation failed';
  end if;
  if (select count(*) from public.get_closed_cashier_shifts()) <> 3 then
    raise exception 'Cashier history lost saved closures';
  end if;
  if (select count(*) from public.get_closed_cashier_shifts()
      where (expected_cash, actual_cash, variance) in
        ((100,100,0), (100,99,-1), (100,101,1))) <> 3 then
    raise exception 'Saved history money values changed';
  end if;
  begin
    perform public.get_closed_cashier_shifts(p_cashier_id => '9f360000-0000-4000-8000-000000000002');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Cross-Cashier history allowed'; end if;
end $test$;

reset role;
do $test$
declare denied boolean := false;
begin
  begin
    update public.cashier_shifts set actual_cash = 102
      where id = '9f360000-0000-4000-8000-000000000013';
  exception when check_violation then denied := true;
  end;
  if not denied then raise exception 'Closed money snapshot could be changed'; end if;
end $test$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '9f360000-0000-4000-8000-000000000003', true);
do $test$
declare denied boolean := false;
begin
  if (select count(*) from public.get_closed_cashier_shifts()) <> 3 then
    raise exception 'Manager history read changed';
  end if;
  begin perform public.close_cashier_shift(100);
  exception when others then denied := true;
  end;
  if not denied then raise exception 'Manager closed a Cashier shift'; end if;
end $test$;
select set_config('request.jwt.claim.sub', '9f360000-0000-4000-8000-000000000004', true);
do $test$
declare denied boolean := false;
begin
  begin perform public.get_closed_cashier_shifts();
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Customer accessed saved shift history'; end if;
end $test$;
rollback;

