-- New Production deliveries use an issued formal request. A Manager may
-- record an explicitly identified emergency exception. Existing receipts and
-- Phase 7B request history are left in place.
begin;

alter table public.receiving_reports
  add column emergency_reason text,
  add column emergency_authorized_by uuid references public.profiles(id),
  add column emergency_authorized_at timestamptz,
  add column emergency_inspected_by_name text,
  add constraint receiving_emergency_evidence_chk check (
    (emergency_reason is null and emergency_authorized_by is null
      and emergency_authorized_at is null and emergency_inspected_by_name is null)
    or
    (source_type = 'production_team' and inventory_request_id is null
      and replenishment_request_id is null and purchase_order_id is null
      and nullif(btrim(emergency_reason), '') is not null
      and emergency_authorized_by is not null and emergency_authorized_at is not null
      and nullif(btrim(emergency_inspected_by_name), '') is not null)
  );

create function public.guard_production_delivery_policy()
returns trigger language plpgsql set search_path = '' as $function$
begin
  if tg_op = 'DELETE' then
    if old.emergency_authorized_by is not null then
      raise exception 'Emergency authorization evidence cannot be deleted.' using errcode = '42501';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if old.emergency_authorized_by is not null and (
      new.emergency_reason is distinct from old.emergency_reason or
      new.emergency_authorized_by is distinct from old.emergency_authorized_by or
      new.emergency_authorized_at is distinct from old.emergency_authorized_at or
      new.emergency_inspected_by_name is distinct from old.emergency_inspected_by_name or
      new.source_type is distinct from old.source_type or
      new.inventory_request_id is distinct from old.inventory_request_id or
      new.replenishment_request_id is distinct from old.replenishment_request_id
    ) then
      raise exception 'Emergency authorization evidence is immutable.' using errcode = '42501';
    end if;
    if old.emergency_authorized_by is null and new.emergency_authorized_by is not null then
      raise exception 'An existing receipt cannot gain emergency authorization.' using errcode = '42501';
    end if;
    -- Historical unlinked drafts may still be edited and posted. The new-write
    -- rule applies at creation and does not relabel their provenance.
    return new;
  end if;
  if new.source_type = 'production_team'
     and new.inventory_request_id is null
     and new.replenishment_request_id is null then
    if new.emergency_authorized_by is null
       or new.emergency_authorized_by is distinct from auth.uid()
       or not exists (select 1 from public.profiles p
                      where p.id = auth.uid() and p.role::text = 'manager' and p.is_active)
    then
      raise exception 'New Production Receiving requires an issued formal request or an authorized Manager emergency exception.'
        using errcode = '42501';
    end if;
    -- A caller cannot backdate or future-date the authorization evidence.
    new.emergency_authorized_at := now();
  end if;
  return new;
end;
$function$;
create trigger receiving_production_delivery_policy
before insert or update or delete on public.receiving_reports
for each row execute function public.guard_production_delivery_policy();

-- The old queue remains readable and can finish historical requests, but can
-- no longer issue a new competing normal request through the client RPC.
revoke execute on function public.create_replenishment_request(
  uuid, uuid, numeric, timestamptz, text, text) from authenticated;

create function public.create_emergency_production_receiving(
  p_report_id uuid, p_received_at timestamptz, p_source_reference text,
  p_notes text, p_reason text, p_inspected_by_name text
) returns jsonb language plpgsql security definer
set search_path = '' as $function$
declare
  v_actor uuid := auth.uid();
  v_report public.receiving_reports%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
  v_inspector text := nullif(btrim(p_inspected_by_name), '');
  v_reference text := nullif(btrim(p_source_reference), '');
  v_notes text := nullif(btrim(p_notes), '');
begin
  if not exists (select 1 from public.profiles p where p.id = v_actor
                 and p.role::text = 'manager' and p.is_active) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;
  if p_report_id is null or p_received_at is null or v_reason is null or v_inspector is null then
    raise exception 'Emergency reason, inspector, report ID, and received time are required.'
      using errcode = '22023';
  end if;
  select * into v_report from public.receiving_reports where id = p_report_id for update;
  if found then
    if v_report.source_type <> 'production_team'
       or v_report.emergency_authorized_by is distinct from v_actor
       or v_report.emergency_reason is distinct from v_reason
       or v_report.emergency_inspected_by_name is distinct from v_inspector
       or v_report.source_reference is distinct from v_reference
       or v_report.received_at is distinct from p_received_at
       or v_report.notes is distinct from v_notes then
      raise exception 'Emergency report ID was reused with different details.' using errcode = '22023';
    end if;
  else
    insert into public.receiving_reports (
      id, rr_number, source_type, source_reference, received_at, received_by,
      notes, emergency_reason, emergency_authorized_by,
      emergency_authorized_at, emergency_inspected_by_name
    ) values (
      p_report_id,
      'RR-' || to_char(p_received_at at time zone 'Asia/Manila', 'YYYYMMDD') || '-'
        || upper(substr(replace(p_report_id::text, '-', ''), 1, 8)),
      'production_team', v_reference, p_received_at, v_actor,
      v_notes, v_reason, v_actor, now(), v_inspector
    ) returning * into v_report;
  end if;
  return jsonb_build_object('id', v_report.id, 'rr_number', v_report.rr_number,
                            'status', v_report.status);
