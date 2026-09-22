begin;

-- ============================================================
-- 1. MANAGER RIDER LIST
--
-- Pending applicants remain profile.role = customer until
-- approved, so the manager list must not require role = rider.
-- ============================================================

create or replace function public.get_manager_riders()
returns table(
  id uuid,
  rider_name text,
  contact_number text,
  driver_license_number text,
  plate_number text,
  motor_brand text,
  motor_model text,
  approval_status public.rider_approval_status,
  availability_status public.rider_availability_status,
  is_active boolean,
  deliveries_today bigint,
  total_deliveries bigint,
  last_assigned_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'manager'::public.user_role
      and profile.is_active = true
  ) then
    raise exception 'Active manager access required.'
      using errcode = '42501';
  end if;

  return query
  select
    rider.id,

    coalesce(
      nullif(
        btrim(
          concat_ws(
            ' ',
            nullif(btrim(rider_profile.first_name), ''),
            nullif(btrim(rider_profile.last_name), '')
          )
        ),
        ''
      ),
      'Rider'
    )::text as rider_name,

    nullif(btrim(rider_profile.contact_number), '')::text,

    nullif(
      btrim(rider.driver_license_number),
      ''
    )::text,

    nullif(
      btrim(rider.plate_number),
      ''
    )::text,

    nullif(
      btrim(rider.motor_brand),
      ''
    )::text,

    nullif(
      btrim(rider.motor_model),
      ''
    )::text,

    rider.approval_status,
    rider.availability_status,
    rider_profile.is_active,

    delivery_stats.deliveries_today,
    delivery_stats.total_deliveries,

    rider.last_assigned_at

  from public.riders rider

  join public.profiles rider_profile
    on rider_profile.id = rider.id

  left join lateral (
    select
      count(*) filter (
        where assignment.status =
          'delivered'::public.delivery_assignment_status

          and assignment.delivered_at >= (
            (
              current_timestamp
              at time zone 'Asia/Manila'
            )::date
            at time zone 'Asia/Manila'
          )

          and assignment.delivered_at < (
            (
              (
                current_timestamp
                at time zone 'Asia/Manila'
              )::date + 1
            )
            at time zone 'Asia/Manila'
          )
      )::bigint as deliveries_today,

      count(*) filter (
        where assignment.status =
          'delivered'::public.delivery_assignment_status
      )::bigint as total_deliveries

    from public.delivery_assignments assignment

    where assignment.rider_id = rider.id
  ) delivery_stats
    on true

  order by
    case rider.approval_status
      when 'pending'::public.rider_approval_status then 0
      when 'approved'::public.rider_approval_status then 1
      when 'suspended'::public.rider_approval_status then 2
      else 3
    end,
    rider_profile.first_name,
    rider_profile.last_name,
    rider.id;
end;
$function$;


revoke all
on function public.get_manager_riders()
from public, anon;

grant execute
on function public.get_manager_riders()
to authenticated, service_role;


-- ============================================================
-- 2. MANAGER RIDER APPLICATION DETAIL
--
-- Returns private document paths only to an active manager.
-- The frontend can use the rider-documents bucket to display
-- those files for review.
-- ============================================================

create or replace function public.get_manager_rider_application(
  p_rider_id uuid
)
returns table(
  id uuid,
  rider_name text,
  contact_number text,
  valid_id_path text,
  or_cr_document_path text,
  rider_photo_path text,
  driver_license_number text,
  plate_number text,
  motor_brand text,
  motor_model text,
  approval_status public.rider_approval_status,
  availability_status public.rider_availability_status,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'manager'::public.user_role
      and profile.is_active = true
  ) then
    raise exception 'Active manager access required.'
      using errcode = '42501';
  end if;

  if p_rider_id is null then
    raise exception 'Rider ID is required.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.riders rider
    where rider.id = p_rider_id
  ) then
    raise exception 'Rider application was not found.'
      using errcode = 'P0002';
  end if;

  return query
  select
    rider.id,

    coalesce(
      nullif(
        btrim(
          concat_ws(
            ' ',
            nullif(btrim(profile.first_name), ''),
            nullif(btrim(profile.last_name), '')
          )
        ),
        ''
      ),
      'Rider'
    )::text,

    nullif(btrim(profile.contact_number), '')::text,

    rider.valid_id_path,
    rider.or_cr_document_path,
    rider.rider_photo_path,

    nullif(
      btrim(rider.driver_license_number),
      ''
    )::text,

    nullif(
      btrim(rider.plate_number),
      ''
    )::text,

    nullif(
      btrim(rider.motor_brand),
      ''
    )::text,

    nullif(
      btrim(rider.motor_model),
      ''
    )::text,

    rider.approval_status,
    rider.availability_status,
    profile.is_active,
    rider.created_at,
    rider.updated_at

  from public.riders rider

  join public.profiles profile
    on profile.id = rider.id

  where rider.id = p_rider_id;
