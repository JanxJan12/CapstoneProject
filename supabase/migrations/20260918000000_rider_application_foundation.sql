begin;

-- ============================================================
-- 1. PRIVATE RIDER APPLICATION DOCUMENT BUCKET
-- ============================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'rider-documents',
  'rider-documents',
  false,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'application/pdf'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ============================================================
-- 2. STORAGE POLICIES
--
-- Path format:
-- {user-id}/valid-id/{filename}
-- {user-id}/or-cr/{filename}
-- {user-id}/photo/{filename}
-- ============================================================

drop policy if exists
  "rider_applicant_upload_own_documents"
on storage.objects;

create policy
  "rider_applicant_upload_own_documents"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'rider-documents'
  and split_part(name, '/', 1) = auth.uid()::text
  and split_part(name, '/', 2) in (
    'valid-id',
    'or-cr',
    'photo'
  )
  and split_part(name, '/', 3) <> ''
  and split_part(name, '/', 4) = ''
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role = 'customer'::public.user_role
  )
);


drop policy if exists
  "rider_applicant_read_own_documents"
on storage.objects;

create policy
  "rider_applicant_read_own_documents"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'rider-documents'
  and split_part(name, '/', 1) = auth.uid()::text
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in (
        'customer'::public.user_role,
        'rider'::public.user_role
      )
  )
);


drop policy if exists
  "manager_read_rider_application_documents"
on storage.objects;

create policy
  "manager_read_rider_application_documents"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'rider-documents'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role = 'manager'::public.user_role
  )
);


-- ============================================================
-- 3. RIDER APPLICATION SUBMISSION RPC
-- ============================================================

