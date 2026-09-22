begin;

-- Phase 6B.2 adds metadata and correct PO-line quantity semantics only.
-- Receiving, lot allocation, production, and reservation behavior remain out of scope.

-- Live verification found no PO lines. Refuse to replace quantity_remaining if
-- that assumption has changed, because silently rewriting procurement data would
-- require a separate reconciliation and migration plan.
lock table public.purchase_order_items in access exclusive mode;

do $purchase_order_items_empty_guard$
begin
  if exists (
    select 1
    from public.purchase_order_items
  ) then
    raise exception
      'Phase 6B.2 cannot convert purchase_order_items.quantity_remaining: unexpected purchase-order item rows exist.'
      using
        errcode = 'P0001',
        hint = 'Reconcile existing PO-line quantities before retrying this migration.';
  end if;
end
$purchase_order_items_empty_guard$;

alter table public.inventory_items
  add column item_kind text,
  add column secondary_unit character varying(20),
  add column quantity_scale smallint not null default 3,
  add column rotation_policy text not null default 'fifo',
  add column expiry_required boolean not null default false,
  add constraint inventory_items_item_kind_chk
    check (
      item_kind is null
      or item_kind in ('raw', 'packaging', 'finished')
    ),
  add constraint inventory_items_secondary_unit_chk
    check (
      secondary_unit is null
      or (
        btrim(secondary_unit) <> ''
        and lower(btrim(secondary_unit)) <> lower(btrim(unit))
      )
    ),
  add constraint inventory_items_quantity_scale_chk
    check (quantity_scale between 0 and 6),
  add constraint inventory_items_rotation_policy_chk
    check (rotation_policy in ('fifo', 'fefo')),
  add constraint inventory_items_expiry_policy_chk
    check (not expiry_required or rotation_policy = 'fefo');

comment on column public.inventory_items.item_kind is
  'Optional inventory classification: raw, packaging, or finished.';
comment on column public.inventory_items.secondary_unit is
  'Optional observational unit distinct from unit; no fixed conversion to the base unit is implied.';
comment on column public.inventory_items.quantity_scale is
  'Display/input precision for quantities, from 0 through 6 decimal places.';
comment on column public.inventory_items.rotation_policy is
  'Future stock-rotation policy metadata: fifo or fefo. This column does not implement allocation.';
comment on column public.inventory_items.expiry_required is
  'Whether future receipt/batch records must carry expiry data; true requires fefo rotation.';

-- Configure only the verified Chicken row. Preserve its balance explicitly and
-- abort if the verified business identity is absent or an unexpected trigger
-- changes quantity_on_hand during this metadata-only update.
do $configure_chicken$
declare
  v_chicken_id uuid;
  v_quantity_before numeric;
  v_quantity_after numeric;
begin
  begin
    select
      inventory_item.id,
      inventory_item.quantity_on_hand
    into strict
      v_chicken_id,
      v_quantity_before
    from public.inventory_items inventory_item
    where inventory_item.item_name = 'Chicken'
      and inventory_item.unit = 'kg'
    for update;
  exception
    when no_data_found or too_many_rows then
      raise exception
        'Phase 6B.2 expected exactly one Chicken inventory item with base unit kg.'
        using errcode = 'P0001';
  end;

  update public.inventory_items
  set
    item_kind = 'raw',
    secondary_unit = 'pcs',
    quantity_scale = 3,
    rotation_policy = 'fefo',
    expiry_required = true
  where id = v_chicken_id
  returning quantity_on_hand into v_quantity_after;

  if v_quantity_after is distinct from v_quantity_before then
    raise exception
      'Phase 6B.2 metadata update unexpectedly changed Chicken quantity_on_hand.'
      using errcode = 'P0001';
  end if;
end
$configure_chicken$;

alter table public.purchase_order_items
  add column secondary_quantity_ordered numeric(12,3),
  add column secondary_quantity_received numeric(12,3) not null default 0,
  add column quantity_cancelled numeric(12,3) not null default 0,
  add constraint purchase_order_items_secondary_ordered_pos_chk
    check (
      secondary_quantity_ordered is null
      or (
        secondary_quantity_ordered <> 'NaN'::numeric
        and secondary_quantity_ordered > 0
      )
    ),
  add constraint purchase_order_items_secondary_received_nonneg_chk
    check (
      secondary_quantity_received <> 'NaN'::numeric
      and secondary_quantity_received >= 0
    ),
  add constraint purchase_order_items_quantity_cancelled_nonneg_chk
    check (
      quantity_cancelled <> 'NaN'::numeric
      and quantity_cancelled >= 0
    ),
  add constraint purchase_order_items_received_cancelled_le_ordered_chk
    check (
      quantity_ordered <> 'NaN'::numeric
      and quantity_received <> 'NaN'::numeric
      and quantity_received + quantity_cancelled <= quantity_ordered
    );

-- The existing column is writable and defaults to zero, so it can drift. Its
-- only repository dependency is the following index; recreate both explicitly.
alter table public.purchase_order_items
  drop constraint purchase_order_items_qty_remaining_le_received_chk,
  drop constraint purchase_order_items_qty_remaining_nonneg_chk;

drop index public.purchase_order_items_quantity_remaining_idx;

alter table public.purchase_order_items
  drop column quantity_remaining,
  add column quantity_remaining numeric(12,3)
    generated always as (
      quantity_ordered - quantity_received - quantity_cancelled
    ) stored
    not null,
  add constraint purchase_order_items_qty_remaining_nonneg_chk
    check (quantity_remaining >= 0);

create index purchase_order_items_quantity_remaining_idx
  on public.purchase_order_items using btree (quantity_remaining);

comment on column public.purchase_order_items.secondary_quantity_ordered is
  'Optional expected quantity in the inventory item secondary unit; it has no fixed conversion to base quantity.';
comment on column public.purchase_order_items.secondary_quantity_received is
  'Observed received quantity in the secondary unit; it may differ from the expected secondary quantity.';
comment on column public.purchase_order_items.quantity_cancelled is
  'Cancelled quantity in the inventory item base unit.';
comment on column public.purchase_order_items.quantity_remaining is
  'Stored generated base-unit quantity: quantity_ordered - quantity_received - quantity_cancelled.';

commit;
