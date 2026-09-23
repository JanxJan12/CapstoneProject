begin;

-- Phase 6B.3 creates structural receiving and inventory-batch records only.
-- It does not post receipts, change purchase orders, move inventory, or backfill
-- legacy-opening batches.

create table public.receiving_reports (
  id uuid primary key default gen_random_uuid(),
  rr_number character varying(50) not null unique,
  purchase_order_id uuid not null,
  received_at timestamp with time zone not null,
  received_by uuid not null,
  status text not null default 'draft',
  supplier_delivery_reference text,
  notes text,
  posted_at timestamp with time zone,
  posted_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint receiving_reports_purchase_order_id_fkey
    foreign key (purchase_order_id)
    references public.purchase_orders(id),
  constraint receiving_reports_received_by_fkey
    foreign key (received_by)
    references public.profiles(id),
  constraint receiving_reports_posted_by_fkey
    foreign key (posted_by)
    references public.profiles(id),
  constraint receiving_reports_status_chk
    check (status in ('draft', 'posted')),
  constraint receiving_reports_posting_fields_chk
    check (
      (status = 'draft' and posted_at is null and posted_by is null)
      or
      (status = 'posted' and posted_at is not null and posted_by is not null)
    )
);

create table public.receiving_report_items (
  id uuid primary key default gen_random_uuid(),
  receiving_report_id uuid not null,
  purchase_order_item_id uuid not null,
  quantity_delivered numeric(12,3) not null,
  quantity_accepted numeric(12,3) not null,
  quantity_rejected numeric(12,3)
    generated always as (
      quantity_delivered - quantity_accepted
    ) stored,
  secondary_quantity_delivered numeric(12,3),
  secondary_quantity_accepted numeric(12,3),
  secondary_quantity_rejected numeric(12,3)
    generated always as (
      case
        when secondary_quantity_delivered is null then null
        else secondary_quantity_delivered - secondary_quantity_accepted
      end
    ) stored,
  rejection_reason text,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint receiving_report_items_receiving_report_id_fkey
    foreign key (receiving_report_id)
    references public.receiving_reports(id),
  constraint receiving_report_items_purchase_order_item_id_fkey
    foreign key (purchase_order_item_id)
    references public.purchase_order_items(id),
  constraint receiving_report_items_report_po_item_key
    unique (receiving_report_id, purchase_order_item_id),
  constraint receiving_report_items_quantity_delivered_pos_chk
    check (
      quantity_delivered <> 'NaN'::numeric
      and quantity_delivered > 0
    ),
  constraint receiving_report_items_quantity_accepted_nonneg_chk
    check (
      quantity_accepted <> 'NaN'::numeric
      and quantity_accepted >= 0
    ),
  constraint receiving_report_items_quantity_accepted_le_delivered_chk
    check (quantity_accepted <= quantity_delivered),
  constraint receiving_report_items_secondary_quantities_pair_chk
    check (
      (secondary_quantity_delivered is null)
      = (secondary_quantity_accepted is null)
    ),
  constraint receiving_report_items_secondary_delivered_pos_chk
    check (
      secondary_quantity_delivered is null
      or (
        secondary_quantity_delivered <> 'NaN'::numeric
        and secondary_quantity_delivered > 0
      )
    ),
  constraint receiving_report_items_secondary_accepted_nonneg_chk
    check (
      secondary_quantity_accepted is null
      or (
        secondary_quantity_accepted <> 'NaN'::numeric
        and secondary_quantity_accepted >= 0
      )
    ),
  constraint receiving_report_items_secondary_accepted_le_delivered_chk
    check (
      secondary_quantity_accepted is null
      or secondary_quantity_accepted <= secondary_quantity_delivered
    ),
  constraint receiving_report_items_rejection_reason_chk
    check (
      not (
        quantity_delivered - quantity_accepted > 0
        or (
          secondary_quantity_delivered is not null
          and secondary_quantity_delivered - secondary_quantity_accepted > 0
        )
      )
      or (
        rejection_reason is not null
        and btrim(rejection_reason) <> ''
      )
    )
);

