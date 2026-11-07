# H-24 Manager navigation and unified Inventory UX

**Scope:** Source development in the preserved canonical dirty worktree on 2026-10-16. Starting branch/status: `main...origin/main`, with extensive pre-existing modified and untracked files. Starting HEAD: `9748bdef6d31a96282b88dc67f02724b8fd05819`. No existing changes were reset, cleaned, stashed, or discarded. H-20 through H-23 and relevant H-15B/H-15C findings were reviewed.

## A. Executive summary

The Manager Inventory menu now follows tasks: review stock and batches, request and receive, then investigate and correct. The mounted Overview page, menu label, and top bar now agree; Item Stock keeps its parent Inventory selection but receives its own top-bar title. Choosing the already open menu page leaves its local form, filter, and selected-record context intact. All existing pages and record handoffs remain.

## B. Existing navigation before H-24

`ManagerApp` uses a local `ManagerPage` state switch, not separate browser routes for its internal pages. One `MANAGER_NAV_GROUPS` array feeds the shared `AppShell` desktop sidebar and mobile drawer. The shell renders active styling and `aria-current="page"`; mobile selection closes the drawer and focuses main content. [Manager mount](../src/modules/manager/index.tsx), [shared shell](../src/components/layout/AppShell.tsx).

The 15 menu destinations are Dashboard, Orders, Menu; Stock, Requests, Receiving, Stock Movements, Waste / Spoilage, Adjustments, Inventory Audit; Riders, Customers; Reports, Shift Audit, and Settings. Item Stock is a drill-down mounted from Stock, without a duplicate menu entry. Overview → Item Stock/Requests/Receiving/Movements, Item Stock → Requests/Receiving/Waste/Adjustments/Movements, Requests ↔ linked Receiving, and Receiving draft → post already have actual callbacks. Disconnected Supplier/Purchase Order prototypes are not in this menu. [Overview](../src/modules/manager/inventory/InventoryPage.tsx), [item](../src/modules/manager/inventory/InventoryItemDetail.tsx), [Requests](../src/modules/manager/inventory/ManagerRequestsPage.tsx), [Receiving](../src/modules/manager/inventory/StockReceivingPage.tsx).

## C. Confirmed source-level UX gaps

1. Seven Inventory destinations appeared as one flat list. “Stock” led to a page headed “Inventory Overview,” so the entry did not convey that it was the starting place for stock alerts and batch drill-down.
2. The sidebar selection handler cleared item, report, request, and historical Receiving context even when the selected destination was already open. That could reset a current page's local state through an unnecessary remount.
3. Item Stock was represented by the Inventory parent in the menu, but the shared top bar used that parent's Overview label while item detail was visible. This was a source-level title mismatch, not a measured browser defect.

## D. Design

The existing seven Inventory destinations remain in one collapsible section, with three noninteractive task headings: **Review stock & batches**, **Request & receive**, and **Investigate & correct**. The first destination is **Inventory Overview**; its current stock list is explicitly headed **Stock & batches** rather than becoming a second route. Requests is labeled **Requests & Replenishment** while its formal document and separate historical queue stay in the same mounted page. Stock Movements, Waste / Spoilage, Adjustments, and Inventory Audit remain distinct actions.

The same `NavGroup` data renders in desktop and mobile. The shell allows multi-line labels instead of truncating the longer task name. The page switch ignores a selection of the current page but still allows the Inventory parent to return from Item Stock to Overview. A separate display title identifies Item Stock without adding a duplicate menu item or changing a page ID.

## E. Implementation

| File / component | Previous → new behavior | Why |
| --- | --- | --- |
| [index.tsx](../src/modules/manager/index.tsx), `MANAGER_NAV_GROUPS` and `ManagerApp` | Flat Inventory labels → task headings and clearer Overview/Requests labels. Current-page selection reset context → no-op. Item drill-down now supplies its own top-bar title while Inventory remains active. | Makes the existing task order visible and preserves in-progress local page state. All 15 destinations and callbacks remain mounted. |
| [AppShell.tsx](../src/components/layout/AppShell.tsx), `renderSidebarContent` and top bar | One-line truncated item labels → wrapping labels and optional noninteractive section headings. Active label only from menu → optional display title for a drill-down. | Desktop/mobile share the same structure, keyboard buttons, active state, drawer focus, and skip link. |
| [index.ts](../src/types/index.ts), `NavItem` | Adds optional `section` display metadata. | No route or permission change; other role menus need no edits. |
| [InventoryPage.tsx](../src/modules/manager/inventory/InventoryPage.tsx), overview header and stock-results area | Breadcrumb said Stock and list began with filters → breadcrumb says Overview & stock and existing list is headed Stock & batches, with a short purpose sentence. | Connects H-22 attention tasks to H-21 item/batch review without duplicating the Overview destination. |
| [verify-h24-manager-navigation.mjs](../scripts/verify-h24-manager-navigation.mjs) | New offline navigation assertion. | Checks menu uniqueness, mounted cases, shared desktop/mobile menu, active semantics, current-page guard, and selected-context props. |

