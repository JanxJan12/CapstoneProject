-- Run only against a disposable local database. The caller injects the Track B
-- migration at the marker below. Everything, including DDL, is rolled back.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id) values
  ('a0000000-0000-4000-8000-0000000000b1'),
  ('a0000000-0000-4000-8000-0000000000b2')
on conflict (id) do nothing;
insert into public.profiles (id, role, is_active) values
  ('a0000000-0000-4000-8000-0000000000b1', 'rider', true),
  ('a0000000-0000-4000-8000-0000000000b2', 'customer', true)
on conflict (id) do update set role = excluded.role, is_active = excluded.is_active;
insert into public.riders (id, approval_status) values
  ('a0000000-0000-4000-8000-0000000000b1', 'approved');
insert into public.orders (id, order_number, order_channel, fulfillment_type, current_status, delivery_address)
values ('a0000000-0000-4000-8000-0000000000b3', 'TRACK-B-LOCAL-1',
        'online', 'delivery', 'delivered', 'Disposable local address');
insert into public.delivery_assignments (id, order_id, rider_id, status)
values ('a0000000-0000-4000-8000-0000000000b4',
        'a0000000-0000-4000-8000-0000000000b3',
        'a0000000-0000-4000-8000-0000000000b1', 'delivered');
insert into storage.buckets (id, name, public)
values ('delivery-proofs', 'delivery-proofs', false)
on conflict (id) do nothing;
insert into storage.objects (bucket_id, name)
values ('delivery-proofs',
        'a0000000-0000-4000-8000-0000000000b1/a0000000-0000-4000-8000-0000000000b4/proof.jpg');

-- Confirm this fixture demonstrates the hosted defect before changing policy.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.delivery_assignments where id =
      'a0000000-0000-4000-8000-0000000000b4') <> 1 then
    raise exception 'Precondition failed: approved rider assignment unavailable';
  end if;
  if (select count(*) from storage.objects where bucket_id = 'delivery-proofs'
      and name like 'a0000000-0000-4000-8000-0000000000b1/%') <> 1 then
    raise exception 'Precondition failed: approved rider proof unavailable';
  end if;
end $$;
reset role;

-- Reproduce the old policy defect, then restore the eligible rider fixture.
update public.profiles set role = 'customer' where id =
  'a0000000-0000-4000-8000-0000000000b1';
update public.riders set approval_status = 'suspended' where id =
  'a0000000-0000-4000-8000-0000000000b1';
set local role authenticated;
do $$ begin
  if not exists (select 1 from public.delivery_assignments where id =
      'a0000000-0000-4000-8000-0000000000b4') then
    raise exception 'Old assignment policy did not reproduce defect';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'delivery-proofs'
      and name like 'a0000000-0000-4000-8000-0000000000b1/%') then
    raise exception 'Old proof policy did not reproduce defect';
  end if;
end $$;
reset role;
update public.profiles set role = 'rider' where id =
  'a0000000-0000-4000-8000-0000000000b1';
update public.riders set approval_status = 'approved' where id =
  'a0000000-0000-4000-8000-0000000000b1';

-- TRACK_B_MIGRATION_HERE

set local role authenticated;
do $$ begin
  if (select count(*) from public.delivery_assignments where id =
      'a0000000-0000-4000-8000-0000000000b4') <> 1 then
    raise exception 'Approved rider assignment read failed';
  end if;
  if (select count(*) from storage.objects where bucket_id = 'delivery-proofs'
      and name like 'a0000000-0000-4000-8000-0000000000b1/%') <> 1 then
    raise exception 'Approved rider proof read failed';
  end if;
end $$;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.delivery_assignments where id =
      'a0000000-0000-4000-8000-0000000000b4') then
    raise exception 'Other customer could read assignment';
  end if;
  if exists (select 1 from storage.objects where bucket_id = 'delivery-proofs'
      and name like 'a0000000-0000-4000-8000-0000000000b1/%') then
    raise exception 'Other customer could read proof';
  end if;
end $$;
reset role;

update public.profiles set role = 'customer' where id =
  'a0000000-0000-4000-8000-0000000000b1';
update public.riders set approval_status = 'suspended' where id =
  'a0000000-0000-4000-8000-0000000000b1';
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.delivery_assignments where id =
      'a0000000-0000-4000-8000-0000000000b4') then
    raise exception 'Suspended rider could read assignment';
  end if;
  if exists (select 1 from storage.objects where bucket_id = 'delivery-proofs'
      and name like 'a0000000-0000-4000-8000-0000000000b1/%') then
    raise exception 'Suspended rider could read proof';
  end if;
end $$;
reset role;

update public.profiles set is_active = false where id =
  'a0000000-0000-4000-8000-0000000000b1';
set local role authenticated;
do $$ begin
  if exists (select 1 from public.delivery_assignments where id =
      'a0000000-0000-4000-8000-0000000000b4') then
    raise exception 'Inactive rider could read assignment';
  end if;
  if exists (select 1 from storage.objects where bucket_id = 'delivery-proofs'
      and name like 'a0000000-0000-4000-8000-0000000000b1/%') then
    raise exception 'Inactive rider could read proof';
  end if;
end $$;
reset role;
rollback;