create or replace function public.submit_rider_application(
  p_contact_number text,
  p_driver_license_number text,
  p_plate_number text,
  p_motor_brand text,
  p_motor_model text,
  p_valid_id_path text,
  p_or_cr_document_path text,
  p_rider_photo_path text
)
returns table (
  rider_id uuid,
  approval_status public.rider_approval_status,
  availability_status public.rider_availability_status,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;

  v_contact_number text;
  v_driver_license_number text;
  v_plate_number text;
  v_motor_brand text;
  v_motor_model text;

  v_valid_id_path text;
  v_or_cr_document_path text;
  v_rider_photo_path text;

  v_created_at timestamptz;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception
      'Authentication is required to submit a rider application.'
      using errcode = '28000';
  end if;


  -- Applicant must currently be an active customer.
  if not exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
      and p.is_active = true
      and p.role = 'customer'::public.user_role
  ) then
    raise exception
      'Only an active customer account may submit a rider application.'
      using errcode = '42501';
  end if;


  -- One rider application per account.
  if exists (
    select 1
    from public.riders r
    where r.id = v_user_id
  ) then
    raise exception
      'A rider application already exists for this account.'
      using errcode = '23505';
  end if;


  v_contact_number :=
    nullif(btrim(p_contact_number), '');

  v_driver_license_number :=
    nullif(btrim(p_driver_license_number), '');

  v_plate_number :=
    nullif(btrim(p_plate_number), '');

  v_motor_brand :=
    nullif(btrim(p_motor_brand), '');

  v_motor_model :=
    nullif(btrim(p_motor_model), '');

  v_valid_id_path :=
    nullif(btrim(p_valid_id_path), '');

  v_or_cr_document_path :=
    nullif(btrim(p_or_cr_document_path), '');

  v_rider_photo_path :=
    nullif(btrim(p_rider_photo_path), '');


  if v_contact_number is null then
    raise exception
      'Contact number is required.'
      using errcode = '22023';
  end if;

  if char_length(v_contact_number) > 100 then
    raise exception
      'Contact number is too long.'
      using errcode = '22023';
  end if;


  if v_driver_license_number is null then
    raise exception
      'Driver license number is required.'
      using errcode = '22023';
  end if;

  if char_length(v_driver_license_number) > 100 then
    raise exception
      'Driver license number is too long.'
      using errcode = '22023';
  end if;


  if v_plate_number is null then
    raise exception
      'Plate number is required.'
      using errcode = '22023';
  end if;

  if char_length(v_plate_number) > 100 then
    raise exception
      'Plate number is too long.'
      using errcode = '22023';
  end if;


  if v_motor_brand is null then
    raise exception
      'Motor brand is required.'
      using errcode = '22023';
  end if;

  if char_length(v_motor_brand) > 100 then
    raise exception
      'Motor brand is too long.'
      using errcode = '22023';
  end if;


  if v_motor_model is null then
    raise exception
      'Motor model is required.'
      using errcode = '22023';
  end if;

  if char_length(v_motor_model) > 100 then
    raise exception
      'Motor model is too long.'
      using errcode = '22023';
  end if;


  -- ==========================================================
  -- Validate submitted document paths.
  -- ==========================================================

  if
    v_valid_id_path is null
    or split_part(v_valid_id_path, '/', 1) <> v_user_id::text
    or split_part(v_valid_id_path, '/', 2) <> 'valid-id'
    or split_part(v_valid_id_path, '/', 3) = ''
    or split_part(v_valid_id_path, '/', 4) <> ''
  then
    raise exception
      'The valid ID document path is invalid.'
      using errcode = '22023';
  end if;


  if
    v_or_cr_document_path is null
    or split_part(v_or_cr_document_path, '/', 1) <> v_user_id::text
    or split_part(v_or_cr_document_path, '/', 2) <> 'or-cr'
    or split_part(v_or_cr_document_path, '/', 3) = ''
    or split_part(v_or_cr_document_path, '/', 4) <> ''
  then
    raise exception
      'The OR/CR document path is invalid.'
      using errcode = '22023';
  end if;


  if
    v_rider_photo_path is null
    or split_part(v_rider_photo_path, '/', 1) <> v_user_id::text
    or split_part(v_rider_photo_path, '/', 2) <> 'photo'
    or split_part(v_rider_photo_path, '/', 3) = ''
    or split_part(v_rider_photo_path, '/', 4) <> ''
  then
    raise exception
      'The rider photo path is invalid.'
      using errcode = '22023';
  end if;


  -- Ensure all uploaded files actually exist.
  if not exists (
    select 1
    from storage.objects so
    where so.bucket_id = 'rider-documents'
      and so.name = v_valid_id_path
  ) then
    raise exception
      'The uploaded valid ID could not be found.'
      using errcode = 'P0002';
  end if;


  if not exists (
    select 1
    from storage.objects so
    where so.bucket_id = 'rider-documents'
      and so.name = v_or_cr_document_path
  ) then
    raise exception
      'The uploaded OR/CR document could not be found.'
      using errcode = 'P0002';
  end if;


  if not exists (
    select 1
    from storage.objects so
    where so.bucket_id = 'rider-documents'
      and so.name = v_rider_photo_path
  ) then
    raise exception
      'The uploaded rider photo could not be found.'
      using errcode = 'P0002';
  end if;


  -- Keep applicant profile as CUSTOMER until manager approval.
  update public.profiles
  set
    contact_number = v_contact_number,
    updated_at = now()
  where id = v_user_id;


  insert into public.riders (
    id,
    valid_id_path,
    or_cr_document_path,
    driver_license_number,
    plate_number,
    motor_brand,
    motor_model,
    rider_photo_path,
    approval_status,
    availability_status
  )
  values (
    v_user_id,
    v_valid_id_path,
    v_or_cr_document_path,
    v_driver_license_number,
    v_plate_number,
    v_motor_brand,
    v_motor_model,
    v_rider_photo_path,
    'pending'::public.rider_approval_status,
    'offline'::public.rider_availability_status
  )
  returning riders.created_at
  into v_created_at;


  return query
  select
    v_user_id,
    'pending'::public.rider_approval_status,
    'offline'::public.rider_availability_status,
    v_created_at;
end;
$$;


revoke all
on function public.submit_rider_application(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
from public, anon;

grant execute
on function public.submit_rider_application(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
to authenticated, service_role;


commit;