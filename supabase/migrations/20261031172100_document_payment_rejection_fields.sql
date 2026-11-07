-- The two values serve different parts of the GCash rejection contract.
-- Keep both columns and the existing RPC return shapes intact.
comment on column public.payments.rejection_reason is
  'Cashier-selected GCash rejection category; returned to Cashier and Customer while payment is rejected.';

comment on column public.payments.rejection_notes is
  'Optional Cashier explanation for a GCash rejection; required by reject_customer_gcash_payment when category is Other.';
