-- Disposable-only synthetic pre-migration data. Mirrors measured hosted
-- cardinalities for the affected Cashier/order paths without copying PII.
begin;
insert into auth.users(id) values ('f0410000-0000-4000-8000-000000000001');
update public.profiles set role='cashier', is_active=true
 where id='f0410000-0000-4000-8000-000000000001';

insert into public.cashier_shifts
 (id,cashier_id,terminal,opening_cash,status,ended_at,
  actual_cash,expected_cash,variance,closed_by)
select md5('rehearsal-shift-'||i)::uuid,
 'f0410000-0000-4000-8000-000000000001'::uuid,
 'Rehearsal '||i,100,'closed',now(),100,100,0,
 'f0410000-0000-4000-8000-000000000001'::uuid
from generate_series(1,6) i;

insert into public.orders
 (id,order_number,order_channel,fulfillment_type,current_status,
  subtotal,delivery_fee,tax_amount,discount_amount,grand_total,notes)
select md5('rehearsal-order-'||i)::uuid,
 'REHEARSAL-'||lpad(i::text,3,'0'),
 'walk_in','takeout','completed',10,0,0,0,10,
 case when i in (1,2) then 'Synthetic historical general note '||i end
from generate_series(1,63) i;

insert into public.payments
 (id,order_id,payment_method,amount,cash_received,status,verified_by,verified_at)
select md5('rehearsal-payment-'||i)::uuid,
 md5('rehearsal-order-'||i)::uuid,'cash',10,10,'verified',
 'f0410000-0000-4000-8000-000000000001'::uuid,now()
from generate_series(1,44) i;

insert into public.cashier_transactions
 (id,transaction_number,receipt_number,order_id,payment_id,
  shift_id,cashier_id,request_id)
select md5('rehearsal-transaction-'||i)::uuid,
 'TXN-REH-'||lpad(i::text,3,'0'),
 'RCP-REH-'||lpad(i::text,3,'0'),
 md5('rehearsal-order-'||i)::uuid,
 md5('rehearsal-payment-'||i)::uuid,
 md5('rehearsal-shift-'||(((i-1)%6)+1))::uuid,
 'f0410000-0000-4000-8000-000000000001'::uuid,
 md5('rehearsal-request-'||i)::uuid
from generate_series(1,42) i;
commit;
