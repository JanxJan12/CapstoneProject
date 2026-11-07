-- Run after manager_request_precision_disposable_setup.sql, the 02B supplement,
-- and the exact 02B migration. Disposable database only; every test row rolls back.
begin;
do $verify$
declare
  v_first uuid := '11111111-1111-4111-8111-111111111111';
  v_second uuid := '33333333-3333-4333-8333-333333333333';
  v_cashier uuid := '22222222-2222-4222-8222-222222222222';
  v_rider uuid := '44444444-4444-4444-8444-444444444444';
  v_request uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_request_two uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  v_report uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  v_report_two uuid := 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  v_blocked boolean;
  v_result jsonb;
begin
  if has_function_privilege('anon', 'public.start_inventory_request_receiving(uuid,integer,uuid,text,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.start_inventory_request_receiving(uuid,integer,uuid,text,text)', 'EXECUTE') then
    raise exception 'RPC grants differ from reviewed contract';
  end if;
  insert into public.profiles values (v_second, 'Second', 'Manager', 'manager', true),
    (v_rider, 'Rider', 'Account', 'rider', true);
  insert into public.inventory_request_documents
    (id,request_number,priority,needed_at,issue_input,issued_by)
  values (v_request_two,'PR-SYN-002','scheduled',now()+interval '2 days','[]'::jsonb,v_second);
  perform set_config('request.jwt.claim.sub', v_first::text, true);
  v_result := public.start_inventory_request_receiving(v_request, 1, v_report, 'FORGED INSPECTOR', null);
  if v_result->>'id' <> v_report::text
    or not exists (select 1 from public.receiving_reports r where r.id = v_report
      and r.inventory_request_id = v_request and r.inventory_request_revision = 1
      and r.received_by = v_first and r.inspected_by_name = v_first::text
      and r.inspection_note is null and r.status = 'draft')
    or not exists (select 1 from public.inventory_request_events e where e.request_id = v_request
      and e.event_type = 'delivery_started' and e.actor_id = v_first
      and e.details->>'inspected_by_name' = v_first::text)
    or (select quantity_on_hand from public.inventory_items
        where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4') <> 0 then
    raise exception 'First Manager inspector/creator/association/note/no-stock failure';
  end if;
  perform set_config('request.jwt.claim.sub', v_second::text, true);
  v_result := public.start_inventory_request_receiving(v_request, 1, v_report, 'OTHER INSPECTOR', 'new note');
  if v_result->>'id' <> v_report::text
    or (select inspected_by_name from public.receiving_reports where id = v_report) <> v_first::text
    or (select inspection_note from public.receiving_reports where id = v_report) is not null
    or (select count(*) from public.receiving_reports where inventory_request_id = v_request) <> 1 then
    raise exception 'Existing draft resume changed audit fields or duplicated';
  end if;
  v_blocked := false;
  begin
    perform public.start_inventory_request_receiving(v_request, 1, gen_random_uuid(), null, null);
  exception when unique_violation then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Second open draft was not denied'; end if;
  perform public.start_inventory_request_receiving(v_request_two, 1, v_report_two, null, null);
  if not exists (select 1 from public.receiving_reports where id = v_report_two
      and received_by = v_second and inspected_by_name = v_second::text
      and inspection_note is null)
    or (select count(*) from public.receiving_reports where inventory_request_id = v_request_two) <> 1 then
    raise exception 'Second authenticated Manager attribution failed';
  end if;
  foreach v_second in array array[v_cashier, v_rider] loop
    perform set_config('request.jwt.claim.sub', v_second::text, true);
    v_blocked := false;
    begin
      perform public.start_inventory_request_receiving(v_request_two, 1, gen_random_uuid(), null, null);
    exception when insufficient_privilege then v_blocked := true;
    end;
    if not v_blocked then raise exception 'Unauthorized role % started Receiving', v_second; end if;
  end loop;
  perform set_config('request.jwt.claim.sub', '', true);
  v_blocked := false;
  begin
    perform public.start_inventory_request_receiving(v_request_two, 1, gen_random_uuid(), null, null);
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Unauthenticated call started Receiving'; end if;
  raise notice 'MGR-REC-02B actual RPC attribution, compatibility, resume, uniqueness, and role tests passed';
end;
$verify$;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
set local role authenticated;
do $authenticated$
begin
  if (public.start_inventory_request_receiving(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 1,
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd', null, null)->>'id')
    <> 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' then
    raise exception 'Authenticated database role could not resume linked draft';
  end if;
end;
$authenticated$;
reset role;
rollback;
