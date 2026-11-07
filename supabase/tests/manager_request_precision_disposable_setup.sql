-- Targeted disposable Request fixture. Never apply to hosted Supabase.
create type public.user_role as enum ('manager', 'cashier', 'customer', 'production');
create table public.profiles (id uuid primary key, first_name text, last_name text, role public.user_role, is_active boolean);
create table public.inventory_items (
  id uuid primary key, item_name text not null, unit text not null,
  quantity_scale integer not null check (quantity_scale between 0 and 3),
  quantity_on_hand numeric(12,3) not null default 0,
  reorder_level numeric(12,3) not null,
  is_active boolean not null default true,
  batch_consumption_enabled boolean not null default false,
  expiry_required boolean not null default false
);
create table public.inventory_batches (
  inventory_item_id uuid, quantity_on_hand numeric(12,3), use_by_date date
);
create table public.production_replenishment_requests (
  inventory_item_id uuid, requested_quantity numeric(12,3), status text
);
create table public.receiving_reports (
  id uuid primary key, inventory_request_id uuid, status text,
  rr_number text, inspected_by_name text, posted_at timestamptz, received_at timestamptz
);
create table public.receiving_report_items (
  receiving_report_id uuid, inventory_item_id uuid,
  quantity_accepted numeric(12,3), quantity_rejected numeric(12,3)
);
create sequence public.inventory_request_number_seq;
create table public.inventory_request_documents (
  id uuid primary key, request_number text not null unique,
  current_revision integer not null default 1, status text not null default 'issued',
  priority text not null, needed_at timestamptz not null,
  issue_input jsonb not null, issued_by uuid not null,
  issued_at timestamptz not null default now(), close_reason text
);
create table public.inventory_request_lines (
  request_id uuid not null, inventory_item_id uuid not null,
  item_name text not null, requested_unit text not null,
  quantity_scale integer not null, requested_quantity numeric(12,3) not null check (requested_quantity > 0),
  recommendation jsonb not null, override_reason text,
  primary key(request_id, inventory_item_id)
);
create table public.inventory_request_revisions (
  request_id uuid not null, revision integer not null,
  snapshot jsonb not null, issued_by uuid not null,
  issued_at timestamptz not null default now(), primary key(request_id, revision)
);
create table public.inventory_request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null, revision integer not null,
  event_type text not null, actor_id uuid not null,
  recorded_at timestamptz not null default now(), details jsonb not null default '{}'::jsonb
);
-- These synthetic items do not use batches; this matches the aggregate-only
-- branch of the deployed usable-quantity function for the focused proposal.
create function public.inventory_usable_quantity(p_id uuid) returns numeric
  language sql stable as $$ select quantity_on_hand from public.inventory_items where id = p_id $$;
insert into public.profiles values
  ('11111111-1111-4111-8111-111111111111', 'Synthetic', 'Manager', 'manager', true),
  ('22222222-2222-4222-8222-222222222222', 'Synthetic', 'Cashier', 'cashier', true);
insert into public.inventory_items(id,item_name,unit,quantity_scale,quantity_on_hand,reorder_level) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','Soy Sauce','L',3,0.040,0.100),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','Vinegar','L',3,0.060,0.100),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','Food packs','packs',0,2,6),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','Historical bottles','bottles',0,0,2);
insert into public.production_replenishment_requests(inventory_item_id,requested_quantity,status)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',1,'issued');
insert into public.inventory_request_documents
  (id,request_number,priority,needed_at,issue_input,issued_by)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','PR-HIST-001','scheduled',now()+interval '2 days',
    '[{"inventory_item_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4","quantity":2}]'::jsonb,
    '11111111-1111-4111-8111-111111111111');
insert into public.inventory_request_lines
  (request_id,inventory_item_id,item_name,requested_unit,quantity_scale,requested_quantity,recommendation)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
    'Historical bottles','bottles',0,2,'{}'::jsonb);
insert into public.inventory_request_revisions(request_id,revision,snapshot,issued_by)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1,
    '{"number":"PR-HIST-001","revision":1,"lines":[{"inventory_item_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4","name":"Historical bottles","unit":"bottles","quantity":2}]}'::jsonb,
    '11111111-1111-4111-8111-111111111111');
