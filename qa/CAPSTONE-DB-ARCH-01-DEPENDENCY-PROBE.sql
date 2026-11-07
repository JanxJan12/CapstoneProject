-- Isolated schema-only clone. All grants, fixture rows and DDL roll back.
\set ON_ERROR_STOP off
BEGIN;
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT ON public.profiles, public.cashier_shifts TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_closed_cashier_shifts(timestamptz,timestamptz,uuid,timestamptz,uuid,integer) TO authenticated;
INSERT INTO auth.users(id) VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO public.profiles(id,role,is_active) VALUES ('00000000-0000-0000-0000-000000000001','cashier',true);
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
\echo BASELINE_RPC
SELECT count(*) AS closed_shift_rows FROM public.get_closed_cashier_shifts(p_limit=>1);
RESET ROLE;
SAVEPOINT before_drop_by;
ALTER TABLE public.cashier_shifts DROP COLUMN manager_approved_by;
SET ROLE authenticated;
\echo AFTER_DROP_BY_EXPECT_ERROR
SELECT count(*) AS closed_shift_rows FROM public.get_closed_cashier_shifts(p_limit=>1);
ROLLBACK TO SAVEPOINT before_drop_by;
SAVEPOINT before_drop_at;
ALTER TABLE public.cashier_shifts DROP COLUMN manager_approved_at;
SET ROLE authenticated;
\echo AFTER_DROP_AT_EXPECT_ERROR
SELECT count(*) AS closed_shift_rows FROM public.get_closed_cashier_shifts(p_limit=>1);
ROLLBACK TO SAVEPOINT before_drop_at;
ROLLBACK;
