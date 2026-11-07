begin;

-- Positive physical-count corrections must not rewrite the batch's original
-- accepted/opening quantity. Keep their additional capacity separately.
alter table public.inventory_batches
  add column quantity_positive_adjustments numeric(12,3) not null default 0,
  drop constraint inventory_batches_quantity_on_hand_le_initial_chk,
  add constraint inventory_batches_positive_adjustments_nonneg_chk
    check (quantity_positive_adjustments <> 'NaN'::numeric
           and quantity_positive_adjustments >= 0),
  add constraint inventory_batches_quantity_on_hand_le_authorized_chk
    check (quantity_on_hand <= quantity_initial + quantity_positive_adjustments);

comment on column public.inventory_batches.quantity_positive_adjustments is
  'Cumulative positive, ledger-backed physical-count corrections; original quantity_initial remains provenance.';

-- These two fields retain the exact batch balance used for stale-count checks
-- and idempotent replay, while quantity_before/after remain aggregate balances.
alter table public.inventory_transactions
  add column batch_quantity_before numeric(12,3),
  add column batch_quantity_after numeric(12,3),
  add column batch_mutation_notes text,
  add constraint inventory_transactions_batch_notes_length_chk
    check (batch_mutation_notes is null or char_length(batch_mutation_notes) <= 300),
  add constraint inventory_transactions_batch_balance_pair_chk
    check ((batch_quantity_before is null) = (batch_quantity_after is null)),
  add constraint inventory_transactions_batch_balance_movement_chk
    check (batch_quantity_before is null or (
      inventory_batch_id is not null
      and transaction_type in ('waste'::public.inventory_transaction_type,
                               'adjustment'::public.inventory_transaction_type)
      and batch_quantity_before >= 0
      and batch_quantity_after >= 0
      and batch_quantity_after = batch_quantity_before + quantity_change
    ));

create function public.get_manager_inventory_batch_context()
returns table (
  inventory_item_id uuid,
  batch_consumption_enabled boolean,
  quantity_scale smallint,
  batches jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'manager'::public.user_role
      and profile.is_active = true
  ) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;

  return query
  select inventory_item.id,
         inventory_item.batch_consumption_enabled,
         inventory_item.quantity_scale,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'id', batch.id,
             'batch_code', batch.batch_code,
             'received_at', batch.received_at,
             'use_by_date', batch.use_by_date,
             'quantity_on_hand', batch.quantity_on_hand
           ) order by batch.received_at, batch.id)
           from public.inventory_batches batch
           where batch.inventory_item_id = inventory_item.id
         ), '[]'::jsonb)
  from public.inventory_items inventory_item
  order by inventory_item.item_name, inventory_item.id;
end;
$function$;

revoke all on function public.get_manager_inventory_batch_context()
  from public, anon;
grant execute on function public.get_manager_inventory_batch_context()
  to authenticated, service_role;

