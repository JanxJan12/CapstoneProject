-- QA-only restoration rehearsal on an isolated disposable database.
-- Captured from the 31 October hosted catalog; not an active migration.
BEGIN;
CREATE TRIGGER trg_profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_riders_set_updated_at BEFORE UPDATE ON public.riders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY profiles_view_own ON public.profiles AS PERMISSIVE FOR SELECT
  TO authenticated USING (id = (SELECT auth.uid()));
COMMIT;
