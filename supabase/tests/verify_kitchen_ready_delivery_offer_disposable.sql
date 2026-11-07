-- Run only against an isolated disposable local database. All fixtures roll back.
begin;

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'handoff-cashier@example.invalid'),
  ('00000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'handoff-rider-a@example.invalid'),
  ('00000000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'handoff-rider-b@example.invalid'),
  ('00000000-0000-4000-8000-0000000000a4', 'authenticated', 'authenticated', 'handoff-rider-c@example.invalid');
update public.profiles set role = 'cashier' where id = '00000000-0000-4000-8000-0000000000a1';
update public.profiles set role = 'rider' where id in
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a3',
   '00000000-0000-4000-8000-0000000000a4');
insert into public.riders (id, approval_status, availability_status) values
  ('00000000-0000-4000-8000-0000000000a2', 'approved', 'available'),
  ('00000000-0000-4000-8000-0000000000a3', 'approved', 'offline'),
  ('00000000-0000-4000-8000-0000000000a4', 'approved', 'offline');
insert into public.kds_terminals (id, terminal_name, secret_hash) values
  ('00000000-0000-4000-8000-0000000000b1', 'Disposable Kitchen',
   encode(extensions.digest('disposable-kitchen-secret', 'sha256'), 'hex'));

insert into public.orders
  (id, order_number, order_channel, fulfillment_type, delivery_address,
   current_status, subtotal, grand_total) values
  ('00000000-0000-4000-8000-0000000000c1','HANDOFF-C1','online','delivery','Synthetic address','preparing',10,10),
  ('00000000-0000-4000-8000-0000000000c2','HANDOFF-C2','online','delivery','Synthetic address','preparing',10,10),
  ('00000000-0000-4000-8000-0000000000c3','HANDOFF-C3','online','delivery','Synthetic address','preparing',10,10),
  ('00000000-0000-4000-8000-0000000000c4','HANDOFF-C4','walk_in','delivery','Synthetic address','preparing',10,10),
  ('00000000-0000-4000-8000-0000000000c5','HANDOFF-C5','online','takeout',null,'preparing',10,10),
  ('00000000-0000-4000-8000-0000000000c6','HANDOFF-C6','online','dine_in',null,'preparing',10,10),
  ('00000000-0000-4000-8000-0000000000c7','HANDOFF-C7','online','delivery','Synthetic address','waiting_for_rider',10,10);
insert into public.payments
  (order_id, payment_method, amount, gcash_reference_number, status)
values
  ('00000000-0000-4000-8000-0000000000c1','gcash',10,'SYNTH-C1','verified'),
  ('00000000-0000-4000-8000-0000000000c2','gcash',10,'SYNTH-C2','verified'),
  ('00000000-0000-4000-8000-0000000000c3','gcash',10,'SYNTH-C3','pending'),
  ('00000000-0000-4000-8000-0000000000c7','gcash',10,'SYNTH-C7','verified');

-- The Kitchen terminal uses its secret without a staff Auth session.
set local role anon;
select current_status as anonymous_kitchen_result from public.advance_kds_order(
  '00000000-0000-4000-8000-0000000000b1','disposable-kitchen-secret',
  '00000000-0000-4000-8000-0000000000c1','preparing');
reset role;

do $$
declare
  v_result record;
  v_assignment uuid;
  v_offer_count integer;
begin
  if has_schema_privilege('anon','rrj_internal','USAGE')
     or has_function_privilege('anon','rrj_internal.offer_order_to_next_rider(uuid)','EXECUTE') then
    raise exception 'Private offer helper is exposed to anon';
  end if;

  if (select current_status from public.orders
      where id='00000000-0000-4000-8000-0000000000c1') <> 'waiting_for_rider' then
    raise exception 'Verified delivery did not receive automatic offer';
  end if;
  select id into v_assignment from public.delivery_assignments
  where order_id='00000000-0000-4000-8000-0000000000c1' and status='offered';
  if v_assignment is null then raise exception 'Offer row missing'; end if;
  select count(*) into v_offer_count from public.delivery_assignments
  where order_id='00000000-0000-4000-8000-0000000000c1';
  if v_offer_count <> 1 then raise exception 'Duplicate offer created'; end if;
  begin
    insert into public.delivery_assignments (order_id, rider_id)
    values ('00000000-0000-4000-8000-0000000000c1',
            '00000000-0000-4000-8000-0000000000a3');
    raise exception 'Unique active-assignment index allowed a duplicate';
  exception when unique_violation then null;
  end;

  begin
    perform 1 from public.advance_kds_order(
      '00000000-0000-4000-8000-0000000000b1','disposable-kitchen-secret',
      '00000000-0000-4000-8000-0000000000c1','preparing');
    raise exception 'Repeated Kitchen transition succeeded';
  exception when sqlstate 'P0001' then
    if sqlerrm = 'Repeated Kitchen transition succeeded' then raise; end if;
  end;

  select * into v_result from public.advance_kds_order(
    '00000000-0000-4000-8000-0000000000b1','disposable-kitchen-secret',
    '00000000-0000-4000-8000-0000000000c2','preparing');
  if v_result.current_status <> 'ready' then
    raise exception 'No-rider delivery must remain Ready';
  end if;
  if not exists (select 1 from public.get_kds_queue_v2(
      '00000000-0000-4000-8000-0000000000b1','disposable-kitchen-secret') q
      where q.order_id='00000000-0000-4000-8000-0000000000c2' and q.current_status='ready') then
    raise exception 'No-rider delivery missing from Kitchen queue';
  end if;
  if exists (select 1 from public.delivery_assignments
      where order_id='00000000-0000-4000-8000-0000000000c2') then
    raise exception 'No-rider delivery has an offer';
  end if;
  select * into v_result from public.advance_kds_order(
    '00000000-0000-4000-8000-0000000000b1','disposable-kitchen-secret',
    '00000000-0000-4000-8000-0000000000c2','ready');
  if v_result.current_status <> 'ready' then
    raise exception 'Retry without Rider must remain Ready';
  end if;

  update public.riders set availability_status='available'
  where id='00000000-0000-4000-8000-0000000000a3';
  select * into v_result from public.advance_kds_order(
    '00000000-0000-4000-8000-0000000000b1','disposable-kitchen-secret',
    '00000000-0000-4000-8000-0000000000c2','ready');
  if v_result.current_status <> 'waiting_for_rider' or not exists (
    select 1 from public.delivery_assignments
    where order_id='00000000-0000-4000-8000-0000000000c2'
      and rider_id='00000000-0000-4000-8000-0000000000a3'
      and status='offered') then
    raise exception 'Kitchen retry failed to offer';
  end if;

  begin
    perform 1 from public.advance_kds_order(
      '00000000-0000-4000-8000-0000000000b1','wrong-secret',
      '00000000-0000-4000-8000-0000000000c3','preparing');
    raise exception 'Invalid Kitchen secret succeeded';
  exception when sqlstate 'P0001' then
    if sqlerrm = 'Invalid Kitchen secret succeeded' then raise; end if;
  end;
  begin
    perform 1 from public.advance_kds_order(
      '00000000-0000-4000-8000-0000000000b1','disposable-kitchen-secret',
      '00000000-0000-4000-8000-0000000000c3','preparing');
    raise exception 'Pending payment received Rider offer';
  exception when sqlstate 'P0001' then
    if sqlerrm = 'Pending payment received Rider offer' then raise; end if;
  end;
  if (select current_status from public.orders
      where id='00000000-0000-4000-8000-0000000000c3') <> 'preparing' then
    raise exception 'Pending payment changed order status';
  end if;

  foreach v_assignment in array array[
    '00000000-0000-4000-8000-0000000000c4'::uuid,
    '00000000-0000-4000-8000-0000000000c5'::uuid,
    '00000000-0000-4000-8000-0000000000c6'::uuid]
  loop
    select * into v_result from public.advance_kds_order(
      '00000000-0000-4000-8000-0000000000b1','disposable-kitchen-secret',
      v_assignment,'preparing');
    if v_result.current_status <> 'ready' then
      raise exception 'Other fulfillment flow changed';
    end if;
  end loop;
  if exists (select 1 from public.delivery_assignments da where da.order_id in (
    '00000000-0000-4000-8000-0000000000c4',
    '00000000-0000-4000-8000-0000000000c5',
    '00000000-0000-4000-8000-0000000000c6')) then
    raise exception 'Other fulfillment received Rider offer';
  end if;

  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000a2',true);
  begin
    perform 1 from public.accept_rider_offer(
      (select id from public.delivery_assignments
       where order_id='00000000-0000-4000-8000-0000000000c2'));
    raise exception 'Rider accepted another rider offer';
  exception when sqlstate 'P0001' then
    if sqlerrm = 'Rider accepted another rider offer' then raise; end if;
  end;
  begin
    perform 1 from public.offer_order_to_next_rider(
      '00000000-0000-4000-8000-0000000000c2');
    raise exception 'Rider used staff offer RPC';
  exception when sqlstate 'P0001' then
    if sqlerrm = 'Rider used staff offer RPC' then raise; end if;
  end;
  select * into v_result from public.accept_rider_offer(
    (select id from public.delivery_assignments
     where order_id='00000000-0000-4000-8000-0000000000c1'));
  if v_result.order_status <> 'rider_accepted' then
    raise exception 'Rider acceptance failed';
  end if;
  select * into v_result from public.advance_rider_delivery(
    (select id from public.delivery_assignments
     where order_id='00000000-0000-4000-8000-0000000000c1'), 'accepted');
  if v_result.order_status <> 'picked_up' then
    raise exception 'Rider pickup failed';
  end if;
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000a1',true);
  update public.riders set availability_status='available'
  where id='00000000-0000-4000-8000-0000000000a4';
  select * into v_result from public.offer_order_to_next_rider(
    '00000000-0000-4000-8000-0000000000c7');
  if v_result.rider_id <> '00000000-0000-4000-8000-0000000000a4'
     or v_result.assignment_status <> 'offered' then
    raise exception 'Staff reoffer RPC changed';
  end if;
  select * into v_result from public.release_ready_order(
    '00000000-0000-4000-8000-0000000000c5');
  if v_result.current_status <> 'completed' then
    raise exception 'Takeout Cashier release changed';
  end if;
  select * into v_result from public.release_ready_order(
    '00000000-0000-4000-8000-0000000000c6');
  if v_result.current_status <> 'completed' then
    raise exception 'Dine-in Cashier release changed';
  end if;
end;
$$;

select 'PASS: disposable Kitchen delivery handoff integration' as result;
rollback;
