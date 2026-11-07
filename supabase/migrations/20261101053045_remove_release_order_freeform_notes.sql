-- Release keeps its fixed status-history description without a general note input.
drop function public.release_ready_order(uuid,text);

create function public.release_ready_order(p_order_id uuid)
returns table(order_id uuid, order_number varchar, previous_status public.order_status,
  current_status public.order_status)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_staff_id uuid := auth.uid();
  v_order_number varchar;
  v_fulfillment_type public.fulfillment_type;
  v_previous_status public.order_status;
  v_next_status public.order_status;
begin
  if v_staff_id is null or not exists (
    select 1 from public.profiles p
    where p.id = v_staff_id and p.is_active = true
      and p.role in ('cashier'::public.user_role, 'manager'::public.user_role)
  ) then
    raise exception 'Only an active cashier or manager may release a ready order.'
      using errcode = '42501';
  end if;

  select o.order_number, o.fulfillment_type, o.current_status
    into v_order_number, v_fulfillment_type, v_previous_status
  from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'Order not found.';
  end if;
  if v_previous_status <> 'ready'::public.order_status then
    raise exception 'Only ready orders may be released.';
  end if;

  if v_fulfillment_type = 'delivery'::public.fulfillment_type then
    v_next_status := 'waiting_for_rider'::public.order_status;
  else
    v_next_status := 'completed'::public.order_status;
  end if;

  update public.orders
  set current_status = v_next_status,
      completed_at = case when v_next_status = 'completed'::public.order_status
        then now() else completed_at end
  where id = p_order_id;

  insert into public.order_status_history (order_id, status, changed_by, notes)
  values (p_order_id, v_next_status, v_staff_id,
    case when v_next_status = 'waiting_for_rider'::public.order_status
      then 'Ready order released for rider assignment'
      else 'Ready order released and completed' end);

  if v_fulfillment_type = 'delivery'::public.fulfillment_type then
    perform public.offer_order_to_next_rider(p_order_id);
  end if;

  return query select p_order_id, v_order_number, v_previous_status, v_next_status;
end;
$$;

revoke all on function public.release_ready_order(uuid) from public, anon;
grant execute on function public.release_ready_order(uuid) to authenticated, service_role;
