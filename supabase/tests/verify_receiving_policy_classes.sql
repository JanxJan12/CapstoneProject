-- Disposable local database only. Synthetic fixtures and all assertions roll back.
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'm31-' || id || '@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
from (values ('b0310000-0000-4000-8000-000000000001'::uuid),
             ('b0310000-0000-4000-8000-000000000002'::uuid),
             ('b0310000-0000-4000-8000-000000000003'::uuid)) identity(id);
insert into public.profiles (id, first_name, role, is_active) values
  ('b0310000-0000-4000-8000-000000000001', 'M31 Manager', 'manager', true),
  ('b0310000-0000-4000-8000-000000000002', 'M31 Inactive', 'manager', false),
  ('b0310000-0000-4000-8000-000000000003', 'M31 Cashier', 'cashier', true)
on conflict (id) do update set role = excluded.role, is_active = excluded.is_active;

insert into public.inventory_items (id, item_name, unit) values
  ('b0310000-0000-4000-8000-000000000010', 'M31 classification fixture', 'pcs'),
  ('b0310000-0000-4000-8000-000000000015', 'M31 legacy fixture', 'pcs');
insert into public.suppliers (id, name, is_active) values
  ('b0310000-0000-4000-8000-000000000011', 'M31 synthetic supplier', true);
insert into public.purchase_orders
  (id, po_number, supplier_id, created_by, status, ordered_at) values
  ('b0310000-0000-4000-8000-000000000012', 'M31-PO',
   'b0310000-0000-4000-8000-000000000011',
   'b0310000-0000-4000-8000-000000000001', 'submitted', now());
insert into public.inventory_request_documents
  (id, request_number, priority, needed_at, reason, issue_input, issued_by) values
  ('b0310000-0000-4000-8000-000000000013', 'M31-REQUEST', 'scheduled', now(),
   'Synthetic classification fixture', '{}'::jsonb,
   'b0310000-0000-4000-8000-000000000001');
insert into public.production_replenishment_requests
  (id, inventory_item_id, requested_unit, requested_quantity, status, requested_by) values
  ('b0310000-0000-4000-8000-000000000014',
   'b0310000-0000-4000-8000-000000000015', 'pcs', 1, 'ready_for_delivery',
   'b0310000-0000-4000-8000-000000000001');

select set_config('request.jwt.claim.sub', 'b0310000-0000-4000-8000-000000000001', true);
insert into public.receiving_reports
  (id, rr_number, source_type, purchase_order_id, received_at, received_by) values
  ('b0310000-0000-4000-8000-000000000021', 'M31-SUPPLIER', 'direct_supplier',
   'b0310000-0000-4000-8000-000000000012', now(),
   'b0310000-0000-4000-8000-000000000001');
insert into public.receiving_reports
  (id, rr_number, source_type, inventory_request_id, inventory_request_revision,
   received_at, received_by) values
  ('b0310000-0000-4000-8000-000000000022', 'M31-FORMAL', 'production_team',
   'b0310000-0000-4000-8000-000000000013', 1, now(),
   'b0310000-0000-4000-8000-000000000001');
insert into public.receiving_reports
  (id, rr_number, source_type, replenishment_request_id, received_at, received_by)
  values ('b0310000-0000-4000-8000-000000000023', 'M31-LEGACY', 'production_team',
   'b0310000-0000-4000-8000-000000000014', now(),
   'b0310000-0000-4000-8000-000000000001');
do $verify$
begin
  if (select sum(quantity_on_hand) from public.inventory_items
      where id in ('b0310000-0000-4000-8000-000000000010',
                   'b0310000-0000-4000-8000-000000000015')) <> 0
     or (select count(*) from public.inventory_transactions
         where inventory_item_id in ('b0310000-0000-4000-8000-000000000010',
                                     'b0310000-0000-4000-8000-000000000015')) <> 0
  then raise exception 'Draft creation changed synthetic stock or ledger'; end if;
  raise notice 'Before posting: synthetic physical stock 0, receiving ledger rows 0';
