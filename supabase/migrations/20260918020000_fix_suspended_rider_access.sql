begin;

create or replace function public.set_manager_rider_approval_status(
  p_rider_id uuid,
  p_status public.rider_approval_status
)
returns table(
  rider_id uuid,
  approval_status public.rider_approval_status,
  availability_status public.rider_availability_status,
  profile_role public.user_role,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_current_status public.rider_approval_status;
  v_current_availability public.rider_availability_status;

  v_profile_role public.user_role;
  v_profile_active boolean;

  v_valid_id_path text;
  v_or_cr_document_path text;
  v_rider_photo_path text;

  v_driver_license_number text;
  v_plate_number text;
  v_motor_brand text;
  v_motor_model text;

  v_updated_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles manager_profile
    where manager_profile.id = auth.uid()
      and manager_profile.role = 'manager'::public.user_role
      and manager_profile.is_active = true
  ) then
    raise exception 'Active manager access required.'
      using errcode = '42501';
  end if;

  if p_rider_id is null then
    raise exception 'Rider ID is required.'
      using errcode = '22023';
  end if;

  if p_status is null
    or p_status not in (
      'approved'::public.rider_approval_status,
      'suspended'::public.rider_approval_status
    )
  then
    raise exception
      'Manager may only approve or suspend a rider.'
      using errcode = '22023';
  end if;

  select
    rider.approval_status,
    rider.availability_status,
    rider.valid_id_path,
    rider.or_cr_document_path,
    rider.rider_photo_path,
    rider.driver_license_number,
    rider.plate_number,
    rider.motor_brand,
    rider.motor_model
  into
    v_current_status,
    v_current_availability,
    v_valid_id_path,
    v_or_cr_document_path,
    v_rider_photo_path,
    v_driver_license_number,
    v_plate_number,
    v_motor_brand,
    v_motor_model
  from public.riders rider
  where rider.id = p_rider_id
  for update;

  if not found then
    raise exception 'Rider application was not found.'
      using errcode = 'P0002';
  end if;

  select
    profile.role,
    profile.is_active
  into
    v_profile_role,
    v_profile_active
  from public.profiles profile
  where profile.id = p_rider_id
  for update;

  if not found then
    raise exception 'Rider profile was not found.'
      using errcode = 'P0002';
  end if;


  -- ==========================================================
  -- APPROVE / RESTORE
  -- ==========================================================

  if p_status = 'approved'::public.rider_approval_status then

    if v_current_status = 'rejected'::public.rider_approval_status then
      raise exception
        'Legacy rejected rider applications cannot be approved through this workflow.'
        using errcode = '22023';
    end if;

    if not v_profile_active then
      raise exception
        'An inactive account cannot be approved as a rider.'
        using errcode = '42501';
    end if;

    if v_current_status = 'pending'::public.rider_approval_status then

      if nullif(btrim(v_driver_license_number), '') is null
        or nullif(btrim(v_plate_number), '') is null
        or nullif(btrim(v_motor_brand), '') is null
        or nullif(btrim(v_motor_model), '') is null
      then
        raise exception
          'The rider application has incomplete vehicle or license details.'
          using errcode = '22023';
      end if;

      if nullif(btrim(v_valid_id_path), '') is null
        or nullif(btrim(v_or_cr_document_path), '') is null
        or nullif(btrim(v_rider_photo_path), '') is null
      then
        raise exception
          'The rider application has incomplete documents.'
          using errcode = '22023';
      end if;

      if not exists (
        select 1
        from storage.objects stored_object
        where stored_object.bucket_id = 'rider-documents'
          and stored_object.name = v_valid_id_path
      ) then
        raise exception
          'The rider valid ID document could not be found.'
          using errcode = 'P0002';
      end if;

      if not exists (
        select 1
        from storage.objects stored_object
        where stored_object.bucket_id = 'rider-documents'
          and stored_object.name = v_or_cr_document_path
      ) then
        raise exception
          'The rider OR/CR document could not be found.'
          using errcode = 'P0002';
      end if;

      if not exists (
        select 1
        from storage.objects stored_object
        where stored_object.bucket_id = 'rider-documents'
          and stored_object.name = v_rider_photo_path
      ) then
        raise exception
          'The rider photo could not be found.'
          using errcode = 'P0002';
      end if;

    end if;

    update public.profiles
    set
      role = 'rider'::public.user_role,
      updated_at = now()
    where id = p_rider_id;

    v_profile_role := 'rider'::public.user_role;

    if v_current_status <> 'approved'::public.rider_approval_status then
      update public.riders
      set
        approval_status = 'approved'::public.rider_approval_status,
        availability_status = 'offline'::public.rider_availability_status,
        updated_at = now()
      where id = p_rider_id
      returning
        riders.availability_status,
        riders.updated_at
      into
        v_current_availability,
        v_updated_at;
    else
      select rider.updated_at
      into v_updated_at
      from public.riders rider
      where rider.id = p_rider_id;
    end if;

    return query
    select
      p_rider_id,
      'approved'::public.rider_approval_status,
      v_current_availability,
      v_profile_role,
      v_updated_at;

    return;
  end if;


  -- ==========================================================
  -- SUSPEND
  -- ==========================================================

  if v_current_status = 'pending'::public.rider_approval_status then
    raise exception
      'A pending rider application cannot be suspended.'
      using errcode = '22023';
  end if;

  if v_current_status = 'rejected'::public.rider_approval_status then
    raise exception
      'A rejected rider application cannot be suspended.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.delivery_assignments assignment
    where assignment.rider_id = p_rider_id
      and assignment.status in (
        'offered'::public.delivery_assignment_status,
        'accepted'::public.delivery_assignment_status,
        'picked_up'::public.delivery_assignment_status,
        'out_for_delivery'::public.delivery_assignment_status
      )
  ) then
    raise exception
      'The rider cannot be suspended while an active delivery assignment exists.'
      using errcode = '55000';
  end if;

  update public.profiles
  set
    role = 'customer'::public.user_role,
    updated_at = case
      when role <> 'customer'::public.user_role
      then now()
      else updated_at
    end
  where id = p_rider_id;

  v_profile_role := 'customer'::public.user_role;

  update public.riders
  set
    approval_status = 'suspended'::public.rider_approval_status,
    availability_status = 'offline'::public.rider_availability_status,
    updated_at = case
      when approval_status <> 'suspended'::public.rider_approval_status
        or availability_status <> 'offline'::public.rider_availability_status
      then now()
      else updated_at
    end
  where id = p_rider_id
  returning
    riders.availability_status,
    riders.updated_at
  into
    v_current_availability,
    v_updated_at;

  return query
  select
    p_rider_id,
    'suspended'::public.rider_approval_status,
    v_current_availability,
    v_profile_role,
    v_updated_at;
end;
$function$;


revoke all
on function public.set_manager_rider_approval_status(
  uuid,
  public.rider_approval_status
)
from public, anon;

grant execute
on function public.set_manager_rider_approval_status(
  uuid,
  public.rider_approval_status
)
to authenticated, service_role;

commit;