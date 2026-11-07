-- Disposable fixture only. Supply two hosted objects absent from the older
-- retirement receipt clone before replaying the unchanged quote migration.
\set ON_ERROR_STOP on
begin;
create or replace function auth.jwt() returns jsonb language sql stable as $jwt$
  select coalesce(nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), ''))::jsonb;
$jwt$;
alter table public.orders add column if not exists customer_request_id uuid;
create unique index if not exists orders_customer_request_id_uidx
  on public.orders(customer_id, customer_request_id)
  where customer_request_id is not null;
commit;