end;
$verify$;
select public.save_receiving_report_item(
  'b0310000-0000-4000-8000-000000000023',
  'b0310000-0000-4000-8000-000000000027',
  'b0310000-0000-4000-8000-000000000015', null,
  1, 1, null, null, null, null, null, null, null);
select public.post_receiving_report('b0310000-0000-4000-8000-000000000023');
select public.create_emergency_production_receiving(
  'b0310000-0000-4000-8000-000000000024', now(), 'M31 delivery', null,
  'Synthetic emergency', 'M31 Inspector');
select public.save_receiving_report_item(
  'b0310000-0000-4000-8000-000000000024',
  'b0310000-0000-4000-8000-000000000026',
  'b0310000-0000-4000-8000-000000000010', null,
  2, 1, null, null, 'Rejected synthetic unit', null, null, null, null);
select public.post_receiving_report('b0310000-0000-4000-8000-000000000024');
do $verify$
begin
  if (select quantity_on_hand from public.inventory_items
      where id = 'b0310000-0000-4000-8000-000000000010') <> 1
     or (select quantity_on_hand from public.inventory_items
         where id = 'b0310000-0000-4000-8000-000000000015') <> 1
     or (select status from public.receiving_reports
         where id = 'b0310000-0000-4000-8000-000000000024') <> 'posted'
     or (select status from public.receiving_reports
         where id = 'b0310000-0000-4000-8000-000000000023') <> 'posted'
     or (select count(*) from public.inventory_transactions
         where inventory_item_id = 'b0310000-0000-4000-8000-000000000010'
           and transaction_type::text = 'receiving' and quantity_change = 1) <> 1
     or (select count(*) from public.inventory_transactions
         where inventory_item_id = 'b0310000-0000-4000-8000-000000000015'
           and transaction_type::text = 'receiving' and quantity_change = 1
           and reason = 'Historical Production request receiving report M31-LEGACY') <> 1
  then raise exception 'Accepted-only stock or ledger effect differs'; end if;
  raise notice 'After posting: synthetic physical stock 2, receiving ledger rows 2';
end;
$verify$;

-- Model a receipt created before this migration. Disable only its new insert
-- guard inside this rollback-only fixture, then restore it before assertions.
alter table public.receiving_reports disable trigger receiving_production_delivery_policy;
insert into public.receiving_reports
  (id, rr_number, source_type, received_at, received_by) values
  ('b0310000-0000-4000-8000-000000000025', 'M31-HISTORICAL', 'production_team',
   now(), 'b0310000-0000-4000-8000-000000000001');
alter table public.receiving_reports enable trigger receiving_production_delivery_policy;

set local role authenticated;
do $verify$
declare
  ids uuid[] := array[
    'b0310000-0000-4000-8000-000000000021'::uuid,
    'b0310000-0000-4000-8000-000000000022'::uuid,
    'b0310000-0000-4000-8000-000000000023'::uuid,
    'b0310000-0000-4000-8000-000000000024'::uuid,
    'b0310000-0000-4000-8000-000000000025'::uuid];
  result jsonb;
  denied boolean;
