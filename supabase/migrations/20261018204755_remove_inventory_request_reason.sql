-- Coordinated Request Reason removal. Apply only after the documented preflight
-- and a protected, restorable backup. Historical revision JSON is untouched.
-- Old RPC signatures remain as temporary compatibility adapters.
begin;

do $preflight$
begin
  if to_regclass('public.inventory_request_documents') is null
     or to_regprocedure('public.issue_inventory_request(uuid,text,timestamptz,text,jsonb,jsonb)') is null
     or to_regprocedure('public.revise_inventory_request(uuid,integer,text,timestamptz,text,jsonb,jsonb)') is null
     or to_regprocedure('public.get_inventory_request_register()') is null
     or not exists (
       select 1 from pg_attribute
       where attrelid = 'public.inventory_request_documents'::regclass
         and attname = 'reason' and not attisdropped
     )
     or not exists (
       select 1 from pg_constraint
       where conrelid = 'public.inventory_request_documents'::regclass
         and conname = 'inventory_request_documents_reason_check'
     ) then
    raise exception 'Expected October 12 Request schema is missing or changed.';
  end if;
  if exists (
    select 1 from pg_proc p
    where p.oid in (
      'public.issue_inventory_request(uuid,text,timestamptz,text,jsonb,jsonb)'::regprocedure,
      'public.revise_inventory_request(uuid,integer,text,timestamptz,text,jsonb,jsonb)'::regprocedure,
      'public.get_inventory_request_register()'::regprocedure
    ) and pg_get_userbyid(p.proowner) <> current_user
  ) or (
    select pg_get_userbyid(relowner)
    from pg_class where oid = 'public.inventory_request_documents'::regclass
  ) <> current_user then
    raise exception 'Migration role must own the existing Request table and functions.';
  end if;
  if exists (
    select 1 from public.inventory_request_revisions r
    where not (r.snapshot ? 'reason')
  ) or exists (
    select 1 from public.inventory_request_documents d
    left join public.inventory_request_revisions r
      on r.request_id = d.id and r.revision = d.current_revision
    where r.request_id is null or d.reason is distinct from r.snapshot->>'reason'
  ) or exists (
    select 1 from public.inventory_request_documents d
    where not exists (
      select 1 from public.inventory_request_revisions r
      where r.request_id = d.id and r.revision = 1
    )
  ) then
    raise exception 'Historical Request Reason is not fully preserved in revision snapshots.';
  end if;
end;
$preflight$;