## F. Task journeys

| Journey | Before | After / existing contract retained |
| --- | --- | --- |
| Low stock | Overview attention item → Item Stock → Request. | **Inventory Overview** is clearly the starting menu entry; Stock & batches names the item list. The same item ID reaches Item Stock, then the existing request callback. |
| Batch review | “Stock” menu → Overview list → Item Stock. | **Review stock & batches** and the list heading explain the path. Item Stock still uses H-21 server-ordered batch guidance; no new batch route. |
| Request | Overview → Requests → selected formal request → linked Receiving. | **Request & receive** groups the two destinations. Existing item, request, and report IDs still pass through the Manager callbacks; H-23 progress remains. |
| Receiving | Receiving list → selected report → review/post/result. | Same mounted page and post path; menu context is clearer. Selecting Receiving while already there no longer resets an open draft or selection. |
| Stock investigation | Overview → general Stock Movements, or Item Stock → item-filtered Movements. | **Investigate & correct** groups Movements with Waste, Adjustments, and Audit. Item-filtered movement handoff still passes `itemContext` to `initialItemId`; the general Overview link remains general. |

## G. Accessibility and responsiveness

Inventory task headings are text, not clickable controls. The seven actual destinations remain native buttons with the shell's focus ring, minimum touch height, active styling and `aria-current`. The existing Inventory toggle keeps `aria-expanded`/`aria-controls`; the mobile drawer keeps Escape/Tab handling and main-content focus after selection. Longer labels now wrap in the available width. The Item Stock top-bar title matches its visible drill-down while the parent menu item remains active. These are source-level affordances; rendered mobile size, contrast, wrapping, focus order and screen-reader behavior were **not tested**.

## H. Preserved business invariants

No request issue, Messenger event, Receiving draft/post, stock writer, batch allocator, ledger, authentication, authorization, migration, table, or RPC implementation changed. Request/dispatch/draft/rejected quantities still do not add stock; only successfully posted accepted Receiving quantities do. The historical single-item Production queue remains inside Requests but separate from formal multi-item documents. H-21 batch safeguards, H-22 independent read states, H-23 progress/post feedback, and H-15B/H-15C freshness protections remain.

## I. Security and performance

Section headings and titles use existing local navigation data; no network reads or writes were added. Current-page selection avoids a remount and its associated read, preserving local filters and form state. Cross-page selection still clears obsolete context through the existing handler; supported record-specific callbacks continue to set their target ID. Navigation grants no role capability and does not call a mutation. The menu remains one seven-item Inventory group, with no new nested state or destination. Browser history for internal Manager pages is still local state; deep links beyond the existing callbacks are not provided.

## J. Offline verification

| Check | Result | Limit |
| --- | --- | --- |
| `npm.cmd run typecheck` | **PASS** | Static TypeScript compile. |
| `npm.cmd run verify:quality` | **PASS** | Existing 11 non-workflow checks. |
| `node scripts/verify-h24-manager-navigation.mjs` | **PASS** | 15 unique mounted menu destinations and 16 source-level continuity/semantics assertions. |
| H-21, H-22, H-23 focused offline verifiers | **PASS** | 10 batch, 10 overview, and 15 request-workflow assertions; source/synthetic checks only. |
| `node --experimental-strip-types scripts/verify-h15bc-inventory-consistency.mjs` | **PASS** | Existing register/movement consistency checks. |
| `node scripts/verify-manager-inventory-ui-completion.mjs` | **PASS** | 19 existing Manager Inventory source checks. |
| Changed-file `git diff --check` | **PASS** | Whitespace check over H-24 files; the new script uses Git's expected no-index difference exit status without whitespace diagnostics. |
| Authenticated app, browser, mobile render, database, hosted | **NOT TESTED** | Prohibited in H-24. |
| Offline verification | **FAIL: none** | No failing check. |
| Runtime/visual acceptance | **BLOCKED by task scope** | Services and browser automation were prohibited. |

H-16 remains **10 PASS / 0 FAIL / 49 NOT RUN**. No H-24 offline check changes those counts.

## K. Outstanding visual acceptance

When an isolated browser run is separately authorized, inspect the desktop sidebar and mobile drawer at narrow widths; check wrapped labels, active state, keyboard focus, skip link, screen-reader navigation, and touch targets. Walk low-stock, batch, request-to-Receiving, posting, and stock-investigation journeys with authenticated Manager data. Confirm selected item/request/report preservation, same-page reselection, return from Item Stock, stale async responses after navigation, and all existing Manager pages. Independently verify stock and ledger results for any actual posting scenario.

## L. Next recommended improvement

Make the formal request audit timeline readable rather than printing raw event JSON. Keep actor, revision, timestamp and Manager-attested external evidence exact. This is a separate narrow UX task, not part of H-24.
