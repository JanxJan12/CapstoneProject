-- PostgreSQL 17 MAINTAIN remains granted to authenticated on these tables.
-- Keep their existing SELECT grants and RLS policies unchanged.
REVOKE MAINTAIN ON TABLE
  public.cashier_shifts,
  public.cashier_transactions,
  public.riders
FROM authenticated;