create table public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  batch_code character varying(100) not null unique,
  inventory_item_id uuid not null,
  origin_type text not null,
  receiving_report_item_id uuid,
  supplier_lot_code text,
  received_at timestamp with time zone not null,
  manufactured_on date,
  use_by_date date,
  quantity_initial numeric(12,3) not null,
  quantity_on_hand numeric(12,3) not null,
  secondary_quantity_initial numeric(12,3),
  secondary_quantity_on_hand numeric(12,3),
  created_at timestamp with time zone not null default now(),
  constraint inventory_batches_inventory_item_id_fkey
    foreign key (inventory_item_id)
    references public.inventory_items(id),
  constraint inventory_batches_receiving_report_item_id_fkey
    foreign key (receiving_report_item_id)
    references public.receiving_report_items(id),
  constraint inventory_batches_origin_type_chk
    check (origin_type in ('receiving', 'legacy_opening')),
  constraint inventory_batches_origin_reference_chk
    check (
      (origin_type = 'receiving' and receiving_report_item_id is not null)
      or
      (origin_type = 'legacy_opening' and receiving_report_item_id is null)
    ),
  constraint inventory_batches_quantity_initial_pos_chk
    check (
      quantity_initial <> 'NaN'::numeric
      and quantity_initial > 0
    ),
  constraint inventory_batches_quantity_on_hand_nonneg_chk
    check (
      quantity_on_hand <> 'NaN'::numeric
      and quantity_on_hand >= 0
    ),
  constraint inventory_batches_quantity_on_hand_le_initial_chk
    check (quantity_on_hand <= quantity_initial),
  constraint inventory_batches_secondary_quantities_pair_chk
    check (
      (secondary_quantity_initial is null)
      = (secondary_quantity_on_hand is null)
    ),
  constraint inventory_batches_secondary_initial_pos_chk
    check (
      secondary_quantity_initial is null
      or (
        secondary_quantity_initial <> 'NaN'::numeric
        and secondary_quantity_initial > 0
      )
    ),
  constraint inventory_batches_secondary_on_hand_nonneg_chk
    check (
      secondary_quantity_on_hand is null
      or (
        secondary_quantity_on_hand <> 'NaN'::numeric
        and secondary_quantity_on_hand >= 0
      )
    ),
  constraint inventory_batches_secondary_on_hand_le_initial_chk
    check (
      secondary_quantity_on_hand is null
      or secondary_quantity_on_hand <= secondary_quantity_initial
    ),
  constraint inventory_batches_date_order_chk
    check (
      manufactured_on is null
      or use_by_date is null
      or manufactured_on <= use_by_date
    )
);

alter table public.inventory_transactions
  add column inventory_batch_id uuid,
  add constraint inventory_transactions_inventory_batch_id_fkey
    foreign key (inventory_batch_id)
    references public.inventory_batches(id);

-- The unique constraint's index supports receiving_report_id lookups while also
-- enforcing one PO line per report, so a duplicate single-column index is not
-- added. Likewise, the FEFO index begins with inventory_item_id and serves both
-- per-item lookup and future item/use-by/receipt ordering.
create index receiving_reports_purchase_order_id_idx
  on public.receiving_reports using btree (purchase_order_id);

create index receiving_reports_status_received_at_idx
  on public.receiving_reports using btree (status, received_at desc);

create index receiving_report_items_purchase_order_item_id_idx
  on public.receiving_report_items using btree (purchase_order_item_id);

create index inventory_batches_receiving_report_item_id_idx
  on public.inventory_batches using btree (receiving_report_item_id);

create index inventory_batches_inventory_item_fefo_idx
  on public.inventory_batches using btree (
    inventory_item_id,
    use_by_date,
    received_at
  );

create index inventory_transactions_inventory_batch_id_idx
  on public.inventory_transactions using btree (inventory_batch_id);

create trigger receiving_reports_set_updated_at
before update on public.receiving_reports
for each row execute function public.set_updated_at();

create trigger receiving_report_items_set_updated_at
before update on public.receiving_report_items
for each row execute function public.set_updated_at();

alter table public.receiving_reports enable row level security;
alter table public.receiving_report_items enable row level security;
alter table public.inventory_batches enable row level security;

-- Defense in depth for the protected operational tables. The earlier default-
-- privilege hardening already prevents these grants when postgres creates a
-- public table; keep the application roles grant-free even if execution context
-- or database defaults differ.
revoke all privileges on table
  public.receiving_reports,
  public.receiving_report_items,
  public.inventory_batches
from anon, authenticated;

-- Retain trusted backend operation while RLS and the absence of client policies
-- keep these structures unavailable to application roles.
grant all privileges on table
  public.receiving_reports,
  public.receiving_report_items,
  public.inventory_batches
to service_role;

comment on table public.receiving_reports is
  'Phase 6B.3 structural receiving header. Posting and status transitions are not implemented in this phase.';

comment on table public.receiving_report_items is
  'Future posting must verify that each item belongs to the receiving report purchase order; the purchase-order item determines the inventory item. Accepted base quantity must equal the sum of new receiving-batch base quantities. When secondary quantities are used, accepted secondary quantity must equal the sum of batch secondary quantities. Items configured with a secondary_unit require secondary receiving quantities at posting time.';

comment on table public.inventory_batches is
  'Phase 6B.3 structural batch record. Future posting must require use_by_date on every receiving batch whose inventory item has expiry_required = true. No legacy-opening rows are created by this migration.';

comment on column public.inventory_transactions.inventory_batch_id is
  'Nullable batch traceability link. Historical transactions remain NULL. Future authoritative posting performs inventory balance and transaction updates.';

comment on column public.receiving_report_items.quantity_accepted is
  'Future authoritative posting increments the PO item received quantity by this accepted base quantity.';

comment on column public.receiving_report_items.quantity_rejected is
  'Delivered minus accepted. Rejected quantity does not increment PO received or cancelled quantity.';

commit;