-- Shared internal mutation engine; public business RPCs below fix the semantic
-- transaction type, so callers cannot relabel waste as adjustment or vice versa.
create function public.mutate_inventory_batch_quantity(
  p_inventory_item_id uuid,
  p_inventory_batch_id uuid,
  p_quantity_change numeric,
  p_expected_batch_quantity numeric,
  p_reason text,
  p_notes text,
  p_request_id uuid,
  p_transaction_type public.inventory_transaction_type
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_item public.inventory_items%rowtype;
  v_batch public.inventory_batches%rowtype;
  v_existing public.inventory_transactions%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
  v_notes text := nullif(btrim(p_notes), '');
  v_after numeric;
  v_batch_after numeric;
  v_transaction_id uuid;
  v_now timestamptz := now();
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
  if p_transaction_type not in ('waste'::public.inventory_transaction_type,
                                'adjustment'::public.inventory_transaction_type) then
    raise exception 'Unsupported batch inventory movement.' using errcode = '22023';
  end if;
  if p_inventory_item_id is null or p_inventory_batch_id is null
     or p_request_id is null or p_expected_batch_quantity is null then
    raise exception 'Inventory item, physical batch, expected batch balance, and request ID are required.'
      using errcode = '22023';
  end if;
  if p_quantity_change is null
     or p_quantity_change in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
     or p_quantity_change = 0
     or (p_transaction_type = 'waste'::public.inventory_transaction_type
         and p_quantity_change > 0) then
    raise exception 'Batch movement quantity must be finite and nonzero; waste must decrease stock.'
      using errcode = '22023';
  end if;
  if v_reason is null or char_length(v_reason) > 300 then
    raise exception 'A reason of at most 300 characters is required.' using errcode = '22023';
  end if;
  if v_notes is not null and char_length(v_notes) > 300 then
    raise exception 'Batch mutation notes must not exceed 300 characters.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    v_actor_id::text || ':' || p_request_id::text, 0
  ));

  select transaction_record.* into v_existing
  from public.inventory_transactions transaction_record
  where transaction_record.performed_by = v_actor_id
    and transaction_record.mutation_request_id = p_request_id;

  if found then
    if v_existing.inventory_item_id is distinct from p_inventory_item_id
       or v_existing.inventory_batch_id is distinct from p_inventory_batch_id
       or v_existing.transaction_type is distinct from p_transaction_type
       or v_existing.quantity_change is distinct from p_quantity_change
       or v_existing.batch_quantity_before is distinct from p_expected_batch_quantity
       or v_existing.reason is distinct from v_reason
       or v_existing.batch_mutation_notes is distinct from v_notes then
      raise exception 'Inventory request ID was already used for a different stock mutation.'
        using errcode = '22023';
    end if;
    select inventory_item.* into v_item
    from public.inventory_items inventory_item
    where inventory_item.id = v_existing.inventory_item_id;
    return jsonb_build_object(
      'transaction_id', v_existing.id,
      'inventory_item_id', v_existing.inventory_item_id,
      'inventory_batch_id', v_existing.inventory_batch_id,
      'item_name', v_item.item_name,
      'unit', v_item.unit,
      'transaction_type', v_existing.transaction_type,
      'quantity_change', v_existing.quantity_change,
      'quantity_before', v_existing.quantity_before,
      'quantity_after', v_existing.quantity_after,
      'batch_quantity_before', v_existing.batch_quantity_before,
      'batch_quantity_after', v_existing.batch_quantity_after,
      'reason', v_existing.reason,
      'notes', v_existing.batch_mutation_notes,
      'performed_by', v_existing.performed_by,
      'created_at', v_existing.created_at
    );
  end if;

  select inventory_item.* into v_item
  from public.inventory_items inventory_item
  where inventory_item.id = p_inventory_item_id
  for update;
  if not found then
    raise exception 'Inventory item not found.' using errcode = 'P0002';
  end if;
  if not v_item.is_active or not v_item.batch_consumption_enabled then
    raise exception 'An active batch-enabled inventory item is required.' using errcode = '22023';
  end if;
  if not public.inventory_quantity_matches_scale(abs(p_quantity_change), v_item.quantity_scale)
     or not public.inventory_quantity_matches_scale(p_expected_batch_quantity, v_item.quantity_scale)
     or p_expected_batch_quantity < 0 then
    raise exception 'Batch quantity does not match inventory quantity_scale %.', v_item.quantity_scale
      using errcode = '22023';
  end if;

  -- All supported writers first lock the item row, then a physical batch.
  perform public.assert_batch_inventory_consistent(v_item.id);
  select batch.* into v_batch
  from public.inventory_batches batch
  where batch.id = p_inventory_batch_id
  for update;
  if not found then
    raise exception 'Inventory batch not found.' using errcode = 'P0002';
  end if;
  if v_batch.inventory_item_id <> v_item.id then
    raise exception 'Physical batch does not belong to the selected inventory item.'
      using errcode = '22023';
  end if;
  if v_batch.quantity_on_hand <> p_expected_batch_quantity then
    raise exception 'Batch stock changed. Refresh inventory and select the current physical balance.'
      using errcode = '22023';
  end if;

  v_batch_after := v_batch.quantity_on_hand + p_quantity_change;
  v_after := v_item.quantity_on_hand + p_quantity_change;
  if v_batch_after < 0 or v_after < 0 then
    raise exception 'Batch movement exceeds current physical stock. Refresh inventory.'
      using errcode = '22023';
  end if;

  update public.inventory_batches batch
  set quantity_on_hand = v_batch_after,
      quantity_positive_adjustments =
        batch.quantity_positive_adjustments + greatest(p_quantity_change, 0)
  where batch.id = v_batch.id;

  update public.inventory_items inventory_item
  set quantity_on_hand = v_after, updated_at = v_now
  where inventory_item.id = v_item.id;

  insert into public.inventory_transactions (
    inventory_item_id, inventory_batch_id, performed_by,
    transaction_type, quantity_change, quantity_before, quantity_after,
    batch_quantity_before, batch_quantity_after,
    reason, batch_mutation_notes, mutation_request_id, created_at
  ) values (
    v_item.id, v_batch.id, v_actor_id,
    p_transaction_type, p_quantity_change, v_item.quantity_on_hand, v_after,
    v_batch.quantity_on_hand, v_batch_after,
    v_reason, v_notes, p_request_id, v_now
  ) returning id into v_transaction_id;

  perform public.assert_batch_inventory_consistent(v_item.id);

  return jsonb_build_object(
    'transaction_id', v_transaction_id,
    'inventory_item_id', v_item.id,
    'inventory_batch_id', v_batch.id,
    'item_name', v_item.item_name,
    'unit', v_item.unit,
    'transaction_type', p_transaction_type,
    'quantity_change', p_quantity_change,
    'quantity_before', v_item.quantity_on_hand,
    'quantity_after', v_after,
    'batch_quantity_before', v_batch.quantity_on_hand,
    'batch_quantity_after', v_batch_after,
    'reason', v_reason,
    'notes', v_notes,
    'performed_by', v_actor_id,
    'created_at', v_now
  );
