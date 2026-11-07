-- Remove optional general receiving and purchase order notes. Preserve lot, rejection, inspection and ledger evidence.

drop function public.create_receiving_report_draft(uuid,text,text,uuid,timestamptz,text,text);

drop function public.save_receiving_report_item(uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,text,text,date,date,text);

drop function public.update_receiving_report_draft(uuid,text,text,uuid,timestamptz,text,text);

drop function public.create_emergency_production_receiving(uuid,timestamptz,text,text,text,text);

alter table public.receiving_reports drop column notes;

alter table public.receiving_report_items drop column notes;

-- The earlier six-table retirement removes this table in consolidated replay.
-- Preserve standalone application against a pre-retirement schema.
alter table if exists public.purchase_orders drop column if exists notes;

CREATE OR REPLACE FUNCTION public.create_receiving_report_draft(p_request_id uuid, p_source_type text, p_source_reference text, p_purchase_order_id uuid, p_received_at timestamp with time zone, p_supplier_delivery_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_actor_id uuid := auth.uid();
  v_existing public.receiving_reports%rowtype;
  v_report public.receiving_reports%rowtype;
  v_source_reference text := nullif(btrim(p_source_reference), '');
  v_supplier_delivery_reference text := nullif(btrim(p_supplier_delivery_reference), '');
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles profile
    where profile.id = v_actor_id
      and profile.role = 'manager'::public.user_role
      and profile.is_active = true
  ) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;

  if p_request_id is null then
    raise exception 'Draft request ID is required.' using errcode = '22023';
  end if;

  if p_received_at is null then
    raise exception 'Received date and time are required.' using errcode = '22023';
  end if;

  if p_source_type <> 'production_team' or p_purchase_order_id is not null
     or v_supplier_delivery_reference is not null then
    raise exception 'Only Production Team receiving without a purchase order is supported.' using errcode = '22023';
  end if;

  select report.* into v_existing
  from public.receiving_reports report
  where report.id = p_request_id
  for update;

  if found then
    if v_existing.status <> 'draft' or v_existing.received_by <> v_actor_id then
      raise exception 'Draft request ID has already been used.' using errcode = '23505';
    end if;

    if v_existing.source_type is distinct from p_source_type
       or v_existing.source_reference is distinct from v_source_reference
       or v_existing.purchase_order_id is distinct from p_purchase_order_id
       or v_existing.received_at is distinct from p_received_at
       or v_existing.supplier_delivery_reference is distinct from v_supplier_delivery_reference
    then
      raise exception 'Draft request ID was reused with different details.' using errcode = '22023';
    end if;

    v_report := v_existing;
  else
    insert into public.receiving_reports (
      id,
      rr_number,
      source_type,
      source_reference,
      purchase_order_id,
      received_at,
      received_by,
      supplier_delivery_reference
    )
    values (
      p_request_id,
      'RR-' || to_char(p_received_at at time zone 'Asia/Manila', 'YYYYMMDD') || '-' ||
        upper(substr(replace(p_request_id::text, '-', ''), 1, 8)),
      p_source_type,
      v_source_reference,
      p_purchase_order_id,
      p_received_at,
      v_actor_id,
      v_supplier_delivery_reference
    )
    returning * into v_report;
  end if;

  return jsonb_build_object(
    'id', v_report.id,
    'rr_number', v_report.rr_number,
    'status', v_report.status,
    'source_type', v_report.source_type,
    'created_at', v_report.created_at
  );
end;
$function$;

revoke all on function public.create_receiving_report_draft(uuid,text,text,uuid,timestamptz,text) from public, anon;

