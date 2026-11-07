-- Revoked or inactive riders must not retain assignment and delivery-proof reads.
-- Keep the existing owner checks and require the same active approved rider
-- condition used by the order reads and delivery-proof upload policy.
drop policy if exists rider_select_own_assignments on public.delivery_assignments;
create policy rider_select_own_assignments
on public.delivery_assignments for select to authenticated
using (
  rider_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    join public.riders r on r.id = p.id
    where p.id = (select auth.uid())
      and p.role = 'rider'::public.user_role
      and p.is_active = true
      and r.approval_status = 'approved'::public.rider_approval_status
  )
);

drop policy if exists rider_read_own_delivery_proof on storage.objects;
create policy rider_read_own_delivery_proof
on storage.objects for select to authenticated
using (
  bucket_id = 'delivery-proofs'
  and split_part(name, '/', 1) = (select auth.uid())::text
  and exists (
    select 1 from public.delivery_assignments da
    join public.profiles p on p.id = da.rider_id
    join public.riders r on r.id = da.rider_id
    where da.id::text = split_part(storage.objects.name, '/', 2)
      and da.rider_id = (select auth.uid())
      and p.role = 'rider'::public.user_role
      and p.is_active = true
      and r.approval_status = 'approved'::public.rider_approval_status
  )
);
