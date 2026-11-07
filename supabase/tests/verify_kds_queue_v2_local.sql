-- Run only on the preserved unlinked local stack. The test terminal rolls back.
begin;
create temporary table kds_v2_test_credential (id uuid, secret text) on commit drop;
with terminal as (
  insert into public.kds_terminals (terminal_name, secret_hash)
  values ('Local KDS v2 rollback verifier', encode(extensions.digest('local-kds-v2-contract-test', 'sha256'), 'hex'))
  returning id
) insert into kds_v2_test_credential
select id, 'local-kds-v2-contract-test' from terminal;
grant select on kds_v2_test_credential to anon;
set local role anon;
do $$
declare
  v_id uuid;
  v_secret text;
  v_v1 integer;
  v_v2 integer;
begin
  select id, secret into v_id, v_secret from pg_temp.kds_v2_test_credential;
  select count(*) into v_v1 from public.get_kds_queue(v_id, v_secret);
  select count(*) into v_v2 from public.get_kds_queue_v2(v_id, v_secret);
  if v_v1 <> v_v2 then raise exception 'v1/v2 queue cardinality changed'; end if;
  if not exists (
    select 1 from public.get_kds_queue_v2(v_id, v_secret) q,
         lateral jsonb_array_elements(q.items) item
    where q.order_channel = 'online'::public.order_channel
      and item->'modifiers' @> '[{"name":"Extra rice"}]'::jsonb
  ) then raise exception 'Customer modifier snapshot or channel missing'; end if;
  if not exists (
    select 1 from public.get_kds_queue_v2(v_id, v_secret) q,
         lateral jsonb_array_elements(q.items) item
    where q.order_channel = 'walk_in'::public.order_channel
      and item->'modifiers' @> '[{"name":"Extra rice"}]'::jsonb
  ) then raise exception 'Walk-in modifier snapshot or channel missing'; end if;
  if not exists (
    select 1 from public.get_kds_queue_v2(v_id, v_secret) q,
         lateral jsonb_array_elements(q.items) item
    where item->'modifiers' = '[]'::jsonb
  ) then raise exception 'Legacy empty modifiers not projected'; end if;
  if exists (
    select 1 from public.get_kds_queue_v2(v_id, v_secret) q
    where to_jsonb(q) ?| array['customer_name','customer_contact_number','delivery_address','payment_id','proof_image_path']
  ) then raise exception 'Sensitive order field exposed'; end if;
  begin
    perform 1 from public.get_kds_queue_v2(v_id, 'wrong-local-secret');
    raise exception 'Wrong terminal secret accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm = 'Wrong terminal secret accepted' then raise; end if;
  end;
end;
$$;
rollback;
