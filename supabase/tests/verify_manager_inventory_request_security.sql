-- Disposable local database only. Synthetic users and all changes roll back.
begin;
do $verify$
declare
  v_role text;
  v_user uuid;
  v_blocked boolean;
  v_denials integer := 0;
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'inventory_request_manager_required', 'get_inventory_request_proposal',
      'issue_inventory_request', 'record_inventory_request_event',
      'start_inventory_request_receiving', 'close_inventory_request_short',
      'revise_inventory_request', 'get_inventory_request_register')
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ) then
    raise exception 'Anonymous request RPC grant found';
  end if;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in (
      'inventory_request_documents', 'inventory_request_lines',
      'inventory_request_revisions', 'inventory_request_events')
      and (not c.relrowsecurity or has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE'))
  ) then
    raise exception 'Request table RLS or authenticated direct-write grant is unsafe';
  end if;

  foreach v_role in array array['customer', 'cashier', 'production', 'rider'] loop
    v_user := gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'verify-' || v_role || '-' || v_user || '@example.invalid',
      '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
    insert into public.profiles (id, first_name, role, is_active)
    values (v_user, 'Verify ' || v_role, v_role::public.user_role, true)
    on conflict (id) do update set role = excluded.role, is_active = true;
    perform set_config('request.jwt.claim.sub', v_user::text, true);
    v_blocked := false;
    begin
      perform public.get_inventory_request_proposal(now() + interval '2 days');
    exception when insufficient_privilege then v_blocked := true;
    end;
    if not v_blocked then raise exception '% read Manager proposal', v_role; end if;
    v_denials := v_denials + 1;
    v_blocked := false;
    begin
      perform public.issue_inventory_request(gen_random_uuid(), 'scheduled',
        now() + interval '2 days',
        '[{"inventory_item_id":"22222222-2222-4222-8222-222222222222","quantity":5}]'::jsonb,
        '[]'::jsonb);
    exception when insufficient_privilege then v_blocked := true;
    end;
    if not v_blocked then raise exception '% issued Manager request', v_role; end if;
    v_denials := v_denials + 1;
    v_blocked := false;
    begin
      perform public.get_inventory_request_register();
    exception when insufficient_privilege then v_blocked := true;
    end;
    if not v_blocked then raise exception '% read Manager register', v_role; end if;
    v_denials := v_denials + 1;
  end loop;
  raise notice 'Request security checks passed: 8 anonymous RPC denials, 4 RLS tables, % role/RPC denials', v_denials;
end;
$verify$;
rollback;
