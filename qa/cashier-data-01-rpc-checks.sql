-- Disposable PostgreSQL assertions after the prepared migration.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
declare result jsonb;
begin
  result := public.get_cashier_transaction_history(1,0,'{}');
  if (result->>'total')::int <> 2 or jsonb_array_length(result->'rows') <> 1 or
     result->'rows'->0->>'receipt_number' <> 'RCP-2' then
    raise exception 'closed shift, count, or pagination failed';
  end if;
  result := public.get_cashier_transaction_history(10,0,'{"status":"completed","method":"gcash","search":"REF-1"}');
  if (result->>'total')::int <> 1 or result->'rows'->0->>'receipt_number' <> 'RCP-1' or
     (result->'rows'->0->>'delivery_fee')::numeric <> 30 or
     (result->'rows'->0->>'subtotal')::numeric + (result->'rows'->0->>'delivery_fee')::numeric -
     (result->'rows'->0->>'discount_amount')::numeric + (result->'rows'->0->>'tax_amount')::numeric <> 150 then
    raise exception 'filter, fee, or total breakdown failed';
  end if;
  result := public.get_cashier_transaction_history(10,0,'{"receiptNumber":"RCP-3"}');
  if (result->>'total')::int <> 0 then raise exception 'other cashier receipt leaked'; end if;
  result := public.get_cashier_transaction_history(10,0,'{"status":"voided"}');
  if (result->>'total')::int <> 1 or result->'rows'->0->>'void_reason' <> 'Manager cancellation' then
    raise exception 'voided receipt was treated incorrectly';
  end if;
end $$;
-- Direct authenticated calls must remain bounded even when the client is bypassed.
-- The new rows share a timestamp, exercising the id tie-breaker in both pages.
reset role;
insert into public.cashier_transactions
  (id, transaction_number, receipt_number, order_id, payment_id, shift_id,
   cashier_id, status, void_reason, created_at)
select md5('cashier-data-01c-' || n)::uuid, 'TXN-PAGE-' || n, 'RCP-PAGE-' || n,
  '20000000-0000-0000-0000-000000000001'::uuid,
  '30000000-0000-0000-0000-000000000001'::uuid,
  '10000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'completed'::public.cashier_transaction_status, null, '2026-10-02 07:00Z'::timestamptz
from generate_series(1,105) n;
set role authenticated;
do $$
declare result jsonb; first_page jsonb; second_page jsonb;
  all_rows jsonb; row_data jsonb; previous_time timestamptz; previous_id uuid; n integer;
begin
  result := public.get_cashier_transaction_history(100, 0, '{}');
  if (result->>'total')::int <> 107 or jsonb_array_length(result->'rows') <> 100 then
    raise exception '100-row page or total incorrect: %', result;
  end if;
  first_page := result->'rows';
  result := public.get_cashier_transaction_history(100, 100, '{}');
  if (result->>'total')::int <> 107 or jsonb_array_length(result->'rows') <> 7 then
    raise exception 'second page length or total incorrect: %', result;
  end if;
  second_page := result->'rows';
  if first_page->99->>'id' = second_page->0->>'id' then
    raise exception 'page boundary duplicated a row';
  end if;
  all_rows := first_page || second_page;
  for n in 0..106 loop
    row_data := all_rows->n;
    if n > 0 and (previous_time < (row_data->>'created_at')::timestamptz or
       (previous_time = (row_data->>'created_at')::timestamptz and
        previous_id <= (row_data->>'id')::uuid)) then
      raise exception 'history order unstable at row %', n;
    end if;
    previous_time := (row_data->>'created_at')::timestamptz;
    previous_id := (row_data->>'id')::uuid;
  end loop;
  result := public.get_cashier_transaction_history(1, 0, '{}');
  if jsonb_array_length(result->'rows') <> 1 then raise exception 'limit one returned more than one row'; end if;
  result := public.get_cashier_transaction_history(100, 10000, '{}');
  if jsonb_array_length(result->'rows') <> 0 or (result->>'total')::int <> 107 then
    raise exception 'maximum offset boundary failed';
  end if;
  begin perform public.get_cashier_transaction_history(null, 0, '{}');
    raise exception 'null limit accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.get_cashier_transaction_history(0, 0, '{}');
    raise exception 'zero limit accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.get_cashier_transaction_history(-1, 0, '{}');
    raise exception 'negative limit accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.get_cashier_transaction_history(101, 0, '{}');
    raise exception 'over-100 limit accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.get_cashier_transaction_history(100, null, '{}');
    raise exception 'null offset accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.get_cashier_transaction_history(100, -1, '{}');
    raise exception 'negative offset accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.get_cashier_transaction_history(100, 10001, '{}');
    raise exception 'over-10000 offset accepted'; exception when sqlstate '22023' then null; end;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$
declare result jsonb;
begin
  result := public.get_cashier_transaction_history(100, 0, '{}');
  if (result->>'total')::int <> 1 or jsonb_array_length(result->'rows') <> 1 or
     result->'rows'->0->>'receipt_number' <> 'RCP-3' then
    raise exception 'cashier B isolation failed: %', result;
  end if;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $$ begin
  perform public.get_cashier_transaction_history(10,0,'{}');
  raise exception 'inactive cashier accepted';
exception when insufficient_privilege then null; end $$;
reset role;
set role anon;
do $$ begin
  perform public.get_cashier_transaction_history(10,0,'{}');
  raise exception 'anon accepted';
exception when insufficient_privilege then null; end $$;
reset role;
