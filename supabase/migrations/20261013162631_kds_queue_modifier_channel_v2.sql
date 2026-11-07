-- Extend only the ticket set authorized by the original terminal RPC.
-- Keep get_kds_queue(uuid,text) intact for existing consumers.
begin;

create function public.get_kds_queue_v2(
  p_terminal_id uuid,
  p_terminal_secret text
)
returns table (
  order_id uuid,
  order_number varchar,
  fulfillment_type public.fulfillment_type,
  current_status public.order_status,
  notes text,
  created_at timestamptz,
  items jsonb,
  order_channel public.order_channel
)
language sql
security definer
set search_path = ''
as $$
  select q.order_id, q.order_number, q.fulfillment_type,
         q.current_status, q.notes, q.created_at,
         coalesce((
           select jsonb_agg(
             jsonb_set(entry.item, '{modifiers}', coalesce((
               select jsonb_agg(jsonb_build_object(
                 'id', modifier.value->'id',
                 'name', modifier.value->'name',
                 'price', modifier.value->'price'
               ) order by modifier.ordinality)
               from jsonb_array_elements(case
                 when jsonb_typeof(oi.modifiers) = 'array' then oi.modifiers
                 else '[]'::jsonb
               end) with ordinality as modifier(value, ordinality)
               where jsonb_typeof(modifier.value->'id') = 'string'
                 and jsonb_typeof(modifier.value->'name') = 'string'
                 and jsonb_typeof(modifier.value->'price') = 'number'
             ), '[]'::jsonb), true)
             order by entry.ordinality
           )
           from jsonb_array_elements(q.items) with ordinality as entry(item, ordinality)
           left join public.order_items oi
             on oi.id = (entry.item->>'id')::uuid
            and oi.order_id = q.order_id
         ), '[]'::jsonb),
         o.order_channel
  from public.get_kds_queue(p_terminal_id, p_terminal_secret) q
  join public.orders o on o.id = q.order_id
  order by q.created_at, q.order_id;
$$;

revoke all on function public.get_kds_queue_v2(uuid, text) from public, anon, authenticated;
grant execute on function public.get_kds_queue_v2(uuid, text) to anon, authenticated, service_role;

commit;