end;
$function$;


revoke all
on function public.get_manager_rider_application(uuid)
from public, anon;

grant execute
on function public.get_manager_rider_application(uuid)
to authenticated, service_role;


-- ============================================================
-- 3. MANAGER APPROVE / SUSPEND RIDER
--
-- Allowed manager-visible operational states:
--
-- pending    -> approved
-- approved   -> suspended
-- suspended  -> approved
--
-- rejected is retained only for legacy compatibility.
-- ============================================================

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
      and manager_profile.role =
        'manager'::public.user_role
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

    if v_current_status =
      'rejected'::public.rider_approval_status
    then
      raise exception
        'Legacy rejected rider applications cannot be approved through this workflow.'
        using errcode = '22023';
    end if;


    if not v_profile_active then
      raise exception
        'An inactive account cannot be approved as a rider.'
        using errcode = '42501';
    end if;


    -- New pending applications must have complete credentials.
    if v_current_status =
      'pending'::public.rider_approval_status
    then

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
        where stored_object.bucket_id =
          'rider-documents'
          and stored_object.name =
            v_valid_id_path
      ) then
        raise exception
          'The rider valid ID document could not be found.'
          using errcode = 'P0002';
      end if;


      if not exists (
        select 1
        from storage.objects stored_object
        where stored_object.bucket_id =
          'rider-documents'
          and stored_object.name =
            v_or_cr_document_path
      ) then
        raise exception
          'The rider OR/CR document could not be found.'
          using errcode = 'P0002';
      end if;


      if not exists (
        select 1
        from storage.objects stored_object
        where stored_object.bucket_id =
          'rider-documents'
          and stored_object.name =
            v_rider_photo_path
      ) then
        raise exception
          'The rider photo could not be found.'
          using errcode = 'P0002';
      end if;

    end if;


    -- Promotion from applicant/customer to operational rider.
    update public.profiles
    set
      role = 'rider'::public.user_role,
      updated_at = now()
    where id = p_rider_id;

    v_profile_role := 'rider'::public.user_role;


    -- Replay-safe: approving an already approved rider does not
    -- force an available rider back offline.
    if v_current_status <>
      'approved'::public.rider_approval_status
    then
      update public.riders
      set
        approval_status =
          'approved'::public.rider_approval_status,
        availability_status =
          'offline'::public.rider_availability_status,
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

  if v_current_status =
    'pending'::public.rider_approval_status
  then
    raise exception
      'A pending rider application cannot be suspended.'
      using errcode = '22023';
  end if;


  if v_current_status =
    'rejected'::public.rider_approval_status
  then
    raise exception
      'A rejected rider application cannot be suspended.'
      using errcode = '22023';
  end if;


  -- Replay-safe suspended request.
  if v_current_status =
    'suspended'::public.rider_approval_status
  then
    update public.riders
    set
      availability_status =
        'offline'::public.rider_availability_status,
      updated_at = case
        when availability_status <>
          'offline'::public.rider_availability_status
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

    return;
  end if;


  -- Do not suspend somebody in the middle of an active delivery.
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


  update public.riders
  set
    approval_status =
      'suspended'::public.rider_approval_status,
    availability_status =
      'offline'::public.rider_availability_status,
    updated_at = now()
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