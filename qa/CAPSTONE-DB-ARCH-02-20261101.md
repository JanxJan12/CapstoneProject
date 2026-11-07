# CAPSTONE-DB-ARCH-02 — Payment rejection fields

**Date:** 1 November 2026 (Asia/Manila). **Decision:** retain both columns. The candidate named `payments.notes` does not exist; the actual optional column is `public.payments.rejection_notes`. The only local schema change documents the two distinct meanings with `COMMENT ON COLUMN`. No column, RPC output, grant, policy, trigger, client behavior, hosted schema, or hosted business row was changed.

## Evidence and decision

| Field | Meaning and hosted evidence | Disposition |
| --- | --- | --- |
| `rejection_reason` | Required controlled category for a rejected GCash proof, such as `Other`. Nonnull in 2 of 44 hosted payments, both rejected. Cashier and Customer read it; the rejection RPC writes it, and resubmission clears it. | Retain. Removing it would lose a distinct historical category and break live RPCs. |
| `rejection_notes` | Optional Cashier explanation, mandatory when category is `Other`, limited to 300 characters by the rejection RPC. Nonnull in 1 of 44 hosted payments; that row also has a reason, and its text differs from the reason. One rejected payment has a reason without a note. Resubmission clears it. | Retain. The differing historic value and `Other` rule disprove redundancy. |

Hosted status totals were 2 rejected and 42 verified; no pending row at the time of the read. The four relevant nonnull categories were 1 reason only, 1 both, 0 note only, and 0 identical pairs. No payment IDs, note text, or proof paths were extracted. These are point-in-time aggregates, not a guarantee against later writes.

The deployed `reject_customer_gcash_payment(uuid,text,text)` takes `p_reason` and `p_notes` separately, validates the category and the required `Other` explanation, writes both fields, and records a combined order-history note. `get_cashier_online_payments()` and `get_customer_order_payment(uuid)` return both columns; `get_cashier_sale(uuid)` also embeds them in payment JSON. `submit_customer_payment` clears both on a rejected proof's resubmission. The Customer page displays both; the Cashier queue and rejection API map both, and sale hydration reads the reason. Rider source references found by search concerned rider-assignment rejection, not `payments`. Hosted PostgREST statement aggregates include 4,493 and 286 Cashier-queue calls, 215 Customer-payment calls, and 7 rejection calls; the aggregates do not identify external clients or their selected fields. External contract clearance is therefore unavailable, independently of the historical-value reason to retain both.

`payments` has RLS enabled and no table policy; authenticated/anon have SELECT column grants but RLS still blocks direct table rows. The three payment RPCs above allow authenticated execution and deny anon execution; each body performs role or ownership checks. Neither field has a column-specific index or CHECK; the relevant payment triggers lock pending GCash against shift closure and set timestamps, without targeting either field. No public view definition referenced these fields. The distinct RPC source references remain live dependencies even where PostgreSQL's catalog cannot enforce a PL/pgSQL body dependency at DDL time.

## Local implementation and verification

Created `supabase/migrations/20261031172100_document_payment_rejection_fields.sql` using the Supabase CLI. It adds only two column comments. The description is intentionally advisory: it adds no constraint that could reject existing payment data or alter a pending, rejected, verified, receipt, or reconciliation path. No application source edit was needed because the existing type and UI names already distinguish the fields.

An isolated database `rrj_payment_arch02_disposable` was created in the existing local integration Postgres container. A schema-only copy of local `auth`, `public`, and `storage` was restored, then the new migration applied successfully. The clone showed both exact comments. A synthetic local data restore populated 4 user/profile rows, 1 order, and 1 verified payment before an unrelated menu-inventory circular FK stopped the broader restore; it was **not** a complete fixture or a hosted-data copy. A rollback-only check against this clone confirmed:

- Active Cashier can call the payment queue; owning Customer can call the order-payment read.
- Customer cannot invoke rejection; Manager cannot invoke the Cashier payment queue.
- Payment count and verified amount stayed **1 and 170.00** before and after the read/authorization checks.
- The check transaction rolled back its temporary grants and settings.

The check did **not** execute a new pending-to-rejected-to-resubmitted-to-verified financial journey, receipt issuance, shift closure, or reconciliation. Those remain unproven by this milestone; their functions and schema were not modified. The clone was created from the current local schema, not a clean chronological migration replay (the separate Phase 2A replay blocker remains). The disposable check is reproducible from `qa/CAPSTONE-DB-ARCH-02-DISPOSABLE-CHECK.sql` when a suitable local synthetic fixture is present.

The disposable database and its temporary schema, data, migration, and check copies were removed; a catalog check returned zero databases with its name. The canonical worktree's extensive preexisting changes were left intact. A whole-worktree `git diff --check` reported two trailing-whitespace lines in unrelated preexisting changes (`supabase/config.toml` and `supabase/tests/verify_receiving_batch_foundation.sql`); neither was edited here.

**Simplification scorecard:** 0 columns removed; 2 semantic column comments added; 0 client/RPC/trigger/policy changes; 0 hosted changes. Both candidate fields remain because each carries distinct live business meaning and data. Any future contraction requires a separate, reviewed compatibility and historical-data plan; no direct drop or placeholder merge is proposed here.
