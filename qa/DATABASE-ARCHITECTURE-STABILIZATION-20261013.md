# Existing RRJ’S FOOD-HOUSE database architecture stabilization

Date: 2026-10-13 (Asia/Manila). Hosted target: `RRJS-Foodhouse-Final` (`zhzluhqvysvsadwuugpa`). Goal: improve the **existing** architecture incrementally. **No rebuild.** Hosted project remained SELECT-only. The canonical checkout was already dirty and was not reset, cleaned, stashed, or deployed. The synced ChatGPT project mirror was not changed.

## Result by requested step

| Step | Result | Evidence boundary |
| --- | --- | --- |
| 1. Hosted catalog and dependency map | **COMPLETE for catalog/source inspection** | Fresh SELECT-only catalog below and companion object inventories. Active paths are established by current source and local authenticated tests, not hosted traffic telemetry. |
| 2. Classification and priorities | **COMPLETE** | Every public table classified below; zero proven deletable tables or rows. |
| 3. Minimal local cleanup | **COMPLETE** | One new guarded migration removes only two duplicate timestamp triggers. No table, index, row, ACL, RLS, function, ledger, or audit change. |
| 4. Isolated migration and regression | **PASS for tests listed below; other paths NOT TESTED** | Migration executed on preserved, unlinked restored local Supabase stack. No empty migration-chain replay. No hosted write. |

## 1. Live hosted catalog and dependency map

Fresh hosted SELECT-only catalog: **34** public tables, all RLS-enabled; **73** public FKs; **122** public indexes; **37** enabled user triggers; **19** public RLS policies; **100** public SQL functions, of which **83** are SECURITY DEFINER; effective EXECUTE for **14** functions to `anon` and **81** to `authenticated`. The existing legacy `create_replenishment_request` remains executable by `authenticated` on hosted. `authenticated` retains MAINTAIN on `cashier_shifts`, `cashier_transactions`, and `riders`; `anon` does not. These effective privilege counts do not by themselves prove each RPC is safe or unsafe.

The complete, privacy-safe per-object records are:

- `DATABASE-REDUNDANCY-EVIDENCE-20261013.json`: all 34 public tables, 73 FKs with delete actions, 122 indexes, 37 triggers, sizes/counts, and SQL function source references by table.
- `DATABASE-REDUNDANCY-SCHEMA-SUPPLEMENT-20261013.json`: all public columns, 19 policy definitions, managed schema inventory, source provenance, and applied migration versions.
- `DATABASE-ARCHITECTURE-LIVE-GRANTS-20261013.json`: fresh effective `anon`/`authenticated` privileges for **every public table and function**, with SECURITY DEFINER flags. It contains names and booleans, not user data.

Dependency flow from current routes/RPCs:

| Active path | Reads / authoritative write boundary | Auth and Storage dependency |
| --- | --- | --- |
| Customer | Menu categories/items, modifier associations, availability/ingredients; `place_customer_order`, payment submission; orders/items/payments/history. Confirmed-order history drives stock deduction. | Auth user ↔ profile; private `payment-proofs` bucket for GCash proof. |
| Cashier | Orders/payments and shifts/journal; sale, payment verification, release and shift RPCs own writes. `cashier_transactions` is a journal, not a duplicate payment row. | Cashier role from profile; payment proof read policy. |
| KDS | Terminal credential and order queue; terminal/advance RPCs change operational order status. | `kds_terminals` credential; no direct Storage write in this path. |
| Manager inventory | Inventory master/batches/ledger and formal request document, lines, revisions/events; issue/revise/close and linked Receiving RPCs. **Only `post_receiving_report(uuid)` moves accepted received stock into batch and ledger.** | Manager profile role; RPC authority and zero-policy tables. |
| Production legacy | Existing Phase 7B request/status events and linked Receiving remain readable/operable locally; the pending `20261013053159` policy blocks new legacy creation and constrains new unlinked Production intake. | Production/Manager profile roles; hosted still runs old policy. |
| Direct supplier / PO | Supplier master, PO/lines, direct supplier Receiving and posting remain compatible despite empty hosted supplier/PO tables. | Manager RPC authority; supplier catalog bridge is dormant. |
| Rider web and standalone | Profile/rider/assignment/order/item reads; offer/availability/transit/completion RPCs; delivery assignment is the authority for delivery state. | Rider Auth/profile approval; `rider-documents` and `delivery-proofs` private buckets. |
| Cancellation | Paid cancellation RPC and attestation table preserve refund/stock disposition; not duplicate order/payment rows. | Manager/Cashier authorization, original order/payment references. |

