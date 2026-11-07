-- Run with psql -X -At -v ON_ERROR_STOP=1 against each isolated schema clone.
-- Synthetic rows and test-only grants/functions are rolled back.
BEGIN;
GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE(contact_number) ON public.profiles TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

INSERT INTO auth.users(id) VALUES
('00000000-0000-0000-0000-000000000001'),
('00000000-0000-0000-0000-000000000002'),
('00000000-0000-0000-0000-000000000003'),
('00000000-0000-0000-0000-000000000004'),
('00000000-0000-0000-0000-000000000005'),
('00000000-0000-0000-0000-000000000006'),
('00000000-0000-0000-0000-000000000007');
INSERT INTO public.profiles(id,role,is_active,first_name) VALUES
('00000000-0000-0000-0000-000000000001','customer',true,'customer'),
('00000000-0000-0000-0000-000000000002','cashier',true,'cashier'),
('00000000-0000-0000-0000-000000000003','manager',true,'manager'),
('00000000-0000-0000-0000-000000000004','production',true,'production'),
('00000000-0000-0000-0000-000000000005','rider',true,'rider'),
('00000000-0000-0000-0000-000000000006','customer',false,'inactive'),
('00000000-0000-0000-0000-000000000007','cashier',true,'other cashier');
INSERT INTO public.riders(id,plate_number) VALUES
('00000000-0000-0000-0000-000000000005','TEST-001');

-- The deployed trigger function uses now(), so all valid updates in this
-- transaction should equal transaction_timestamp() regardless of trigger count.
UPDATE public.profiles SET first_name='edited'
 WHERE id='00000000-0000-0000-0000-000000000001';
SELECT 'profile_non_timestamp|'||(updated_at=transaction_timestamp())::text||'|'||first_name
 FROM public.profiles WHERE id='00000000-0000-0000-0000-000000000001';
UPDATE public.profiles SET first_name='multiple',contact_number='123',
 updated_at='2000-01-01 UTC' WHERE id='00000000-0000-0000-0000-000000000001';
SELECT 'profile_multi_explicit|'||(updated_at=transaction_timestamp())::text||'|'||first_name||'|'||contact_number
 FROM public.profiles WHERE id='00000000-0000-0000-0000-000000000001';
UPDATE public.profiles SET first_name='repeat'
 WHERE id='00000000-0000-0000-0000-000000000001';
SELECT 'profile_repeat|'||(updated_at=transaction_timestamp())::text||'|'||first_name
 FROM public.profiles WHERE id='00000000-0000-0000-0000-000000000001';
UPDATE public.riders SET plate_number='TEST-002'
 WHERE id='00000000-0000-0000-0000-000000000005';
SELECT 'rider_non_timestamp|'||(updated_at=transaction_timestamp())::text||'|'||plate_number
 FROM public.riders WHERE id='00000000-0000-0000-0000-000000000005';
UPDATE public.riders SET plate_number='TEST-003',availability_status='offline',
 updated_at='2000-01-01 UTC' WHERE id='00000000-0000-0000-0000-000000000005';
SELECT 'rider_multi_explicit|'||(updated_at=transaction_timestamp())::text||'|'||plate_number
 FROM public.riders WHERE id='00000000-0000-0000-0000-000000000005';
UPDATE public.riders SET plate_number='TEST-004'
 WHERE id='00000000-0000-0000-0000-000000000005';
SELECT 'rider_repeat|'||(updated_at=transaction_timestamp())::text||'|'||plate_number
 FROM public.riders WHERE id='00000000-0000-0000-0000-000000000005';
DO $checks$ BEGIN
  BEGIN
    UPDATE public.profiles SET role=NULL
      WHERE id='00000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'profile NOT NULL unexpectedly accepted';
  EXCEPTION WHEN not_null_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.riders SET approval_status=NULL
      WHERE id='00000000-0000-0000-0000-000000000005';
    RAISE EXCEPTION 'rider NOT NULL unexpectedly accepted';
  EXCEPTION WHEN not_null_violation THEN NULL;
  END;
END $checks$;
SELECT 'constraints|not_null_denied';

CREATE FUNCTION public.db03a_probe(p_id uuid) RETURNS text
 LANGUAGE plpgsql SECURITY INVOKER AS $probe$
DECLARE v_own integer; v_other integer; v_join integer; v_role text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',p_id::text,false);
  SELECT count(*) FILTER (WHERE id=p_id),count(*) FILTER (WHERE id<>p_id)
    INTO v_own,v_other FROM public.profiles;
  SELECT count(*) INTO v_join FROM public.profiles p
    JOIN public.db03a_probe_ids u ON u.id=p.id WHERE p.id=p_id;
  SELECT public.current_user_role()::text INTO v_role;
  RETURN p_id::text||'|'||v_own||'|'||v_other||'|'||v_join||'|'||coalesce(v_role,'NULL');
END $probe$;
CREATE TABLE public.db03a_probe_ids(id uuid PRIMARY KEY);
INSERT INTO public.db03a_probe_ids SELECT id FROM public.profiles;
GRANT SELECT ON public.db03a_probe_ids TO authenticated;
GRANT EXECUTE ON FUNCTION public.db03a_probe(uuid) TO authenticated;
SET ROLE authenticated;
SELECT 'role|'||public.db03a_probe(id) FROM (VALUES
 ('00000000-0000-0000-0000-000000000001'::uuid),
 ('00000000-0000-0000-0000-000000000002'::uuid),
 ('00000000-0000-0000-0000-000000000003'::uuid),
 ('00000000-0000-0000-0000-000000000004'::uuid),
 ('00000000-0000-0000-0000-000000000005'::uuid),
 ('00000000-0000-0000-0000-000000000006'::uuid),
 ('00000000-0000-0000-0000-000000000007'::uuid),
 ('00000000-0000-0000-0000-000000000008'::uuid)) AS ids(id);
SET request.jwt.claim.sub='';
SELECT 'no_claim|'||count(*) FROM public.profiles;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
UPDATE public.profiles SET contact_number='own' WHERE id='00000000-0000-0000-0000-000000000002';
SELECT 'own_update|'||contact_number FROM public.profiles WHERE id='00000000-0000-0000-0000-000000000002';
UPDATE public.profiles SET contact_number='other' WHERE id='00000000-0000-0000-0000-000000000007';
SELECT 'other_update|'||count(*) FROM public.profiles WHERE contact_number='other';
RESET ROLE;
ROLLBACK;
