# H-22 Manager Inventory Overview action center

**Scope:** Focused source development, 2026-10-16, in the preserved dirty canonical worktree. The [H-20 operational review](H20-MANAGER-OPERATIONAL-UX-QUESTION-REVIEW.md), [H-21 batch decision report](H21-MANAGER-INVENTORY-BATCH-DECISION-SUPPORT.md), and H-15B/H-15C consistency reports informed this change. No executable backend, business data, service, browser, or hosted environment was changed or accessed.

## A. Executive summary

The active Stock page is now titled **Inventory Overview** and starts with an operational action center: affected stock items, outstanding requested quantities, and up to five unposted Receiving drafts. Each row states what the Manager can trust and takes them to the mounted item detail, formal Requests, or selected Receiving report. Existing stock metrics and the detailed table remain. An expiry *warning window*, supplier acknowledgment, request-document follow-up list, and physical quality status remain unsupported by the current bounded overview reads and are not claimed.

## B. Existing Overview architecture

`ManagerApp` mounts `InventoryPage` for `inventory`; the existing item, Requests, Receiving and Movements destinations are state-switched in the same shell. [Manager navigation](../src/modules/manager/index.tsx#L242). Before H-22, the overview called `get_manager_inventory_stock_summary` and `get_inventory_request_proposal` together. It displayed counts, filters and a dense table/cards, with one page-wide failure state. The server supplies recorded physical quantity, usable quantity, expired quantity, reorder level and nearest use-by; proposal data supplies valid-at-need and outstanding quantity for its eligible item set. [Overview](../src/modules/manager/inventory/InventoryPage.tsx), [stock API](../src/modules/manager/inventory/inventoryApi.ts#L674), [request API](../src/modules/manager/inventory/inventoryRequestApi.ts#L84).

The new Receiving section uses the existing `get_manager_receiving_documents` status filter at offset 0, limit 5, via `getReceivingDocuments`. That client function also requests policy classification for returned rows. It is a bounded, Manager-authorized read. [Receiving API](../src/modules/manager/inventory/receivingApi.ts#L653). The formal `get_inventory_request_register()` has no bounded overview parameter, so this page does **not** load all request documents just to build an alert. Its quantity summary cannot identify specific undisbursed documents or external acknowledgments; the Requests page remains the place to inspect those records.

## C. Confirmed UX gaps selected

1. Stock attention existed mainly as four numbers and a table filter; affected items and the next existing task were below the summary.
2. Outstanding proposal quantities and Receiving drafts were not visible together on the overview, so incoming-stock work required separate navigation.
3. A joint stock/proposal read failed the entire page and could leave previous projections in state during a refresh. Independent failures needed explicit “unavailable,” not an empty/healthy conclusion. These are source observations; rendered behavior has not been tested in H-22.

## D. Implementation design

Before: **Stock Monitor → four counts → filters → stock table/card**. Now: **Inventory Overview → What needs your attention? (stock, requests, Receiving) → clickable stock health counts → filters and detailed stock table/card**. The three read sections load independently and show loading, successful empty, or error/retry states. A refresh clears old rows synchronously through state updates and read gates, then uses a version token so older completions cannot replace a newer result. A synchronous in-flight guard prevents rapid duplicate refresh launches. Section actions also check the current successful-read gate before navigation.

The first five affected items and first five outstanding proposal item quantities are shown; the full item list and Requests workflow remain available. Stock-count controls clear other filters and scroll to the affected item list. Receiving shows only the first five draft documents, without presenting that page as a complete count or a ready-to-post approval queue. Selecting a draft carries its report ID into the already mounted Receiving component. No new route or write action was added. [Overview](../src/modules/manager/inventory/InventoryPage.tsx), [Manager handoff](../src/modules/manager/index.tsx#L254).

## E. Changed files

| File / component | Previous → new behavior | Contract reused / reason |
|---|---|---|
| [InventoryPage.tsx](../src/modules/manager/inventory/InventoryPage.tsx), `InventoryPage` and existing stock card | Joint stock/proposal load, summary statistics ahead of actions → independent stock/proposal/draft reads; task cards and accurate navigation; failed reads clear only their source; filters and table preserved. | Stock summary, request proposal, bounded draft documents. Makes operational work visible without moving mutations. |
| [inventoryOverview.ts](../src/modules/manager/inventory/inventoryOverview.ts), `stockAlerts`, `attentionItems`, `validRequestProposal` | No focused overview classification helper → derives only supported out/low/expired conditions, orders affected rows, and rejects malformed/unbounded-feeling proposal values rather than rendering NaN. | Existing server quantities and reorder level. No new threshold or batch-selection policy. |
| [index.tsx](../src/modules/manager/index.tsx), Manager inventory handoff | Stock page could navigate to Receiving generally → it can pass a selected draft report ID to the existing `initialReportId` destination. | Existing Manager state navigation and Receiving loader. |
| [verify-h22-inventory-overview.mjs](../scripts/verify-h22-inventory-overview.mjs) | No focused H-22 assertion → ten offline checks for alert classification, order and invalid proposal rejection. | Synthetic in-process values only; no application/DB fixture. |

## F. Alert classification and evidence

| Condition | Authority / rule | UI and action | Limit |
|---|---|---|---|
| No usable stock | `get_manager_inventory_stock_summary`: active item with `usableQuantity <= 0` | “No usable stock”; shows usable and recorded on-hand; opens item detail. | Physical quantity may be positive. No physical count certification. |
| Low usable stock | Same RPC: active, positive usable quantity at/below configured `reorderLevel` | “At or below reorder level”; opens item detail and existing request action. | Threshold is a minimum, not a demand forecast. |
| Expired physical stock | Same RPC: `expiredQuantity > 0` | “Expired stock remains on hand”; opens item detail and H-21 batch guidance. | Expiry-required recorded batches only; no new “expiring soon” window or physical quality judgment. |
| Outstanding requested quantity | `get_inventory_request_proposal`: positive `outstanding` for a proposal item | Quantity labeled “not on hand”; opens formal Requests. | Item-level summary, not a list of request documents, dispatch events or confirmed supplier promises. |
| Unposted Receiving draft | `get_manager_receiving_documents(status=draft, limit=5)` | RR reference, draft status, line count; opens that report in Receiving. | Draft does not add stock, and draft presence does not mean ready to post. No total count beyond first page. |

Physical, usable, expired, outstanding, delivered, accepted and posted quantities remain separate concepts. The overview does not call H-21’s batch decision helper; it routes to item detail for that question. Issuance, dispatch and drafts do not change stock. Only successfully posted accepted Receiving quantities do.

## G. Errors and edge cases

- Stock, request proposal and Receiving reads have separate `loading/ready/error` projections. A failure clears its rows, shows **unavailable**, and offers retry. Successful other sections remain visible. An empty successful stock response says availability cannot be assessed; a successful no-alert result names the exact checked conditions rather than saying everything is healthy.
- Refresh clears the old projections and “as of” label. Version and synchronous read gates prevent late responses or old rendered item/report actions from being treated as current. Unmount invalidates completions. Duplicate refresh while a campaign is in flight is ignored and its control is disabled.
- Filters depending on request proposal report that the proposal is loading/unavailable rather than saying zero items match. The table labels proposal-dependent eligibility and outstanding quantities unavailable when that read fails.
- The request proposal is checked for duplicate IDs, required labels, Boolean expiry verification and finite nonnegative quantities. The bounded Receiving response must contain only drafts. Invalid data makes only that section unavailable; no NaN, fabricated zero, or posted report is presented as an unposted draft.
- No expiry-warning horizon, batch suitability judgment, supplier acknowledgment, formal draft status, Receiving posting readiness or historical Production queue state is inferred. These require separate policy or a suitable bounded read contract.

## H. Security and performance trade-offs

The overview adds one bounded Receiving-document request per refresh and, for returned rows, the receiving API’s existing classification request. It reuses the two prior stock/proposal reads. It makes **no N+1 item-detail reads**, no full request-register or movement-history read, no polling, and no new direct table access. It renders up to five records in each compact list plus the prior table. Current Manager RPC authorization remains the only data authority; the UI never posts a receipt, issues a request, adjusts inventory or selects a batch. Independent read responses can represent slightly different instants, so the page does not combine their quantities into a single “available” total.

## I. Offline verification

| Check | Result | Boundary |
|---|---|---|
| `npm.cmd run typecheck` | **PASS** | Strict TypeScript compile, no runtime. |
| `npm.cmd run verify:quality` | **PASS** | Existing 11 non-workflow checks. |
| `node --experimental-strip-types scripts/verify-h22-inventory-overview.mjs` | **PASS** | Ten pure classification/validation assertions. |
| Changed-file `git diff --check` | **PASS** | Scoped whitespace check; untracked H-22 files also checked as new files. |
| Authenticated Manager, rendered browser, database reconciliation, hosted | **NOT TESTED** | Prohibited during H-22. |

H-16 remains **10 PASS / 0 FAIL / 49 NOT RUN**. Static/offline passes do not promote any H-16 runtime scenario.

## J. Outstanding runtime acceptance

On a separately authorized isolated stack, confirm stock alert classification and physical/usable/batch consistency against one SQL snapshot; outstanding proposal values against formal request lines; draft list status and selected report handoff; stock, proposal and Receiving failure/retry independently; delayed older responses; rapid Refresh; and unmount. Render at desktop/mobile widths and check keyboard, screen reader and touch actions. Verify no overview action writes stock or implies draft posting. Confirm expiry behavior at the Manila date boundary. None was executed here.

## K. Next Manager improvement

Simplify the existing **Requests → Receiving** follow-up journey using its formal register and draft/post review surfaces, with clear documented dispatch attestation versus actual delivery. A bounded request-document overview projection would require separate backend design and authorization. This is a recommendation only, not part of H-22.