grant execute on function public.create_receiving_report_draft(uuid,text,text,uuid,timestamptz,text) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_manager_receiving_workspace(p_receiving_report_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_actor_id uuid := auth.uid();
  v_selected_report jsonb;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = v_actor_id
      and profile.role = 'manager'::public.user_role
      and profile.is_active = true
  ) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;

  if p_receiving_report_id is not null
     and not exists (
       select 1
       from public.receiving_reports report
       where report.id = p_receiving_report_id
     )
  then
    raise exception 'Receiving report not found.' using errcode = 'P0002';
  end if;

  if p_receiving_report_id is not null then
    select jsonb_build_object(
      'id', report.id,
      'rr_number', report.rr_number,
      'source_type', report.source_type,
      'source_reference', report.source_reference,
      'purchase_order_id', report.purchase_order_id,
      'purchase_order_number', null,
      'supplier_id', null,
      'supplier_name', null,
      'received_at', report.received_at,
      'received_by', report.received_by,
      'received_by_name', concat_ws(' ', receiver.first_name, receiver.last_name),
      'status', report.status,
      'supplier_delivery_reference', report.supplier_delivery_reference,
      'posted_at', report.posted_at,
      'posted_by', report.posted_by,
      'posted_by_name', nullif(concat_ws(' ', poster.first_name, poster.last_name), ''),
      'created_at', report.created_at,
      'updated_at', report.updated_at,
      'items', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', report_item.id,
            'inventory_item_id', inventory_item.id,
            'inventory_item_name', inventory_item.item_name,
            'unit', inventory_item.unit,
            'secondary_unit', inventory_item.secondary_unit,
            'expiry_required', inventory_item.expiry_required,
            'rotation_policy', inventory_item.rotation_policy,
            'purchase_order_item_id', report_item.purchase_order_item_id,
            'quantity_ordered', null,
            'quantity_received', null,
            'quantity_cancelled', null,
            'quantity_remaining', null,
            'secondary_quantity_ordered', null,
            'secondary_quantity_received', null,
            'quantity_delivered', report_item.quantity_delivered,
            'quantity_accepted', report_item.quantity_accepted,
            'quantity_rejected', report_item.quantity_rejected,
            'secondary_quantity_delivered', report_item.secondary_quantity_delivered,
            'secondary_quantity_accepted', report_item.secondary_quantity_accepted,
            'secondary_quantity_rejected', report_item.secondary_quantity_rejected,
            'rejection_reason', report_item.rejection_reason,
            'source_lot_code', report_item.source_lot_code,
            'manufactured_on', report_item.manufactured_on,
            'use_by_date', report_item.use_by_date,
            'batch_id', batch.id,
            'batch_code', batch.batch_code,
            'created_at', report_item.created_at,
            'updated_at', report_item.updated_at
          )
          order by report_item.created_at, report_item.id
        )
        from public.receiving_report_items report_item
        join public.inventory_items inventory_item
          on inventory_item.id = report_item.inventory_item_id
        left join public.inventory_batches batch
          on batch.receiving_report_item_id = report_item.id
        where report_item.receiving_report_id = report.id
      ), '[]'::jsonb)
    )
    into v_selected_report
    from public.receiving_reports report
    join public.profiles receiver
      on receiver.id = report.received_by
    left join public.profiles poster
      on poster.id = report.posted_by
    where report.id = p_receiving_report_id;
  end if;

  return jsonb_build_object(
    'reports', coalesce((
      select jsonb_agg(report_summary.payload order by report_summary.sort_draft desc, report_summary.sort_at desc)
      from (
        select
          report.status = 'draft' as sort_draft,
          report.received_at as sort_at,
          jsonb_build_object(
            'id', report.id,
            'rr_number', report.rr_number,
            'source_type', report.source_type,
            'source_reference', report.source_reference,
            'purchase_order_id', report.purchase_order_id,
            'purchase_order_number', null,
            'supplier_name', null,
            'received_at', report.received_at,
            'status', report.status,
            'posted_at', report.posted_at,
            'line_count', (
              select count(*)
              from public.receiving_report_items report_item
              where report_item.receiving_report_id = report.id
            ),
            'total_delivered', coalesce((
              select sum(report_item.quantity_delivered)
              from public.receiving_report_items report_item
              where report_item.receiving_report_id = report.id
            ), 0),
            'total_accepted', coalesce((
              select sum(report_item.quantity_accepted)
              from public.receiving_report_items report_item
              where report_item.receiving_report_id = report.id
            ), 0),
            'total_rejected', coalesce((
              select sum(report_item.quantity_rejected)
              from public.receiving_report_items report_item
              where report_item.receiving_report_id = report.id
            ), 0),
            'updated_at', report.updated_at
          ) as payload
        from public.receiving_reports report
        order by (report.status = 'draft') desc, report.received_at desc
        limit 100
      ) report_summary
    ), '[]'::jsonb),
    'selected_report', v_selected_report,
    'inventory_items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', inventory_item.id,
          'item_name', inventory_item.item_name,
          'unit', inventory_item.unit,
          'secondary_unit', inventory_item.secondary_unit,
          'quantity_on_hand', inventory_item.quantity_on_hand,
          'quantity_scale', inventory_item.quantity_scale,
          'rotation_policy', inventory_item.rotation_policy,
          'expiry_required', inventory_item.expiry_required
        )
        order by inventory_item.item_name
      )
      from public.inventory_items inventory_item
      where inventory_item.is_active = true
    ), '[]'::jsonb),
    'purchase_orders', '[]'::jsonb
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_receiving_report_item(p_receiving_report_id uuid, p_receiving_report_item_id uuid, p_inventory_item_id uuid, p_purchase_order_item_id uuid, p_quantity_delivered numeric, p_quantity_accepted numeric, p_secondary_quantity_delivered numeric, p_secondary_quantity_accepted numeric, p_rejection_reason text, p_source_lot_code text, p_manufactured_on date, p_use_by_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_actor_id uuid := auth.uid();
  v_report public.receiving_reports%rowtype;
  v_existing public.receiving_report_items%rowtype;
  v_item_id uuid;
  v_item_name text;
  v_secondary_unit text;
  v_quantity_scale smallint;
  v_rejection_reason text := nullif(btrim(p_rejection_reason), '');
  v_source_lot_code text := nullif(btrim(p_source_lot_code), '');
  v_saved public.receiving_report_items%rowtype;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles profile
    where profile.id = v_actor_id
      and profile.role = 'manager'::public.user_role
      and profile.is_active = true
  ) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;

  if p_receiving_report_item_id is null then
    raise exception 'Receiving line request ID is required.' using errcode = '22023';
  end if;

  select report.* into v_report
  from public.receiving_reports report
  where report.id = p_receiving_report_id
  for update;

  if not found then
    raise exception 'Receiving report not found.' using errcode = 'P0002';
  end if;

  if v_report.status <> 'draft' then
    raise exception 'Only draft receiving reports can be edited.' using errcode = '22023';
  end if;

  select report_item.* into v_existing
  from public.receiving_report_items report_item
  where report_item.id = p_receiving_report_item_id
  for update;

  if found and v_existing.receiving_report_id <> v_report.id then
    raise exception 'Receiving line request ID belongs to another report.' using errcode = '23505';
  end if;

  if p_quantity_delivered is null
     or p_quantity_delivered in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
     or p_quantity_delivered <= 0
     or p_quantity_accepted is null
     or p_quantity_accepted in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
     or p_quantity_accepted < 0
     or p_quantity_accepted > p_quantity_delivered
  then
    raise exception 'Delivered and accepted quantities are invalid.' using errcode = '22023';
  end if;

  if v_report.source_type <> 'production_team' or p_purchase_order_item_id is not null
     or p_inventory_item_id is null then
    raise exception 'Production Team lines require an inventory item and cannot reference a PO item.' using errcode = '22023';
  end if;

  select inventory_item.id, inventory_item.item_name,
         inventory_item.secondary_unit, inventory_item.quantity_scale
  into v_item_id, v_item_name, v_secondary_unit, v_quantity_scale
  from public.inventory_items inventory_item
  where inventory_item.id = p_inventory_item_id and inventory_item.is_active = true;

  if v_item_id is null then
    raise exception 'Receiving line inventory item was not found or is inactive.' using errcode = 'P0002';
  end if;

  if not public.inventory_quantity_matches_scale(p_quantity_delivered, v_quantity_scale)
     or not public.inventory_quantity_matches_scale(p_quantity_accepted, v_quantity_scale)
  then
    raise exception 'Receiving base quantities exceed quantity_scale %.', v_quantity_scale using errcode = '22023';
  end if;

  if v_secondary_unit is null then
    if p_secondary_quantity_delivered is not null
       or p_secondary_quantity_accepted is not null
    then
      raise exception 'Secondary quantities are not allowed for this inventory item.' using errcode = '22023';
    end if;
  else
    if p_secondary_quantity_delivered is null
       or p_secondary_quantity_accepted is null
       or p_secondary_quantity_delivered in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
       or p_secondary_quantity_delivered <= 0
       or p_secondary_quantity_accepted in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
       or p_secondary_quantity_accepted < 0
       or p_secondary_quantity_accepted > p_secondary_quantity_delivered
       or ((p_quantity_accepted = 0) <> (p_secondary_quantity_accepted = 0))
    then
      raise exception 'Independent secondary receiving quantities are invalid.' using errcode = '22023';
    end if;
  end if;

  if (
    p_quantity_delivered - p_quantity_accepted > 0
    or coalesce(p_secondary_quantity_delivered - p_secondary_quantity_accepted, 0) > 0
  ) and v_rejection_reason is null then
    raise exception 'Rejection reason is required when any quantity is rejected.' using errcode = '22023';
  end if;

  insert into public.receiving_report_items (
    id,
    receiving_report_id,
    inventory_item_id,
    purchase_order_item_id,
    quantity_delivered,
    quantity_accepted,
    secondary_quantity_delivered,
    secondary_quantity_accepted,
    rejection_reason,
    source_lot_code,
    manufactured_on,
    use_by_date
  ) values (
    p_receiving_report_item_id,
    v_report.id,
    p_inventory_item_id,
    p_purchase_order_item_id,
    p_quantity_delivered,
    p_quantity_accepted,
    p_secondary_quantity_delivered,
    p_secondary_quantity_accepted,
    v_rejection_reason,
    v_source_lot_code,
    p_manufactured_on,
    p_use_by_date
  )
  on conflict (id) do update
  set
    inventory_item_id = excluded.inventory_item_id,
    purchase_order_item_id = excluded.purchase_order_item_id,
    quantity_delivered = excluded.quantity_delivered,
    quantity_accepted = excluded.quantity_accepted,
    secondary_quantity_delivered = excluded.secondary_quantity_delivered,
    secondary_quantity_accepted = excluded.secondary_quantity_accepted,
    rejection_reason = excluded.rejection_reason,
    source_lot_code = excluded.source_lot_code,
    manufactured_on = excluded.manufactured_on,
    use_by_date = excluded.use_by_date
  returning * into v_saved;

  return jsonb_build_object(
    'id', v_saved.id,
    'receiving_report_id', v_saved.receiving_report_id,
    'inventory_item_id', v_item_id,
    'inventory_item_name', v_item_name,
    'quantity_delivered', v_saved.quantity_delivered,
    'quantity_accepted', v_saved.quantity_accepted,
    'quantity_rejected', v_saved.quantity_rejected,
    'use_by_date', v_saved.use_by_date,
    'updated_at', v_saved.updated_at
  );
