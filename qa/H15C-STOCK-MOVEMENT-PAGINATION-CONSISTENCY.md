# H-15C Stock Movement pagination consistency — 2026-10-16 Manila

## Source finding and contract

The mounted Manager `inv-transactions` route renders `InvTransactionsPage.tsx`. `getManagerStockMovements` in `inventoryApi.ts` calls `get_manager_inventory_movements` with item, type, Manila date range, `(created_at,id)` cursor, and bounded page limit. `supabase/migrations/20261005082921_manager_inventory_workspace_reads.sql` defines that Manager-checked read over `inventory_transactions`, inventory items, receiving report/batch links, allocation rows, orders, and actor profiles. Movement `id` is the stable ledger identity; this page does not write inventory.

Before H-15C, `loadMore` checked React `isLoadingMore`, then set it. Two clicks before React committed the disabled state could request the same cursor twice and append both responses. The existing request version rejected results after a later first-page read, but filter changes did not invalidate an in-flight pagination call synchronously. This is a frontend concurrency defect, not proof of duplicate ledger records.

## Correction

- `src/modules/manager/inventory/InvTransactionsPage.tsx:42–49` adds synchronous first-page/pagination gates and refs for the most recently accepted rows and cursor.
- `InvTransactionsPage.tsx:73–151` invalidates older calls on refresh or filter change. `Load more` claims its gate before awaiting the RPC; only the current version can append, and a superseded completion cannot release a newer claim. A failed page leaves rows and cursor unchanged and allows retry.
- `InvTransactionsPage.tsx:88–92,125–132` validates page IDs before replacing or appending and advances the cursor only after a valid append. A click before React renders the new cursor uses the updated cursor ref.
- `InvTransactionsPage.tsx:188–244` preserves selected item, movement type, dates, and local search while invalidating pending work for actual filter changes.
- New `src/modules/manager/inventory/movementPage.ts` rejects an ID repeated in the existing rows **or within one server page**. It raises a visible read error and does not advance the cursor. It never silently drops a distinct ledger ID. The synchronous claim/release helpers are also in this file.

The ID check distinguishes client repetition from an anomalous RPC page: overlapping client calls are blocked; a repeated ID returned by a single/current RPC result is surfaced as a read-contract error for investigation. No new identity or database cursor scheme was introduced.

## Verification

| Check | Result | Evidence boundary |
| --- | --- | --- |
| `node --experimental-strip-types scripts/verify-h15bc-inventory-consistency.mjs` | **PASS** | Runs the actual page-append and synchronous claim/release helpers: distinct append, repeat within/across pages, rapid second claim, stale release, and recovery; also checks component wiring. It does not mount React. |
| `npm.cmd run typecheck` | **PASS** | `tsc --noEmit`, exit 0. |
| `npm.cmd run build` | **PASS** | Vite transformed 3,018 modules; exit 0. |
| `npm.cmd run verify:quality` | **PASS** | Existing 11 checks. |
| `node scripts/verify-manager-inventory-ui-completion.mjs` | **PASS** | Existing 19/19 checks. |
| Rendered rapid double-click, failed page retry, filter change while pending | **NOT TESTED — REQUIRES CONSOLIDATED LOCAL ACCEPTANCE** | Requires controlled authenticated local RPC timing. |
| Live ledger ID/order/cursor reconciliation | **NOT TESTED — REQUIRES CONSOLIDATED LOCAL ACCEPTANCE** | No SQL or browser exercise in H-15C. |

No RPC, ledger row, migration, or hosted resource changed.