end;
$function$;
revoke all on function public.create_emergency_production_receiving(
  uuid, timestamptz, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_emergency_production_receiving(
  uuid, timestamptz, text, text, text, text) to authenticated;

create function public.get_receiving_policy_evidence(p_report_id uuid)
returns jsonb language plpgsql stable security definer
set search_path = '' as $function$
declare v_result jsonb;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid()
                 and p.role::text = 'manager' and p.is_active) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'classification', case
      when r.source_type = 'direct_supplier' then 'direct_supplier'
      when r.inventory_request_id is not null then 'formal_request'
      when r.replenishment_request_id is not null then 'historical_legacy_request'
      when r.emergency_authorized_by is not null then 'manager_emergency'
      else 'historical_unlinked' end,
    'reason', r.emergency_reason,
    'authorized_by', r.emergency_authorized_by,
    'authorized_by_name', nullif(concat_ws(' ', p.first_name, p.last_name), ''),
    'authorized_at', r.emergency_authorized_at,
    'inspected_by_name', coalesce(r.emergency_inspected_by_name, r.inspected_by_name),
    'inspection_note', r.inspection_note
  ) into v_result from public.receiving_reports r
  left join public.profiles p on p.id = r.emergency_authorized_by
  where r.id = p_report_id;
  if v_result is null then
    raise exception 'Receiving report not found.' using errcode = 'P0002';
  end if;
  return v_result;
end;
$function$;
revoke all on function public.get_receiving_policy_evidence(uuid)
  from public, anon, authenticated;
grant execute on function public.get_receiving_policy_evidence(uuid) to authenticated;

create function public.get_receiving_policy_classes(p_report_ids uuid[])
returns jsonb language plpgsql stable security definer
set search_path = '' as $function$
declare v_result jsonb;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid()
                 and p.role::text = 'manager' and p.is_active) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_report_ids), 0) > 100 then
    raise exception 'Too many receiving documents requested.' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id,
    'classification', case
      when r.source_type = 'direct_supplier' then 'direct_supplier'
      when r.inventory_request_id is not null then 'formal_request'
      when r.replenishment_request_id is not null then 'historical_legacy_request'
      when r.emergency_authorized_by is not null then 'manager_emergency'
      else 'historical_unlinked' end)), '[]'::jsonb)
  into v_result from public.receiving_reports r where r.id = any(p_report_ids);
  return v_result;
end;
$function$;
revoke all on function public.get_receiving_policy_classes(uuid[])
  from public, anon, authenticated;
grant execute on function public.get_receiving_policy_classes(uuid[]) to authenticated;

-- Existing generic posting writes a generic ledger reason. Classify the new
-- receiving movement at insertion without changing the stock mutation logic.
create function public.label_receiving_movement_origin()
returns trigger language plpgsql set search_path = '' as $function$
declare v_report public.receiving_reports%rowtype;
begin
  if new.transaction_type::text <> 'receiving' or new.inventory_batch_id is null then
    return new;
  end if;
  select r.* into v_report
  from public.inventory_batches b
  join public.receiving_report_items line on line.id = b.receiving_report_item_id
  join public.receiving_reports r on r.id = line.receiving_report_id
  where b.id = new.inventory_batch_id;
  if not found then return new; end if;
  new.reason := case
    when v_report.source_type = 'direct_supplier' then 'Direct-supplier receiving report '
    when v_report.inventory_request_id is not null then 'Formal request receiving report '
    when v_report.replenishment_request_id is not null then 'Historical Production request receiving report '
    when v_report.emergency_authorized_by is not null then 'Manager emergency receiving report '
    else 'Historical unlinked Production receiving report ' end
    || v_report.rr_number;
  return new;
end;
$function$;
create trigger inventory_receiving_origin_reason
before insert on public.inventory_transactions
for each row execute function public.label_receiving_movement_origin();

commit;
