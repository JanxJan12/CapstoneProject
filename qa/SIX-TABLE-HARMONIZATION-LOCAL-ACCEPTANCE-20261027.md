# Six-table harmonization — local acceptance, 27 October 2026 (Asia/Manila)

## Decision

**LOCAL CANDIDATE PASS for the bounded Manager/Receiving SQL path; deployment NO-GO.** No hosted application schema, business data, Auth user, Storage object, or migration-ledger write was performed, and the six hosted tables remain present. **Hosted read-only boundary exception:** the linked Supabase CLI dump printed “Initialising cli_login_postgres role.” A subsequent read-only catalog query found that role with a short expiry (`2026-10-26 23:24:07 UTC`). The passwordless CLI path can create or refresh this temporary database login role; this interaction therefore cannot be represented as strictly read-only. No further linked CLI command or compensating hosted role write was attempted. The local candidate removed six tables from an isolated schema clone (**36 → 30**) without `CASCADE`; all 21 target-referencing function bodies were replaced or retired, and all four surviving foreign keys were handled explicitly.

The clone contains the **current hosted public schema**, but its nonpublic Auth/Storage scaffolding came from an existing local targeted stack and it contains only synthetic business rows. This is not a faithful current hosted data/Auth/Storage restore. The KDS fixture lacked its expected orders, and full Customer/Cashier/KDS/Rider authenticated lifecycle acceptance is not established. Do not deploy this candidate on the strength of the local result.

## Inputs and boundary