end;
$function$;

revoke all on function public.save_receiving_report_item(uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,text,text,date,date) from public, anon;

grant execute on function public.save_receiving_report_item(uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,text,text,date,date) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_receiving_report_draft(p_receiving_report_id uuid, p_source_type text, p_source_reference text, p_purchase_order_id uuid, p_received_at timestamp with time zone, p_supplier_delivery_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_actor_id uuid := auth.uid();
  v_report public.receiving_reports%rowtype;
  v_source_reference text := nullif(btrim(p_source_reference), '');
  v_supplier_delivery_reference text := nullif(btrim(p_supplier_delivery_reference), '');
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles profile
    where profile.id = v_actor_id
      and profile.role = 'manager'::public.user_role
      and profile.is_active = true
  ) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;

  select report.* into v_report
  from public.receiving_reports report
  where report.id = p_receiving_report_id
  for update;

  if not found then
    raise exception 'Receiving report not found.' using errcode = 'P0002';
  end if;

  if v_report.status <> 'draft' then
    raise exception 'Only draft receiving reports can be edited.' using errcode = '22023';
  end if;

  if p_received_at is null then
    raise exception 'Received date and time are required.' using errcode = '22023';
  end if;

  if p_source_type <> 'production_team' or p_purchase_order_id is not null
     or v_supplier_delivery_reference is not null then
    raise exception 'Only Production Team receiving without a purchase order is supported.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.receiving_report_items report_item
    where report_item.receiving_report_id = v_report.id
  ) and (
    v_report.source_type is distinct from p_source_type
    or v_report.purchase_order_id is distinct from p_purchase_order_id
  ) then
    raise exception 'Remove existing lines before changing the draft source or purchase order.'
      using errcode = '22023';
  end if;

   update public.receiving_reports report
  set
    source_type = p_source_type,
    source_reference = v_source_reference,
    purchase_order_id = p_purchase_order_id,
    received_at = p_received_at,
    supplier_delivery_reference = v_supplier_delivery_reference
  where report.id = v_report.id
  returning * into v_report;

  return jsonb_build_object(
    'id', v_report.id,
    'rr_number', v_report.rr_number,
    'status', v_report.status,
    'source_type', v_report.source_type,
    'updated_at', v_report.updated_at
  );
