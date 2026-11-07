-- CASHIER-DB-02B isolated PostgreSQL 17 replay. Synthetic data only.
\set ON_ERROR_STOP on
DO $$BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; END$$;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
CREATE TYPE public.user_role AS ENUM ('customer','cashier','manager','kitchen','rider');
CREATE TABLE public.profiles (id uuid PRIMARY KEY, role public.user_role NOT NULL, is_active boolean NOT NULL, display_name text, contact_number text, updated_at timestamptz NOT NULL DEFAULT '2020-01-01 UTC');
CREATE TABLE public.riders (id uuid PRIMARY KEY, display_name text, updated_at timestamptz NOT NULL DEFAULT '2020-01-01 UTC');
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE(contact_number) ON public.profiles TO authenticated;
GRANT SELECT ON public.riders TO authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid$$;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$BEGIN NEW.updated_at = now(); RETURN NEW; END$$;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER riders_set_updated_at BEFORE UPDATE ON public.riders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_riders_set_updated_at BEFORE UPDATE ON public.riders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.profiles(id,role,is_active,display_name) VALUES
('00000000-0000-0000-0000-000000000001','customer',true,'customer'),
('00000000-0000-0000-0000-000000000002','cashier',true,'cashier'),
('00000000-0000-0000-0000-000000000003','manager',true,'manager'),
('00000000-0000-0000-0000-000000000004','kitchen',true,'kitchen'),
('00000000-0000-0000-0000-000000000005','rider',true,'rider'),
('00000000-0000-0000-0000-000000000006','customer',false,'inactive'),
('00000000-0000-0000-0000-000000000007','customer',true,'other');
INSERT INTO public.riders(id,display_name) VALUES ('00000000-0000-0000-0000-000000000005','rider');
CREATE FUNCTION public.current_user_role() RETURNS public.user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$SELECT p.role FROM public.profiles p WHERE p.id=auth.uid() AND p.is_active=true$$;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING (((SELECT auth.uid())=id));
CREATE POLICY profiles_view_own ON public.profiles FOR SELECT TO authenticated USING ((id=(SELECT auth.uid())));
CREATE POLICY managers_view_profiles ON public.profiles FOR SELECT TO authenticated USING ((public.current_user_role()='manager'::public.user_role));
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING (((SELECT auth.uid())=id)) WITH CHECK (((SELECT auth.uid())=id));
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.fixture_ids(id uuid PRIMARY KEY);
INSERT INTO public.fixture_ids SELECT id FROM public.profiles;
GRANT SELECT ON public.fixture_ids TO authenticated;
CREATE FUNCTION public.probe_profile(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE result jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',p_id::text,false);
  SELECT jsonb_build_object('id',p_id,'visible',coalesce(jsonb_agg(p.id ORDER BY p.id),'[]'::jsonb),'own',count(*) FILTER (WHERE p.id=p_id),'other',count(*) FILTER (WHERE p.id<>p_id),'role',public.current_user_role()) INTO result FROM public.profiles p;
  RETURN result;
END$$;
GRANT EXECUTE ON FUNCTION public.probe_profile(uuid) TO authenticated;
\echo BASELINE_POLICY_MATRIX
SET ROLE authenticated;
SELECT public.probe_profile(id) FROM public.fixture_ids ORDER BY id;
SET request.jwt.claim.sub = '';
SELECT 'no_claim' AS case_name,count(*) AS visible FROM public.profiles;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
SELECT 'filtered_join' AS case_name,count(*) AS visible FROM public.fixture_ids f JOIN public.profiles p USING(id) WHERE p.role='cashier';
BEGIN;
UPDATE public.profiles SET contact_number='own' WHERE id='00000000-0000-0000-0000-000000000002' RETURNING id,contact_number;
UPDATE public.profiles SET contact_number='other' WHERE id='00000000-0000-0000-0000-000000000001' RETURNING id,contact_number;
ROLLBACK;
RESET ROLE;
\echo BASELINE_TRIGGERS
BEGIN;
UPDATE public.profiles SET display_name='changed',updated_at='2000-01-01 UTC' WHERE id='00000000-0000-0000-0000-000000000001' RETURNING id,display_name,updated_at=transaction_timestamp() AS stamped;
UPDATE public.riders SET display_name='changed',updated_at='2000-01-01 UTC' WHERE id='00000000-0000-0000-0000-000000000005' RETURNING id,display_name,updated_at=transaction_timestamp() AS stamped;
ROLLBACK;
DROP TRIGGER trg_profiles_set_updated_at ON public.profiles;
DROP TRIGGER trg_riders_set_updated_at ON public.riders;
DROP POLICY profiles_view_own ON public.profiles;
\echo AFTER_POLICY_MATRIX
SET ROLE authenticated;
SELECT public.probe_profile(id) FROM public.fixture_ids ORDER BY id;
SET request.jwt.claim.sub = '';
SELECT 'no_claim' AS case_name,count(*) AS visible FROM public.profiles;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
SELECT 'filtered_join' AS case_name,count(*) AS visible FROM public.fixture_ids f JOIN public.profiles p USING(id) WHERE p.role='cashier';
BEGIN;
UPDATE public.profiles SET contact_number='own' WHERE id='00000000-0000-0000-0000-000000000002' RETURNING id,contact_number;
UPDATE public.profiles SET contact_number='other' WHERE id='00000000-0000-0000-0000-000000000001' RETURNING id,contact_number;
ROLLBACK;
RESET ROLE;
\echo AFTER_TRIGGERS
BEGIN;
UPDATE public.profiles SET display_name='changed',updated_at='2000-01-01 UTC' WHERE id='00000000-0000-0000-0000-000000000001' RETURNING id,display_name,updated_at=transaction_timestamp() AS stamped;
UPDATE public.riders SET display_name='changed',updated_at='2000-01-01 UTC' WHERE id='00000000-0000-0000-0000-000000000005' RETURNING id,display_name,updated_at=transaction_timestamp() AS stamped;
ROLLBACK;