create function public.issue_inventory_request(
  p_request_id uuid, p_priority text, p_needed_at timestamptz,
  p_lines jsonb, p_expected jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  v_actor uuid := public.inventory_request_manager_required();
  v_existing public.inventory_request_documents%rowtype;
  v_line jsonb;
  v_item public.inventory_items%rowtype;
  v_count integer := 0;
  v_number text;
  v_now timestamptz := now();
  v_snapshot jsonb;
  v_expected jsonb;
  v_issuer_name text;
  v_proposal_line jsonb;
  v_suggested numeric;
begin
  if p_request_id is null or p_priority not in ('emergency', 'priority', 'scheduled')
     or p_needed_at is null or p_needed_at <= v_now
     or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Complete request header and lines required.' using errcode = '22023';
  end if;
  -- Check retry IDs only after serializing issuers, including concurrent retries.
  perform pg_advisory_xact_lock(hashtext('inventory_request_issue'));
  select * into v_existing from public.inventory_request_documents where id = p_request_id;
  if found then
    if v_existing.issued_by <> v_actor or v_existing.priority <> p_priority
       or v_existing.needed_at <> p_needed_at
       or v_existing.issue_input <> p_lines then
      raise exception 'Request ID reused with different details.' using errcode = '22023';
    end if;
    return jsonb_build_object('id', v_existing.id, 'request_number', v_existing.request_number);
  end if;
  -- Posting is checked separately.
  perform 1 from public.inventory_items
    where id in (select (value->>'inventory_item_id')::uuid from jsonb_array_elements(p_lines))
    order by id for share;
  v_expected := public.get_inventory_request_proposal(p_needed_at);
  if p_expected is distinct from v_expected then
    raise exception 'Stock or outstanding requests changed. Review latest suggestions.' using errcode = '40001';
  end if;
  v_number := 'PR-' || to_char(v_now at time zone 'Asia/Manila', 'YYYYMMDD')
    || '-' || lpad(nextval('public.inventory_request_number_seq')::text, 6, '0');
  select concat_ws(' ', first_name, last_name) into v_issuer_name
    from public.profiles where id = v_actor;
  insert into public.inventory_request_documents
    (id, request_number, priority, needed_at, issue_input, issued_by, issued_at)
  values (p_request_id, v_number, p_priority, p_needed_at, p_lines, v_actor, v_now);
  for v_line in select value from jsonb_array_elements(p_lines) loop
    select * into v_item from public.inventory_items
      where id = (v_line->>'inventory_item_id')::uuid and is_active for share;
    if not found or (v_line->>'quantity') is null then
      raise exception 'Active inventory item and quantity required.' using errcode = '22023';
    end if;
    if (v_line->>'quantity')::numeric <= 0
       or (v_line->>'quantity')::numeric in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
       or (v_line->>'quantity')::numeric <> round((v_line->>'quantity')::numeric, v_item.quantity_scale)
       or (v_line->>'quantity')::numeric > 999999999.999 then
      raise exception 'Invalid item quantity or precision.' using errcode = '22023';
    end if;
    select value into v_proposal_line from jsonb_array_elements(v_expected)
      where value->>'id' = v_item.id::text;
    v_suggested := greatest((v_proposal_line->>'reorder_level')::numeric
      - (v_proposal_line->>'valid_at_need')::numeric
      - (v_proposal_line->>'outstanding')::numeric, 0);
    if (v_line->>'quantity')::numeric <> v_suggested
       and nullif(btrim(v_line->>'override_reason'), '') is null then
      raise exception 'Explain a quantity that differs from the provisional gap.' using errcode = '22023';
    end if;
    insert into public.inventory_request_lines
      (request_id, inventory_item_id, item_name, requested_unit, quantity_scale,
       requested_quantity, recommendation, override_reason)
    values (p_request_id, v_item.id, v_item.item_name, v_item.unit, v_item.quantity_scale,
      (v_line->>'quantity')::numeric,
      v_proposal_line,
      nullif(btrim(v_line->>'override_reason'), ''));
    v_count := v_count + 1;
  end loop;
  select jsonb_build_object('number', v_number, 'revision', 1, 'issued_at', v_now,
    'issued_by', v_actor, 'issued_by_name', v_issuer_name,
    'priority', p_priority, 'needed_at', p_needed_at,
    'destination', 'Production',
    'lines', coalesce(jsonb_agg(jsonb_build_object('inventory_item_id', l.inventory_item_id,
      'name', l.item_name, 'unit', l.requested_unit, 'quantity', l.requested_quantity)
      order by l.item_name), '[]'::jsonb)) into v_snapshot
  from public.inventory_request_lines l where l.request_id = p_request_id;
  insert into public.inventory_request_revisions(request_id, revision, snapshot, issued_by, issued_at)
    values (p_request_id, 1, v_snapshot, v_actor, v_now);
  insert into public.inventory_request_events(request_id, revision, event_type, actor_id)
    values (p_request_id, 1, 'issued', v_actor);
  return jsonb_build_object('id', p_request_id, 'request_number', v_number, 'line_count', v_count);
end;
$function$;

create function public.revise_inventory_request(
  p_request_id uuid, p_expected_revision integer, p_priority text,
  p_needed_at timestamptz, p_lines jsonb, p_expected jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_actor uuid := public.inventory_request_manager_required();
  v_doc public.inventory_request_documents%rowtype;
  v_item public.inventory_items%rowtype;
  v_line jsonb;
  v_expected jsonb;
  v_snapshot jsonb;
  v_revision integer;
  v_now timestamptz := now();
  v_issuer_name text;
  v_proposal_line jsonb;
  v_suggested numeric;
begin
  select * into v_doc from public.inventory_request_documents where id = p_request_id for update;
  if not found or v_doc.status <> 'issued' or v_doc.current_revision <> p_expected_revision
     or exists (select 1 from public.receiving_reports where inventory_request_id = p_request_id)
     or p_priority not in ('emergency', 'priority', 'scheduled') or p_needed_at <= v_now
     or jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) = 0 then
    raise exception 'Current undelivered request and complete revision required.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('inventory_request_issue'));
  perform 1 from public.inventory_items
    where id in (select (value->>'inventory_item_id')::uuid from jsonb_array_elements(p_lines))
    order by id for share;
  v_expected := public.get_inventory_request_proposal(p_needed_at);
  if p_expected is distinct from v_expected then
    raise exception 'Stock or outstanding requests changed. Review latest suggestions.' using errcode = '40001';
  end if;
  delete from public.inventory_request_lines where request_id = p_request_id;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    select * into v_item from public.inventory_items
      where id = (v_line->>'inventory_item_id')::uuid and is_active for share;
    if not found or (v_line->>'quantity') is null
       or (v_line->>'quantity')::numeric <= 0
       or (v_line->>'quantity')::numeric in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
       or (v_line->>'quantity')::numeric <> round((v_line->>'quantity')::numeric, v_item.quantity_scale)
       or (v_line->>'quantity')::numeric > 999999999.999 then
      raise exception 'Invalid revision item or quantity.' using errcode = '22023';
    end if;
    select value into v_proposal_line from jsonb_array_elements(v_expected)
      where value->>'id' = v_item.id::text;
    v_suggested := greatest((v_proposal_line->>'reorder_level')::numeric
      - (v_proposal_line->>'valid_at_need')::numeric
      - (v_proposal_line->>'outstanding')::numeric, 0);
    if (v_line->>'quantity')::numeric <> v_suggested
       and nullif(btrim(v_line->>'override_reason'), '') is null then
      raise exception 'Explain a revised quantity that differs from the provisional gap.' using errcode = '22023';
    end if;
    insert into public.inventory_request_lines
      (request_id, inventory_item_id, item_name, requested_unit, quantity_scale,
       requested_quantity, recommendation, override_reason)
    values (p_request_id, v_item.id, v_item.item_name, v_item.unit, v_item.quantity_scale,
      (v_line->>'quantity')::numeric,
      v_proposal_line,
      nullif(btrim(v_line->>'override_reason'), ''));
  end loop;
  v_revision := p_expected_revision + 1;
  select concat_ws(' ', first_name, last_name) into v_issuer_name
    from public.profiles where id = v_actor;
  update public.inventory_request_documents set current_revision = v_revision,
    priority = p_priority, needed_at = p_needed_at, issue_input = p_lines
    where id = p_request_id;
  select jsonb_build_object('number', v_doc.request_number, 'revision', v_revision,
    'issued_at', v_now, 'issued_by', v_actor, 'issued_by_name', v_issuer_name,
    'priority', p_priority,
    'needed_at', p_needed_at, 'destination', 'Production',
    'lines', coalesce(jsonb_agg(jsonb_build_object('inventory_item_id', l.inventory_item_id,
      'name', l.item_name, 'unit', l.requested_unit, 'quantity', l.requested_quantity)
      order by l.item_name), '[]'::jsonb)) into v_snapshot
  from public.inventory_request_lines l where l.request_id = p_request_id;
  insert into public.inventory_request_revisions(request_id, revision, snapshot, issued_by, issued_at)
    values (p_request_id, v_revision, v_snapshot, v_actor, v_now);
  insert into public.inventory_request_events(request_id, revision, event_type, actor_id)
    values (p_request_id, v_revision, 'revised', v_actor);
  return jsonb_build_object('id', p_request_id, 'request_number', v_doc.request_number,
    'revision', v_revision);
end;
$function$;


-- Keep prior deployed clients functional during application rollout.
-- Their Reason is retained in revision JSON only.
create or replace function public.issue_inventory_request(
  p_request_id uuid, p_priority text, p_needed_at timestamptz,
  p_reason text, p_lines jsonb, p_expected jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  v_result jsonb;
  v_prior_reason text;
  v_exists boolean;
begin
  perform public.inventory_request_manager_required();
  if nullif(btrim(p_reason), '') is null then
    raise exception 'Complete request header and lines required.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('inventory_request_issue'));
  select true, r.snapshot->>'reason' into v_exists, v_prior_reason
    from public.inventory_request_documents d
    join public.inventory_request_revisions r
      on r.request_id = d.id and r.revision = 1
    where d.id = p_request_id;
  if coalesce(v_exists, false) and v_prior_reason is distinct from btrim(p_reason) then
    raise exception 'Request ID reused with different details.' using errcode = '22023';
  end if;
  v_result := public.issue_inventory_request(
    p_request_id, p_priority, p_needed_at, p_lines, p_expected
  );
  if not coalesce(v_exists, false) then
    update public.inventory_request_revisions
      set snapshot = jsonb_set(snapshot, '{reason}', to_jsonb(btrim(p_reason)), true)
      where request_id = p_request_id and revision = 1;
  end if;
  return v_result;
end;
$function$;

create or replace function public.revise_inventory_request(
  p_request_id uuid, p_expected_revision integer, p_priority text,
  p_needed_at timestamptz, p_reason text, p_lines jsonb, p_expected jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_result jsonb;
begin
  perform public.inventory_request_manager_required();
  if nullif(btrim(p_reason), '') is null then
    raise exception 'Current undelivered request and complete revision required.' using errcode = '22023';
  end if;
  v_result := public.revise_inventory_request(
    p_request_id, p_expected_revision, p_priority, p_needed_at, p_lines, p_expected
  );
  update public.inventory_request_revisions
    set snapshot = jsonb_set(snapshot, '{reason}', to_jsonb(btrim(p_reason)), true)
    where request_id = p_request_id and revision = (v_result->>'revision')::integer;
  return v_result;
end;
$function$;

create or replace function public.get_inventory_request_register()
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare v_result jsonb;
begin
  perform public.inventory_request_manager_required();
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id, 'number', d.request_number, 'revision', d.current_revision,
    'status', d.status, 'priority', d.priority, 'needed_at', d.needed_at,
    'reason', coalesce((select r.snapshot->>'reason' from public.inventory_request_revisions r
      where r.request_id = d.id and r.revision = d.current_revision), ''),
    'issued_at', d.issued_at,
    'issued_by_name', concat_ws(' ', p.first_name, p.last_name),
    'close_reason', d.close_reason,
    'snapshot', (select snapshot from public.inventory_request_revisions
      where request_id = d.id and revision = d.current_revision),
    'revisions', (select coalesce(jsonb_agg(jsonb_build_object('revision', r.revision,
      'snapshot', r.snapshot) order by r.revision), '[]'::jsonb)
      from public.inventory_request_revisions r where r.request_id = d.id),
    'lines', (select coalesce(jsonb_agg(jsonb_build_object(
      'inventory_item_id', l.inventory_item_id, 'name', l.item_name, 'unit', l.requested_unit,
      'quantity', l.requested_quantity, 'accepted', coalesce(a.accepted, 0),
      'rejected', coalesce(a.rejected, 0),
      'remaining', greatest(l.requested_quantity - coalesce(a.accepted, 0), 0)
    ) order by l.item_name), '[]'::jsonb) from public.inventory_request_lines l
      left join lateral (select sum(ri.quantity_accepted) accepted, sum(ri.quantity_rejected) rejected
        from public.receiving_reports rr join public.receiving_report_items ri on ri.receiving_report_id = rr.id
        where rr.inventory_request_id = d.id and rr.status = 'posted'
          and ri.inventory_item_id = l.inventory_item_id) a on true where l.request_id = d.id),
    'receipts', (select coalesce(jsonb_agg(jsonb_build_object('id', rr.id,
      'number', rr.rr_number, 'status', rr.status, 'inspector', rr.inspected_by_name,
      'posted_at', rr.posted_at) order by rr.received_at), '[]'::jsonb)
      from public.receiving_reports rr where rr.inventory_request_id = d.id),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('type', e.event_type,
      'revision', e.revision, 'at', e.recorded_at,
      'actor', concat_ws(' ', ep.first_name, ep.last_name), 'details', e.details)
      order by e.id), '[]'::jsonb) from public.inventory_request_events e
      join public.profiles ep on ep.id = e.actor_id where e.request_id = d.id)
  ) order by d.issued_at desc), '[]'::jsonb) into v_result
  from public.inventory_request_documents d join public.profiles p on p.id = d.issued_by;
  return v_result;
end;
$function$;


-- New overloads have PUBLIC EXECUTE by default until explicitly revoked.
revoke all on function
  public.issue_inventory_request(uuid,text,timestamptz,jsonb,jsonb),
  public.revise_inventory_request(uuid,integer,text,timestamptz,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function
  public.issue_inventory_request(uuid,text,timestamptz,jsonb,jsonb),
  public.revise_inventory_request(uuid,integer,text,timestamptz,jsonb,jsonb)
  to authenticated, service_role;

-- RESTRICT is intentional: unreviewed SQL dependencies stop the transaction.
alter table public.inventory_request_documents
  drop constraint inventory_request_documents_reason_check;
alter table public.inventory_request_documents
  drop column reason restrict;

commit;