end;
$function$;

revoke all on function public.mutate_inventory_batch_quantity(
  uuid,uuid,numeric,numeric,text,text,uuid,public.inventory_transaction_type
) from public, anon, authenticated, service_role;

create function public.record_batch_inventory_waste(
  p_inventory_item_id uuid,
  p_inventory_batch_id uuid,
  p_quantity numeric,
  p_expected_batch_quantity numeric,
  p_reason text,
  p_request_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Waste quantity must be positive.' using errcode = '22023';
  end if;
  return public.mutate_inventory_batch_quantity(
    p_inventory_item_id, p_inventory_batch_id, -p_quantity,
    p_expected_batch_quantity, p_reason, p_notes, p_request_id,
    'waste'::public.inventory_transaction_type
  );
end;
$function$;

create function public.adjust_inventory_batch_stock(
  p_inventory_item_id uuid,
  p_inventory_batch_id uuid,
  p_quantity_change numeric,
  p_expected_batch_quantity numeric,
  p_reason text,
  p_request_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return public.mutate_inventory_batch_quantity(
    p_inventory_item_id, p_inventory_batch_id, p_quantity_change,
    p_expected_batch_quantity, p_reason, p_notes, p_request_id,
    'adjustment'::public.inventory_transaction_type
  );
end;
$function$;

revoke all on function public.record_batch_inventory_waste(
  uuid,uuid,numeric,numeric,text,uuid,text
) from public, anon;
revoke all on function public.adjust_inventory_batch_stock(
  uuid,uuid,numeric,numeric,text,uuid,text
) from public, anon;
grant execute on function public.record_batch_inventory_waste(
  uuid,uuid,numeric,numeric,text,uuid,text
) to authenticated, service_role;
grant execute on function public.adjust_inventory_batch_stock(
  uuid,uuid,numeric,numeric,text,uuid,text
) to authenticated, service_role;

comment on function public.record_batch_inventory_waste(uuid,uuid,numeric,numeric,text,uuid,text) is
  'Manager-only disposal of an explicit physical batch, including expired stock; atomically updates batch, aggregate, and waste ledger.';
comment on function public.adjust_inventory_batch_stock(uuid,uuid,numeric,numeric,text,uuid,text) is
  'Manager-only signed physical-count correction of an existing identified batch; original intake quantity remains unchanged.';

commit;
