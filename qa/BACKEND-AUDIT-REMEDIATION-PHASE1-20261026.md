# Backend audit remediation — Phase 1 (26 October 2026)

## Scope and decision

Canonical working tree: `C:\Users\Janmari\Downloads\Capstone Project`. Hosted project: `zhzluhqvysvsadwuugpa`. The tree had hundreds of unrelated existing changes, including untracked Manager Requests/Receiving files and migrations. This phase changed no hosted schema, data, grants, RLS, migration history, or Storage. Hosted operations were read-only catalog and row queries.

**Clean bootstrap: FAIL.** A newly copied, unlinked disposable stack at `%TEMP%\rrj-audit-replay-20261026` applied the first 12 unchanged migrations, then failed at `20260904000000_inventory_phase_2a_recipe_deduction.sql`, statement 0, SQLSTATE 23503, `menu_ingredients_inventory_item_id_fkey`. The copied Phase 2A file has the same SHA-256 as the canonical file: `f06983ed7e9ba60f48654f8df97f177ff8802a0c74297300b851b0226180a5d0`. The CLI stopped the disposable containers. Later migrations and regression SQL therefore did not run on a clean database. No synthetic historical rows or fake migration-history entries were inserted.

## Local implementation

1. `supabase/config.toml`: disabled post-migration seeding and removed its path to nonexistent `seed.sql`. This fixes the configuration error only. [Supabase documents](https://supabase.com/docs/guides/local-development/seeding-your-database) that seeds load *after* migrations, so they cannot supply Phase 2A's historical prerequisites.
2. `scripts/recovery/validate-provenance.mjs`: removed its stale exact count of 52 migrations; it now verifies that Phase 2A and its 12 predecessors are in place, then reports the evidence gate against the current 64-file chain. Its result is still `BLOCKED` without an approved private manifest.
3. `qa/backend-audit-hosted-migrations-20261026.json`: captured the 63 hosted versions/names from the read-only Supabase migration listing.
4. `scripts/recovery/reconcile-migration-ledger.mjs`: repeatable read-only comparison of that snapshot with local filenames. It checks duplicate versions and reports exact matches, one-sided versions, and same-name candidates. A matching name or version does **not** establish matching SQL.
5. `scripts/recovery/prepare-enum-compat-variant.mjs`: creates a review-only copy of the historical numeric-input migration with exactly two `public.cashier_shift_status` qualifications. It refuses to write inside canonical migrations or overwrite an output. The generated disposable copy has SHA-256 `7f8c3b83ff3382d0324661c0f6a578c74535c980132058ce16db61eba3e48cd3`; the untouched source has SHA-256 `2032b4799a197e95292179f264af47726b758f82453a08aeb2f0464d2b4200fc`.

No historical migration body was edited. The two unqualified `cashier_shift_status` return fields remain in `20260914000000_harden_numeric_inputs.sql`. A later migration cannot fix that signature if replay fails while applying the historical file. The generated variant is diagnostic only; its behavior was not reached by the clean replay. Its disposition in canonical history and any hosted operation require separate control.

## Migration ledger reconciliation

| Evidence | Count |
|---|---:|
| Hosted versions | 63 |
| Local SQL versions | 64 |
| Same-version entries | 48 |
| Hosted-only versions | 15 |
| Local-only versions | 16 |
| Same-name cross-version candidates | 10 |

The exact version lists are produced by `node scripts/recovery/reconcile-migration-ledger.mjs`. Known candidates include hosted ledger-audit `20261019103144` versus local `20261019095803`, and hosted Receiving inspector `20261023182339` versus local `20261023113221`. Five hosted-only entries concern Rider migrations with no same-name local counterpart in this repository. Six local-only entries have no same-name hosted counterpart, including the duplicate-trigger cleanup. Compare SQL hashes, deployed object definitions, and dependency order for every candidate before deciding whether to add a compatibility migration, retrieve missing source, or record an intentional difference. Do not rename hosted versions or mark migrations applied to make counts agree.

## Hosted exceptions investigated

| Finding | Read-only evidence | Disposition |
|---|---|---|
| Duplicate timestamp triggers | `profiles` and `riders` each have two active BEFORE UPDATE row triggers calling `set_updated_at()`. | The local `20261013071937_remove_duplicate_timestamp_triggers.sql` targets the extra trigger on each table and checks definitions first. Its hosted deployment still needs backup, rehearsal, ledger reconciliation, and separate approval. |
| Historical delivered orders | `ORD-000003` (PHP 85) and `ORD-000007` (PHP 170), both dated 17 August 2026 UTC, are delivered with zero linked `payments` and zero `cashier_transactions`. | Locate original cashier/settlement evidence. Keep them as exceptions; do not generate synthetic payment rows or classify them as verified paid sales. |
| Inventory provenance | Latest `inventory_audit_items` has five `result=incomplete`, `finding_code=no_history` rows: Biryani Chicken - Breast, Fried Chicken - Quarter Leg, Marinated Chicken - Paa, Marinated Chicken - Pecho, Softdrinks. Each has book quantity zero, null ledger quantity, and zero movements. | Preserve `no_history` as incomplete. Obtain dated opening/source evidence before any adjustment or claim of complete ledger history. |

## Architecture mapped to actual hosted tables

- **Identity/authorization:** `auth.users` → `public.profiles`; `public.riders` extends rider identity. Browser and Rider clients use narrow authenticated RPCs. Review all callable `SECURITY DEFINER` functions and their grants before reducing access.
- **Sales/finance:** `menu_categories`, `menu_items`, `menu_ingredients`, `drink_choices` feed `orders` and `order_items`. `order_status_history` records transitions; `payments`, `cashier_transactions`, and `cashier_shifts` carry settlement/cashier evidence; `paid_order_cancellations` records reversals. Order delivery uses `delivery_assignments`.
- **Inventory:** `inventory_items` holds current quantity, `inventory_transactions` the movement ledger, `inventory_batches` and `inventory_transaction_batch_allocations` physical/FIFO detail, and `inventory_opening_balances` approved baseline evidence. `inventory_audits` and `inventory_audit_items` reconcile these representations; `no_history` is not a match.
- **Procurement and Receiving:** `suppliers`, `supplier_items`, `purchase_orders`, `purchase_order_items` are procurement sources. `inventory_request_documents`, `inventory_request_lines`, `inventory_request_revisions`, and `inventory_request_events` are the formal Manager request workflow. `production_replenishment_requests` and `production_replenishment_status_events` are a separate older path. `receiving_reports` and `receiving_report_items` link to supported source types and should post accepted stock exactly once through audited transaction paths.
- **Delivery/push:** `rider_push_devices` and `rider_offer_push_outbox` support notification delivery; they are downstream of order/assignment state, not a substitute for it.

This mapping uses the hosted catalog and existing migration/app code. No conceptual ERD fields were promoted to schema changes.

## Verification

| Gate | Result |
|---|---|
| Local ledger comparison | **PASS:** 63/64/48 and candidate list, no database write. |
| Historical prerequisite gate | **EXPECTED BLOCK:** 18 recipe links require 10 menu and 12 inventory identities absent from the 12 predecessor migrations; two enum fields remain unqualified. |
| Provenance validator | **EXPECTED BLOCK:** runs against 64 migrations and requests approved private manifest; no longer crashes on stale file count. |
| Unchanged disposable replay | **FAIL:** SQLSTATE 23503 at Phase 2A as above; no full replay or downstream regression claim. |
| Hosted exception queries | **PASS:** duplicate triggers, two sales exceptions, and five inventory `no_history` rows confirmed. |
| Copy integrity | **PASS:** all 64 copied SQL files matched canonical SHA-256 hashes. |
| App typecheck | **PASS:** `npm run typecheck` on the existing dirty tree. |
| Script syntax | **PASS:** `node --check` for all three recovery scripts. |
| Enum review variant | **PASS:** generated in disposable directory; exactly two qualifications and source/variant hashes recorded. **NOT APPLIED** to a database. |
| Full local SQL regression suite | **NOT RUN:** clean replay stopped before the required schema was available. Existing separate-stack tests in older reports are historical evidence only. |

## Next controlled phase

1. Acquire a privately held, owner-approved historical master-data baseline with exact Phase 2A IDs, units, recipe tuple digest, source, date, and opening-stock decision. Keep business data outside this repository. Validate it with `scripts/recovery/validate-provenance.mjs`; its `REVIEW_REQUIRED` result still requires human review.
2. Prepare a versioned pre-Phase-2A bootstrap for *new* environments and a separately documented enum compatibility variant. Record SQL hashes and the intended migration ledger. Replay all 64 canonical files plus explicitly approved prerequisites in a new unlinked stack; test role/RLS/RPC and inventory/finance regressions.
3. Reconcile all 31 one-sided ledger versions by deployed object content and source provenance. Check independent database and private Storage-byte backup and an isolated restore before any hosted proposal.
4. Only then request approval for each named hosted change, starting with a rehearsed duplicate-trigger correction. Reconcile the two orders and five inventory items from original business evidence; preserve an auditable exception record if evidence cannot be found.