Current source anchors: `src/app/routes.tsx`; Customer `src/modules/customer/index.tsx`; Cashier `src/modules/cashier/api/`; KDS `src/modules/kitchen/services/kdsTerminalService.ts`; Manager `src/modules/manager/inventory/{inventoryRequestApi,receivingApi,replenishmentApi,inventoryApi}.ts`; Rider web `src/modules/rider/services/supabaseRiderService.ts`; standalone Rider `C:\Users\Janmari\Downloads\RRJ-Food-House-Rider\src\riderApi.ts`. Exact FK, trigger, index, policy and grant inventories above are the detailed dependency matrix; source references are not usage telemetry, and dynamic SQL/external consumers can escape source searches.

## 2. Every public table classified

`Core` means current business authority; `support` means required relationship/audit/security or conditional workflow; `compat` means retained historical/legacy path; `candidate` needs additional evidence. **Proven redundant table or business row: none.**

| Table | Class | Role and dependency |
| --- | --- | --- |
| `profiles` | Core | Auth-linked role and actor authority; many FKs and role checks. |
| `riders` | Core | Rider application/approval/availability; assignment FK. |
| `menu_categories` | Core | Customer/Cashier menu grouping. |
| `menu_items` | Core | Sellable menu; order line and recipe references. |
| `inventory_items` | Core | Stock master and aggregate quantity; ledger/batches/recipes. |
| `menu_ingredients` | Support | Recipe bridge for availability and confirmed-order issue; no formula contents exported here. |
| `suppliers` | Compat | Empty hosted but direct-supplier/PO/Receiving path remains. |
| `supplier_items` | Candidate | Empty dormant supplier catalog bridge; FKs and possible external/planned consumers prevent drop. |
| `purchase_orders` | Compat | Empty hosted; direct supplier ordering/Receiving contract. |
| `purchase_order_items` | Compat | PO lines and Receiving/ledger references. |
| `orders` | Core | Customer/Cashier/KDS/Rider order authority. |
| `order_items` | Core | Sold-at-time line snapshot, distinct from current menu. |
| `payments` | Core | Payment state/proof reference, distinct from cashier receipt journal. |
| `order_status_history` | Support | Workflow/audit timeline and confirmed-order deduction trigger. |
| `inventory_transactions` | Core | Stock movement ledger and lineage. |
| `delivery_assignments` | Core | Rider offer, transit and proof metadata. |
| `kds_terminals` | Support | KDS credential and control. |
| `cashier_shifts` | Core | Shift authority and reconciliation. |
| `cashier_transactions` | Core | Receipt/settlement journal. |
| `menu_modifier_groups` | Support | Server-validated modifier definitions. |
| `menu_modifier_options` | Support | Server-validated option definitions. |
| `menu_item_modifier_groups` | Support | Menu/modifier association. |
| `receiving_reports` | Core | Physical receipt header and posting boundary. |
| `receiving_report_items` | Core | Delivered/accepted/rejected lines and provenance. |
| `inventory_batches` | Core | Lot quantity/expiry authority. |
| `inventory_opening_balances` | Support | One-time cutover provenance; empty does not mean disposable. |
| `inventory_transaction_batch_allocations` | Support | Exact batch issue/refund allocation; empty until used. |
| `paid_order_cancellations` | Support | Refund/disposition attestation. |
| `production_replenishment_requests` | Compat | Historical Phase 7B Production request path. |
| `production_replenishment_status_events` | Compat | Its transition audit trail. |
| `inventory_request_documents` | Core | Current formal Manager request authority. |
| `inventory_request_lines` | Support | Requested item/amount grain. |
| `inventory_request_revisions` | Support | Immutable issued revision snapshot, not duplication. |
| `inventory_request_events` | Support | Request dispatch/ack/activity history, not duplication. |

Managed `auth`, `storage`, `realtime`, and migration tables are service-owned and outside cleanup. The repeated order-status groups and denormalized order totals/stock quantities are history or deliberate snapshots/caches; no business row was proved deletable. Zero index scans are insufficient to justify dropping any index.

Priorities: **P1** keep the pending narrow MAINTAIN repair separate; **P1** preserve the pending Production creation policy while hosted remains on old behavior; **P2** this locally tested duplicate-trigger cleanup; **P2** gather owner/traffic evidence before deciding on `supplier_items` or PO/legacy retirement. No additional defect met the reversible, scope-limited change threshold.

## 3. Exact local change and rollback

New `supabase/migrations/20261013071937_remove_duplicate_timestamp_triggers.sql` follows pending `20261013000302` (MAINTAIN repair) and `20261013053159` (Production policy). It checks both pairs are enabled, row-level BEFORE UPDATE triggers with no predicate/column restriction/arguments, share `public.set_updated_at()`, and retain the original named trigger. Hosted and restored local definitions matched. That function only assigns `NEW.updated_at = now()` and returns NEW; a second call in the same transaction yields the same timestamp, so the extra call is redundant. It atomically executes:

```sql
DROP TRIGGER "trg_profiles_set_updated_at" ON public.profiles;
DROP TRIGGER "trg_riders_set_updated_at" ON public.riders;
```

Rollback recipe, **for a separately reviewed local reversal only** (inspect first; do not run blindly):

```sql
BEGIN;
CREATE TRIGGER "trg_profiles_set_updated_at"
  BEFORE UPDATE ON public.profiles FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER "trg_riders_set_updated_at"
  BEFORE UPDATE ON public.riders FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
COMMIT;
```

Exact files added in this task: the migration above, `supabase/tests/verify_single_timestamp_triggers.sql`, `qa/DATABASE-ARCHITECTURE-LIVE-GRANTS-20261013.json`, and this report. No existing file was changed by this task. The isolated database has the migration's two trigger drops applied directly; its unrelated prior synthetic rows and volumes remain. Its migration-history table was not created or modified.

## 4. Executed isolated regression

The preserved `isolated-stack` was started by exact Docker container names, with DB `127.0.0.1:56322` and API `127.0.0.1:56321`; it has no hosted link. Before this task's migration: 34 public tables, 2 profile triggers, 2 rider triggers, 60 profiles, 10 riders, 53 orders, and 61 stock transactions. The DB already contained earlier synthetic QA rows and the pending local MAINTAIN/Production policy behavior; it was not a pristine hosted snapshot. Migration output: `BEGIN; DO; DROP TRIGGER; DROP TRIGGER; COMMIT`. Immediately after: 1 trigger on each table. The rollback-only timestamp test recreated the exact old pair in a savepoint, checked a profile and rider update, rolled back the savepoint, then checked the one-trigger updates. Both configurations replaced a deliberately old timestamp with transaction time; no test row change survived.

| Check | Result | Evidence |
| --- | --- | --- |
| Trigger equivalence/atomic migration and profile/rider `updated_at` | **PASS local** | Catalog/function inspection, migration guard, `verify_single_timestamp_triggers.sql`. |
| Role/RLS denials and formal Manager request security | **PASS local** | `verify_manager_inventory_request_security.sql`, `verify_manager_inventory_request_documents.sql`; signed-in Cashier/legacy/ordinary-unlinked denials in Production policy API test. |
| Manager issue → two partial Receiving reports → accepted-only batch/ledger/stock; overage, serial/concurrent duplicate post, shortfall | **PASS local** | Signed-in `qa/recovery-auth-inventory-e2e-20261013.ps1`; synthetic rows remain in local volume. |
| Emergency/source compatibility and supplier/legacy paths | **PASS local SQL/API** | `verify_production_delivery_policy.sql`, `verify_phase_7b_replenishment_requests.sql`, signed-in `qa/production-delivery-auth-e2e-20261013.ps1`. Existing Phase 7B reads and direct-supplier PO posting remain; authenticated legacy **new creation denied locally** by the pending policy. |
| Customer → order/payment → Cashier → KDS → Rider; proof/role denial/idempotent replay | **PASS local same-database API/Storage** | `qa/recovery-auth-order-rider-e2e-20261013.mjs`: signed-in four roles, payment/proof upload, receipt, KDS, rider completion and final joins. |
| Paid cancellation | **PASS local rollback-only SQL** | `verify_phase_7a_paid_order_cancellation.sql`; authenticated UI/API cancellation was **NOT TESTED** in this run. |
| Main app typecheck/build | **PASS** | `npm.cmd run typecheck`; `npm.cmd run build`. |
| Standalone Rider typecheck/unit | **PASS** | `npm.cmd run typecheck`; `npm.cmd test` 8/8. |
| Browser/device/OAuth and hosted behavior after cleanup | **NOT TESTED** | No fresh browser/device journey, hosted migration, hosted Auth or Storage mutation. |

At end of the API tests: 1 profile trigger, 1 rider trigger, 67 local profiles, 11 local riders, 54 orders, 66 stock transactions. The later count increases are labeled synthetic local tests; they are not a hosted baseline change. Local `authenticated` MAINTAIN is false on the checked tables and local legacy creation is denied because those pending migrations were already exercised there; **hosted still has the opposite state**.

## Separate hosted proposal, not executed

Propose reviewing the exact migration and rollback above against a fresh hosted SELECT-only catalog, after migration provenance and protected recovery/restore gates are met. Apply the existing pending MAINTAIN and Production migrations in their established order only through separate named approval; this report grants no hosted approval. Confirm encrypted database **and private Storage bytes** recovery with a user-held path and isolated restore, then use an approved staging copy for the authenticated regression before any hosted statement. Keep the hosted project read-only until that decision. No table/index/row removal, recipe-baseline decision, empty-chain replay, deployment, UI redesign, or APK QA is part of this architecture cleanup.