- Read `qa/SIX-TABLE-RETIREMENT-EXECUTION-20261027.md`, `qa/SIX-TABLE-RETIREMENT-PREFLIGHT-20261027.sql`, the Track A legacy/formal Request reports, and Track B QA. The earlier read-only hosted snapshot reported zero rows in all six targets and zero values in all four downstream links. These values can drift; the migration independently checks them under locks.
- Queried the hosted catalog read-only for all non-system function bodies, views/materialized views, triggers, FKs, signatures, and function-definition digests. The 21 body references were all in `public`; no view or materialized view body referenced a target.
- `supabase db dump --linked --schema public` copied the current hosted schema into a temporary local file (625,346 bytes). It did not dump business data. The CLI initialized a temporary hosted login role as described above; see the [Supabase CLI passwordless role discussion](https://github.com/supabase/cli/issues/6236) for the mechanism.
- Created a separate local PostgreSQL database `rrj_six_acceptance_20261027` in the already-running local Supabase Docker stack. Restored nonpublic schema scaffolding from that local stack, then the hosted `public` schema. The first ordering attempt failed on the Auth user key; after restoring nonpublic pre-data and constraints first, the hosted `public` restore passed. Nine nonpublic post-data statements tied to a missing public function or older public table policies did not apply before the hosted schema restore. The Auth user creation trigger was among these; the relevant synthetic SQL checks used explicit Auth/profile inserts. No live Supabase API endpoint was pointed at this clone.
- Pre-migration clone catalog: 36 `public` base tables and the same 21 target-referencing function bodies as hosted. The migration's definition-digest guard matched the read-only hosted snapshot.

## Exhaustive target dependency inventory and closure

The six targets are `production_replenishment_requests`, `production_replenishment_status_events`, `suppliers`, `supplier_items`, `purchase_orders`, and `purchase_order_items`. Target-owned indexes, constraints, policies, and triggers leave with their target table. Seven target-owned triggers observed were `production_request_audit_insert`, `production_request_guard_update`, `purchase_order_items_enforce_quantity_scale`, and the four `trg_*_set_updated_at` triggers on supplier/PO tables. The generic `set_updated_at` function stays.

### 21 SQL function bodies

| Hosted signature | Local closure |
| --- | --- |
| `advance_replenishment_request(uuid,text,text)` | Drop obsolete Production transition RPC. |
| `close_replenishment_from_receiving()` | Drop after removing `receiving_closes_replenishment` trigger. |
| `create_receiving_report_draft(uuid,text,text,uuid,timestamptz,text,text)` | Replace; allow Production Team only, reject PO/supplier linkage. |
| `create_replenishment_request(uuid,uuid,numeric,timestamptz,text,text)` | Drop obsolete single-item creation RPC. |
| `enforce_inventory_item_quantity_policy()` | Replace PO joins/checks with direct Receiving item validation; retain batch, ledger, recipe checks. |
| `enforce_inventory_related_quantity_scale()` | Replace; retain surviving batch, transaction, Receiving, recipe, opening-balance checks. |
| `enforce_receiving_item_shelf_life()` | Replace; derive from direct inventory item and received time, retain expiry/manufacture guards. |
| `get_inventory_request_proposal(timestamptz)` | Replace; formal open residual remains, legacy outstanding term removed. |
| `get_manager_inventory_movements(uuid,text,date,date,timestamptz,uuid,integer)` | Replace PO joins/label; retain Receiving/order/opening/batch labels and filters. |
| `get_manager_receiving_documents(text,text,text,date,date,integer,integer)` | Replace PO/supplier joins with null compatibility fields; retain document filters/totals. |
| `get_manager_receiving_workspace(uuid)` | Replace PO/supplier joins and item fallback; retain selected/listed Receiving and inventory items; return `purchase_orders: []` for the existing client shape. |
| `get_replenishment_requests()` | Drop obsolete single-item history RPC. |
| `guard_linked_replenishment_line()` | Drop after removing `receiving_linked_line_guard` trigger. |
| `guard_linked_replenishment_report()` | Drop after removing `receiving_link_guard` trigger. |
| `guard_open_replenishment_item_unit()` | Drop after removing `inventory_open_replenishment_unit_guard` trigger. |
| `guard_production_replenishment_request()` | Drop after the target-owned request triggers leave with their table. |
| `post_receiving_report(uuid)` | Replace PO locking, validation and updates with Production Team item flow; retain Manager authorization, report/line/item locks, accepted-only batch/aggregate/ledger writes, and duplicate rejection. |
| `refresh_receiving_item_shelf_life()` | Replace PO fallback with direct inventory item lookup. |
| `save_receiving_report_item(uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,text,text,date,date,text)` | Replace PO item branch; retain direct item, quantity, secondary quantity, rejection, and idempotent upsert guards. |
| `start_replenishment_receiving(uuid)` | Drop obsolete single-item Receiving RPC. |
| `update_receiving_report_draft(uuid,text,text,uuid,timestamptz,text,text)` | Replace; allow Production Team only, reject PO/supplier linkage. |

The 12 replacements keep their existing signatures, security mode, search path, owner and EXECUTE grants through `CREATE OR REPLACE FUNCTION`. The nine legacy-only functions are dropped explicitly. The migration checks all 21 original function digests and rejects drift before changing anything.

### Surviving FKs, triggers, views, and constraints

| Dependency | Closure |
| --- | --- |
| `inventory_transactions_purchase_order_item_id_fkey` | Drop explicitly; retain nullable column with a new null-only check. |
| `receiving_report_items_purchase_order_item_id_fkey` | Drop explicitly; retain nullable column with a new null-only check. |
| `receiving_reports_purchase_order_id_fkey` | Drop explicitly; retain nullable column with a new null-only check. |
| `receiving_reports_replenishment_request_id_fkey` | Drop explicitly; retain nullable column with a new null-only check. |
| `receiving_closes_replenishment`, `receiving_link_guard`, `receiving_linked_line_guard`, `inventory_open_replenishment_unit_guard` | Drop explicitly with their legacy-only functions. |
| `inventory_batches_enforce_quantity_scale`, `inventory_items_enforce_quantity_policy`, `inventory_opening_balances_enforce_quantity_scale`, `inventory_transactions_enforce_quantity_scale`, `menu_ingredients_enforce_quantity_scale`, `receiving_report_items_enforce_quantity_scale`, `receiving_report_items_enforce_shelf_life`, `receiving_reports_refresh_shelf_life` | Retain; their shared function bodies are replaced above and exercised by the formal fixture where applicable. |
| Existing Receiving source/check constraints | Retain; add `receiving_reports_retired_links_null_chk` to force Production Team with null legacy/PO links. Existing formal request FK, revision, reconciliation trigger, emergency evidence, and source rules stay. |
| Views/materialized views | None across the hosted catalog had a target name in its definition. |

The local migration completed with six explicit `DROP TABLE public.<target>` statements and no `CASCADE`. The database rejected an initial attempt to drop the request audit function before its target-owned triggers; moving that function drop after the target table resolved it. An initial postcondition also matched the JSON compatibility key `purchase_orders`; it was narrowed to actual `public.<relation>` body references. Both failed attempts rolled back in the disposable transaction. Final local result: 30 public base tables, zero surviving function bodies that reference a dropped `public` relation, and no unresolved FK dependency.

### Active application callers

| Caller | Closure/status |
| --- | --- |
| Manager Requests `ManagerRequestsPage` | Removed the mounted Legacy Requests section and `ReplenishmentPage` import; formal multi-item editor/register remains. |
| Manager route `src/modules/manager/index.tsx` | Removed legacy Receiving handoff state/callback/prop; formal linked Receiving navigation remains. |
| Manager Receiving `StockReceivingPage` | Removed the mounted legacy RPC lookup and the Direct Supplier selection option. Production Team and formal linked Receiving remain selectable. |
| `receivingApi.ts` | Existing result parser and request type still carry PO fields/branches for shape compatibility. The mounted UI no longer selects the branch; SQL rejects it. |
| `ReplenishmentPage.tsx` / `replenishmentApi.ts` | These pre-existing untracked files remain on disk, but no mounted route imports the component or calls its RPC wrappers. They are not included in the active app path. |
| Suppliers/Purchase Orders prototype UI | Prototype navigation/data, with no live supplier/PO table caller found in `src`. |
| Customer, Cashier, KDS, Rider | No target-table caller found in current `src`; no code changed in these modules for this task. Their full runtime regressions remain a deployment gate. |

## Exact local edits

- `supabase/migrations/20261026232229_six_table_dependency_harmonization.sql`: forward-only guarded candidate, 12 function replacements, nine function retirements, four surviving trigger removals, four named FK removals, null/source checks, six explicit drops, and 30-table/function-reference postcondition. SHA-256: `256D39C2A558FD90B780B6E9D91692BC9282F3C60372CEDBEC7D341B22C8476B`.
- `supabase/tests/verify_six_table_harmonization_local.sql`: rollback-only synthetic catalog, authenticated database-role, Manager formal issue → Messenger event → linked Receiving → accepted-only post, workspace, duplicate, and Cashier denial checks.
- `src/modules/manager/inventory/ManagerRequestsPage.tsx`, `src/modules/manager/index.tsx`, `src/modules/manager/inventory/StockReceivingPage.tsx`: remove mounted legacy controls/calls, retain formal flow.
- This report. No historical migration was edited. Extensive unrelated existing dirty work remains untouched.

## Acceptance ledger

| Check | Result | Evidence and limit |
| --- | --- | --- |
| Hosted application schema/business data/ledger writes | **NOT RUN** | No deployment or application mutation. The linked dump likely created/refreshed `cli_login_postgres`, so strict hosted read-only compliance **FAILS**. |
| Current deployed `public` schema capture | **PASS** | Read-only linked schema dump, 36 tables/21 body references restored locally. No hosted business/Auth/Storage data was copied. |
| Migration apply | **PASS local** | Guarded transaction applied to isolated clone, 36 → 30, all six absent; zero dropped-relation function references; no `CASCADE`. |
| Formal multi-item issue/revise, Messenger event, partial Receiving, accepted-only batch/ledger, overage/duplicate rejection and shortfall closure | **PASS local SQL** | `verify_manager_inventory_request_documents.sql` passed on the 30-table clone and rolled back. This test sets synthetic JWT claims inside a privileged SQL session. |
| Authenticated database role Manager/Cashier checks | **PASS local SQL** | New verifier uses `SET LOCAL ROLE authenticated` with synthetic JWT subject: Manager issue/dispatch/linked draft/selected workspace/post/duplicate check passed; Cashier proposal and post were denied; direct supplier draft rejected. Not a GoTrue/HTTP session test. |
| Cashier paid-order cancellation regression | **PASS local SQL** | `verify_phase_7a_paid_order_cancellation.sql` passed and rolled back. |
| KDS historical fixture | **FAIL fixture precondition** | `verify_kds_queue_v2_local.sql` expected seeded online/walk-in modifier orders absent from this schema-only clone. It did not establish a KDS regression result. |
| Customer checkout, live KDS, Rider assignment/proof, full financial reconciliation under authenticated API sessions | **NOT RUN** | Current hosted data and matching nonpublic Auth/Storage schema/config were not restored; no API runtime was attached to the clone. |
| Typecheck/build | **PASS** | `npm.cmd run typecheck` and `npm.cmd run build` exited 0 after source edits. |
| Existing offline request/posting source assertions | **PASS baseline only** | H-23: 40 checks; historical Receiving source verifier: 42/42. The latter checks the pre-retirement migration, not this new SQL. |
| Independent current-hosted restore and final deployment readiness | **NOT RUN / NO-GO** | No faithful restorable current hosted database/Auth/Storage clone or full role journey was established. |

**Deployment decision: NO-GO.** This is a reviewable local candidate, not production acceptance. One concrete next action: build a faithful isolated restore of the current hosted database plus matching Auth/Storage schema and synthetic authenticated sessions, then rerun this candidate and the missing Customer/KDS/Rider/finance regressions against that clone before any hosted write.