end;
$function$;

revoke all on function public.update_receiving_report_draft(uuid,text,text,uuid,timestamptz,text) from public, anon;

grant execute on function public.update_receiving_report_draft(uuid,text,text,uuid,timestamptz,text) to authenticated, service_role;

create function public.create_emergency_production_receiving(
  p_report_id uuid, p_received_at timestamptz, p_source_reference text,
  p_reason text, p_inspected_by_name text
) returns jsonb language plpgsql security definer
set search_path = '' as $function$
declare
  v_actor uuid := auth.uid();
  v_report public.receiving_reports%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
  v_inspector text := nullif(btrim(p_inspected_by_name), '');
  v_reference text := nullif(btrim(p_source_reference), '');
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
       or v_report.received_at is distinct from p_received_at then
      raise exception 'Emergency report ID was reused with different details.' using errcode = '22023';
    end if;
  else
    insert into public.receiving_reports (
      id, rr_number, source_type, source_reference, received_at, received_by,
      emergency_reason, emergency_authorized_by,
      emergency_authorized_at, emergency_inspected_by_name
    ) values (
      p_report_id,
      'RR-' || to_char(p_received_at at time zone 'Asia/Manila', 'YYYYMMDD') || '-'
        || upper(substr(replace(p_report_id::text, '-', ''), 1, 8)),
      'production_team', v_reference, p_received_at, v_actor,
      v_reason, v_actor, now(), v_inspector
    ) returning * into v_report;
  end if;
  return jsonb_build_object('id', v_report.id, 'rr_number', v_report.rr_number,
                            'status', v_report.status);
end;
$function$;

revoke all on function public.create_emergency_production_receiving(uuid,timestamptz,text,text,text) from public, anon;

grant execute on function public.create_emergency_production_receiving(uuid,timestamptz,text,text,text) to authenticated, service_role;
