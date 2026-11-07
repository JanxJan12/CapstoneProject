import fs from 'node:fs';

// One-time source extraction keeps the existing validated pricing loop byte-for-byte
// aligned in the quote and confirmed-order writer during this local preparation.
const source = fs.readFileSync('supabase/migrations/20261021190000_drink_choices_transition.sql', 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('create or replace function public.place_customer_order(');
const end = source.indexOf('\n$$;', start) + 4;
if (start < 0 || end < 4) throw new Error('Customer writer not found');
const writer = source.slice(start, end);
const loopStart = writer.indexOf('  if p_items is null or jsonb_typeof(p_items)');
const loopEnd = writer.indexOf('\n  v_order_id := gen_random_uuid();', loopStart);
if (loopStart < 0 || loopEnd < 0) throw new Error('Pricing boundaries changed');
const pricing = writer.slice(loopStart, loopEnd).replace('      for share;', ';');
const out = [];
out.push(`-- Local preparation only. Deploy with a controlled frontend cutover.
create schema customer_quote_private;
revoke all on schema customer_quote_private from public, anon, authenticated;
create table customer_quote_private.signing_key (
  singleton boolean primary key default true check (singleton),
  secret bytea not null check (octet_length(secret) = 32)
);
revoke all on customer_quote_private.signing_key from public, anon, authenticated;
alter table customer_quote_private.signing_key enable row level security;
insert into customer_quote_private.signing_key (singleton, secret)
values (true, extensions.gen_random_bytes(32));

create function public.customer_order_pricing(p_items jsonb)
returns table(subtotal numeric, delivery_fee numeric, grand_total numeric, lines jsonb)
language plpgsql stable security definer set search_path = '' as $pricing$
declare
  v_subtotal numeric := 0;
  v_delivery_fee numeric := 50;
  v_item jsonb;
  v_ids jsonb;
  v_menu public.menu_items%rowtype;
  v_qty integer;
  v_option_count integer;
  v_snapshot jsonb;
  v_adjustment numeric;
  v_group record;
  v_group_count integer;
  v_lines jsonb := '[]'::jsonb;
  v_inventory_items jsonb;
  v_meal_option text;
  v_excluded_inventory_item_id uuid;
begin
${pricing}
  return query select v_subtotal, v_delivery_fee, v_subtotal + v_delivery_fee, v_lines;
end;
$pricing$;
revoke all on function public.customer_order_pricing(jsonb) from public, anon, authenticated;

create function public.customer_quote_terms(
  p_customer_name text, p_contact_number text, p_delivery_address text,
  p_landmark text, p_items jsonb)
returns text language sql immutable set search_path = '' as $terms$
  select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object('customer_name', pg_catalog.btrim(p_customer_name),
      'contact_number', pg_catalog.btrim(p_contact_number),
      'delivery_address', pg_catalog.btrim(p_delivery_address),
      'landmark', nullif(pg_catalog.btrim(coalesce(p_landmark, '')), ''),
      'items', p_items)::text, 'UTF8'), 'sha256'), 'hex');
$terms$;
revoke all on function public.customer_quote_terms(text,text,text,text,jsonb) from public, anon, authenticated;

create function public.quote_customer_order(
  p_customer_name text, p_contact_number text, p_delivery_address text,
  p_landmark text, p_items jsonb, p_request_id uuid)
returns table(subtotal numeric, delivery_fee numeric,
  tax_amount numeric, grand_total numeric, calculated_at timestamptz,
  expires_at timestamptz, quote_token text)
language plpgsql stable security definer set search_path = '' as $quote$
declare
  v_customer_id uuid := auth.uid();
  v_session_id text := nullif(auth.jwt()->>'session_id', '');
  v_secret bytea;
  v_lines jsonb;
  v_payload text;
begin
  if v_customer_id is null or v_session_id is null or not exists (
    select 1 from public.profiles p where p.id = v_customer_id
      and p.role = 'customer'::public.user_role and p.is_active) then
    raise exception 'Active customer access required.' using errcode='42501';
  end if;
  if p_request_id is null then raise exception 'Order request ID is required.'; end if;
  if nullif(pg_catalog.btrim(p_customer_name), '') is null then
    raise exception 'Customer name is required.';
  end if;
  if pg_catalog.btrim(coalesce(p_contact_number, '')) !~ '^09[0-9]{9}$' then
    raise exception 'A valid Philippine mobile number is required.';
  end if;
  if nullif(pg_catalog.btrim(p_delivery_address), '') is null then
    raise exception 'Delivery address is required.';
  end if;
  select p.subtotal, p.delivery_fee, p.grand_total, p.lines
    into subtotal, delivery_fee, grand_total, v_lines
    from public.customer_order_pricing(p_items) p;
  tax_amount := 0;
  calculated_at := pg_catalog.statement_timestamp();
  expires_at := calculated_at + interval '5 minutes';
  select k.secret into v_secret from customer_quote_private.signing_key k where k.singleton;
  v_payload := pg_catalog.jsonb_build_object(
    'customer_id', v_customer_id, 'session_id', v_session_id,
    'request_id', p_request_id,
    'terms', public.customer_quote_terms(p_customer_name,p_contact_number,p_delivery_address,p_landmark,p_items),
    'pricing', pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
      pg_catalog.jsonb_build_object('subtotal',subtotal,'delivery_fee',delivery_fee,
        'tax_amount',tax_amount,
        'grand_total',grand_total,'lines',v_lines)::text, 'UTF8'), 'sha256'), 'hex'),
    'expires_at', expires_at)::text;
  quote_token := pg_catalog.encode(pg_catalog.convert_to(v_payload, 'UTF8'), 'hex')
    || '.' || pg_catalog.encode(extensions.hmac(pg_catalog.convert_to(v_payload,'UTF8'), v_secret, 'sha256'), 'hex');
  return next;
end;
$quote$;
revoke all on function public.quote_customer_order(text,text,text,text,jsonb,uuid) from public, anon;
grant execute on function public.quote_customer_order(text,text,text,text,jsonb,uuid) to authenticated, service_role;
`);
const beforePricing = writer.slice(writer.indexOf('declare'), loopStart)
  .replace('  v_customer_id uuid := auth.uid();',
    `  v_customer_id uuid := auth.uid();\n  v_session_id text := nullif(auth.jwt()->>'session_id', '');`)
  .replace('  v_subtotal numeric := 0;', '  v_subtotal numeric;')
  .replace('  v_delivery_fee numeric := 50;', '  v_delivery_fee numeric;')
  .replace('  v_lines jsonb := \'[]\'::jsonb;', '  v_lines jsonb;')
  .replace('begin\n', `  v_quote_payload jsonb;
  v_quote_text text;
  v_secret bytea;
  v_expected_signature text;
  v_pricing_hash text;
begin\n`);
const existingAndValidation = beforePricing.slice(beforePricing.indexOf('begin\n'));
const insertPart = writer.slice(loopEnd, writer.lastIndexOf('\nend;'));
out.push(`create function public.place_customer_order_confirmed(
  p_customer_name text, p_contact_number text, p_delivery_address text,
  p_landmark text, p_items jsonb, p_request_id uuid, p_quote_token text)
returns table(order_id uuid, order_number varchar, subtotal numeric,
  delivery_fee numeric, grand_total numeric, current_status public.order_status)
language plpgsql security definer set search_path = '' as $confirmed$
${beforePricing.replace('  v_inventory_items jsonb;', '  v_inventory_items jsonb;')}
  if p_quote_token is null or p_quote_token !~ '^[0-9a-f]+[.][0-9a-f]{64}$'
    or length(p_quote_token) > 8192 then
    raise exception 'Quote is invalid or has expired.' using errcode='P0001';
  end if;
  select k.secret into v_secret from customer_quote_private.signing_key k where k.singleton;
  v_quote_text := pg_catalog.convert_from(pg_catalog.decode(split_part(p_quote_token,'.',1), 'hex'), 'UTF8');
  v_expected_signature := pg_catalog.encode(extensions.hmac(
    pg_catalog.convert_to(v_quote_text,'UTF8'), v_secret, 'sha256'), 'hex');
  if v_expected_signature <> split_part(p_quote_token,'.',2) then
    raise exception 'Quote is invalid or has expired.' using errcode='P0001';
  end if;
  v_quote_payload := v_quote_text::jsonb;
  if v_session_id is null
    or v_quote_payload->>'session_id' is distinct from v_session_id
    or v_quote_payload->>'customer_id' is distinct from v_customer_id::text
    or v_quote_payload->>'request_id' is distinct from p_request_id::text
    or (v_quote_payload->>'expires_at')::timestamptz <= pg_catalog.statement_timestamp()
    or v_quote_payload->>'terms' is distinct from public.customer_quote_terms(
      p_customer_name,p_contact_number,p_delivery_address,p_landmark,p_items) then
    raise exception 'Quote is stale. Review the latest total before ordering.' using errcode='P0001';
  end if;
  -- Manager choice changes lock the parent menu row; lock all requested rows in
  -- deterministic order before recalculating and retain locks through insertion.
  perform 1 from public.menu_items mi where mi.id in (
    select (item->>'id')::uuid from pg_catalog.jsonb_array_elements(p_items) item
      where item->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    order by mi.id for share;
  select p.subtotal, p.delivery_fee, p.grand_total, p.lines
    into v_subtotal, v_delivery_fee, grand_total, v_lines
    from public.customer_order_pricing(p_items) p;
  v_pricing_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object('subtotal',v_subtotal,'delivery_fee',v_delivery_fee,
      'tax_amount',0,'grand_total',grand_total,
      'lines',v_lines)::text, 'UTF8'), 'sha256'), 'hex');
  if v_quote_payload->>'pricing' is distinct from v_pricing_hash then
    raise exception 'Quote is stale. Review the latest total before ordering.' using errcode='P0001';
  end if;
${insertPart}
end;
$confirmed$;
revoke all on function public.place_customer_order_confirmed(text,text,text,text,jsonb,uuid,text) from public, anon;
grant execute on function public.place_customer_order_confirmed(text,text,text,text,jsonb,uuid,text) to authenticated, service_role;

-- The old Customer writer has no quote gate. It must not remain callable.
revoke all on function public.place_customer_order(text,text,text,text,jsonb,uuid)
  from public, anon, authenticated;
`);
let sql = out.join('\n');
// Original writer assigned to output parameters directly only at return; retain
// the original return columns while comparing the computed grand total above.
fs.writeFileSync('supabase/migrations/20261022120000_customer_preorder_quote.sql', sql);