begin
  perform set_config('request.jwt.claim.sub', 'b0310000-0000-4000-8000-000000000001', true);
  result := public.get_receiving_policy_classes(ids);
  if jsonb_array_length(result) <> 5
    or not result @> '[{"id":"b0310000-0000-4000-8000-000000000021","classification":"direct_supplier"},
                       {"id":"b0310000-0000-4000-8000-000000000022","classification":"formal_request"},
                       {"id":"b0310000-0000-4000-8000-000000000023","classification":"historical_legacy_request"},
                       {"id":"b0310000-0000-4000-8000-000000000024","classification":"manager_emergency"},
                       {"id":"b0310000-0000-4000-8000-000000000025","classification":"historical_unlinked"}]'::jsonb
  then raise exception 'Five classification results differ: %', result; end if;
  if jsonb_array_length(public.get_receiving_policy_classes(array[ids[1]])) <> 1
  then raise exception 'Single report lookup failed'; end if;
  if public.get_receiving_policy_classes('{}'::uuid[]) <> '[]'::jsonb
     or public.get_receiving_policy_classes(null::uuid[]) <> '[]'::jsonb
     or public.get_receiving_policy_classes(array[null::uuid]) <> '[]'::jsonb
     or public.get_receiving_policy_classes(array[gen_random_uuid()]) <> '[]'::jsonb
     or jsonb_array_length(public.get_receiving_policy_classes(array[ids[1], ids[1]])) <> 1
  then raise exception 'Empty, null, unknown, or duplicate handling failed'; end if;
  if jsonb_array_length(public.get_receiving_policy_classes(array_fill(ids[1], array[100]))) <> 1
  then raise exception '100-ID boundary failed'; end if;
  denied := false;
  begin
    perform public.get_receiving_policy_classes(array_fill(ids[1], array[101]));
  exception when invalid_parameter_value then denied := true;
  end;
  if not denied then raise exception '101-ID boundary was accepted'; end if;
  denied := false;
  begin
    perform public.get_receiving_policy_classes(array['invalid-uuid'::uuid]);
  exception when invalid_text_representation then denied := true;
  end;
  if not denied then raise exception 'Invalid UUID text was accepted'; end if;
  if public.get_receiving_policy_evidence(ids[4])->>'classification' <> 'manager_emergency'
  then raise exception 'Evidence classification differs'; end if;
  denied := false;
  begin
    insert into public.receiving_reports
      (id, rr_number, source_type, received_at, received_by)
    values (gen_random_uuid(), 'M31-DIRECT-DENIED', 'production_team', now(),
      'b0310000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Authenticated Manager inserted a report directly'; end if;
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  denied := false;
  begin perform public.get_receiving_policy_classes(ids);
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Caller without a profile read classifications'; end if;
  perform set_config('request.jwt.claim.sub', 'b0310000-0000-4000-8000-000000000002', true);
  denied := false;
  begin perform public.get_receiving_policy_classes(ids);
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Inactive Manager read classifications'; end if;
  perform set_config('request.jwt.claim.sub', 'b0310000-0000-4000-8000-000000000003', true);
  denied := false;
  begin perform public.get_receiving_policy_classes(ids);
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Cashier read classifications'; end if;
  raise notice 'PASS: five classes, single/multiple/unknown/empty/null/invalid/duplicate, 100/101 boundary, active/inactive/non-Manager';
end;
$verify$;
reset role;

set local role anon;
do $verify$
declare denied boolean := false;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.get_receiving_policy_classes('{}'::uuid[]);
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Anonymous caller executed classification'; end if;
  raise notice 'PASS: anonymous invocation denied';
end;
$verify$;
reset role;

set local role service_role;
do $verify$
declare denied boolean := false;
begin
  begin
    perform public.get_receiving_policy_classes('{}'::uuid[]);
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Service role without an active Manager identity read classifications'; end if;
  perform set_config('request.jwt.claim.sub', 'b0310000-0000-4000-8000-000000000001', true);
  if jsonb_array_length(public.get_receiving_policy_classes(
       array['b0310000-0000-4000-8000-000000000024'::uuid])) <> 1
  then raise exception 'Service role with an active Manager identity could not read classifications'; end if;
  raise notice 'PASS: service role EXECUTE remains subject to the active Manager check';
end;
$verify$;
reset role;

do $verify$
begin
  if has_function_privilege('anon', 'public.get_receiving_policy_classes(uuid[])', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.get_receiving_policy_classes(uuid[])', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.get_receiving_policy_classes(uuid[])', 'EXECUTE')
  then raise exception 'Classification EXECUTE grants differ'; end if;
  if (select t.tgenabled from pg_trigger t where t.tgname = 'receiving_production_delivery_policy') <> 'O'
  then raise exception 'Production policy guard did not remain enabled'; end if;
  raise notice 'PASS: role grants and production guard enabled';
end;
$verify$;
rollback;
