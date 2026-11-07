# RRJ’S FOOD-HOUSE — Manager UI/UX Recommendations

**Date:** 2026-10-23 (Asia/Manila). Companion to [the comprehensive audit](MANAGER-MODULE-COMPREHENSIVE-AUDIT-202610.md). These are recommendations only. The screenshots linked below come from a **synthetic local fixture** that renders current Dashboard/Inventory/Requests/Receiving source; they are not hosted authenticated sessions. Historical [2026-10-13 Manager screenshots](MANAGER-MODULE-UIUX-IMPLEMENTATION-20261013.md) cover seven screens before later changes.

## 1. Design assessment

The current Manager UI has a coherent task hierarchy, strong semantic distinctions between draft and posted stock, visible refresh/error states, and room for dense operational data. The [desktop Dashboard](manager-audit-browser-20261023/dashboard-1440x900.png) puts payment and stock queues before charts; the [mobile Stock Overview](manager-audit-browser-20261023/inventory-390x844.png) preserves counts, filters, and actions in one column. The Requests and Receiving pages explain the real order of work. Keep this structure. Improve specific gaps below; do not hide batch, line, receipt, or audit detail for cosmetic minimalism.

## 2. Navigation hierarchy

The 15 active destinations are grouped into Dashboard, Restaurant Operations, Inventory & Supply, and Business Management; Item Stock is an Inventory drill-down. H-24 source assertions passed today. Preserve the current task order and active state. In a later authenticated browser pass, verify all destinations, Back/Forward/deep links, expanded group state, mobile drawer focus/Escape, and item/report/request ID continuity. The synthetic fixture covers only four pages; it cannot prove the entire navigation flow.

## 3. Dashboard usability

The [synthetic Dashboard](manager-audit-browser-20261023/dashboard-1440x900.png) makes “Needs attention” prominent and labels verified fulfilled sales separately from all orders created today. Preserve its last-loaded time and stale-error banner. **MGR-02 / P2:** the hosted low-stock metric uses physical on-hand, while Stock Overview can identify usable-out and expired-stock conditions. Add a distinct usable-stock urgency cue or an explicit Stock Monitor link text for those conditions. Keep the physical metric and its label; do not silently reinterpret it. Show an affected-item drill-down using an existing route. Effort **Small–Medium**, business value **High**.

## 4. Menu Management

Current source supports search, category filtering, availability, Fixed Meal Options, and Drink Choice adjustments. Keep manual versus effective availability visible and preserve the readback gate after an uncertain change. **MGR-01 / P2:** agree with the restaurant which ordinary product/category fields Managers may change. If self-service administration is required, provide a narrow create/edit flow with a review of price, category, image, and stock/recipe consequences; otherwise rename/describe the page as current-item availability and choice configuration. Do not display a “Save” path for fields without authoritative backend validation. Show **0 configured meal options** as an actual empty configuration state rather than an error. Never prefill a rice quantity from a guess. The 2026-10-13 Menu screenshot predates meal/drink panels, so their current mobile layout needs rendered acceptance. Effort **Medium–Large if new guarded backend writes are approved; Small for truthful scope copy**, business value **Medium–High pending owner policy**.

## 5. Inventory tables and item detail

Keep physical, usable, expired, minimum, outstanding requests, and draft receipts as distinct measures. The [390 px Stock Overview](manager-audit-browser-20261023/inventory-390x844.png) shows filter controls and count without horizontal document overflow. Continue using card layouts for small screens and intentional local table scrolling for wide batch/movement detail. A counted item should open Item Stock with batch priority, last movement, and clear return to Overview. Do not add recipe formulas to broad staff views. Effort **Small** for targeted rendered acceptance; business value **High** because wrong interpretation can lead to stock decisions.

## 6. Production Requests

The [390 px unsaved request sheet](manager-audit-browser-20261023/replenishment-390x844.png) communicates Prepare → Issue → Send via Messenger → Receive and reconcile. Retain the distinction between an unsaved editable sheet, an issued immutable revision, an external handoff export, and Manager-recorded attestations. Keep requested, accepted, rejected, and outstanding quantities together in history. Prior local E2E verified revision and two partial receipts. Improve only if current authenticated rendering exposes a concrete friction point; the current screenshot alone does not justify another workflow redesign. **MGR-04 / P3** should be measured before adding history pagination. Effort **Small for validation**, business value **Medium**.

## 7. Receiving workflow

The [768 px Receiving view](manager-audit-browser-20261023/stock-receiving-768x1024.png) presents documents, status filters, search, and a clear “No receipt selected” next step. Preserve the prominent accepted/rejected review and the distinction that a draft has no stock consequence while posting moves only accepted stock. Maintain a confirmation that identifies the exact report and resulting quantities, then make posted receipts read-only. In an authenticated isolated session, check the post dialog, error/unknown-outcome readback, long line names, and narrow form widths. Effort **Small for validation; targeted fix only if observed**, business value **High**.

## 8. Reports and filters

The Reports screen explicitly says “verified-payment revenue from successfully fulfilled orders” and identifies the applied Manila date range; that is clearer than a generic Sales total. Preserve this definition and the separate empty states for no fulfilled orders versus fulfilled orders without verified revenue. Before adding collections, refunds, or shift totals, obtain owner-approved definitions and reconcile a same-period synthetic Cashier/Reports/Shift dataset. Distinguish report filters from the latest selected dates, and retain a text table alternative to the chart for accessibility. No discrepancy was established today. Effort **Medium for reconciliation**, business value **High for decision confidence**.

## 9. Staff Management

Riders has a role-specific review/status workflow, Customers is read-only, and Settings provisions KDS credentials. There is no active general staff-account screen. Confirm whether staff creation, activation, and role assignment intentionally occur outside Manager before designing UI. If Manager authority is approved, require server-side actor checks, explicit confirmations, and audit evidence; never treat a hidden button as authorization. Effort **policy dependent**, business value **not yet established**.

## 10. Loading, error, and empty states

Current Dashboard, Menu, Inventory, Riders, Customers, and Reports have explicit loading, error/retry, or stale-data cues. Preserve their distinct meanings: an empty successful read is not a failed read, and an uncertain mutation is not confirmation. A current authenticated screen review should inspect long backend failures without raw internal details and confirm focus/announcement of alerts. Synthetic fixture states and historical browser screenshots are supporting evidence only. Effort **Small**, business value **Medium**.

## 11. Responsive behavior

[Result JSON](manager-audit-browser-20261023/result.json) records **20 current synthetic fixture renders** at 360×800, 390×844, 768×1024, 1024×768, and 1440×900 for Dashboard, Overview, Requests, and Receiving. All rendered headings/actions. No document overflow was measured at 360, 390, or 768 px. At 1024 and 1440 px, the document was 70 px wider than the viewport and could actually scroll **80 px** horizontally, although body/main widths stayed within the viewport and no measured element box extended beyond it. **MGR-03 / P2:** isolate the shared shell/root cause; preserve intentional table-local scroll. Recheck the same five widths, open mobile drawer, and long labels. Effort **Small–Medium**, business value **Medium**.

## 12. Accessibility

Source has native buttons/labels, focus-visible rings, named sections, status/alert roles, desktop tables and mobile cards, drawer focus behavior, and chart text alternatives. A rendered spoken screen-reader pass, quantitative contrast across states, complete keyboard sequence, 200% zoom, and dialog focus review were **NOT TESTED** in this audit. Do not claim WCAG 2.2 AA from source or screenshots. Keep status wording plus color, readable disabled controls, and explicit table headers/scroll hints. Effort **Medium for focused acceptance**, business value **High**.

## 13. Design consistency

Use the existing Manager page header, `Button`, `Badge`, table/card, and status patterns rather than a new visual system. Show units next to quantities and distinguish “recorded physical,” “usable,” “requested,” “draft,” “accepted,” and “posted” consistently. Keep refresh timestamps in Manila and format money as PHP. Avoid decorative data cards that hide audit fields. Effort **Small**, business value **Medium**.

## 14. Screen-by-screen action list

| Screen | Keep | Focused next action | Priority / effort |
| --- | --- | --- | --- |
| Dashboard | Attention first; clear financial labels; refresh/stale states | Add separate usable-stock attention after synthetic expiry case | P2 / Small–Medium |
| Orders | Loaded-100 scope warning, mobile detail cards | Verify long identifiers, selection/focus, and Cashier status consistency in authenticated read-only browser | Verification / Small |
| Menu | Search/category, manual/effective state, meal/drink controls | Decide ordinary master-data authority; if approved, scoped guarded editor | P2 / Medium–Large |
| Stock Overview & Item Stock | Physical/usable/expired, batch guidance, requests | Verify responsive batch/movement detail and exact item handoff | Verification / Small |
| Requests | Sheet/revision/external handoff/reconciliation | Measure history growth before paging; keep attestation language | P3 / Small |
| Receiving | Draft/posted separation and accepted-only review | Test dialog, unknown outcome, long lines at narrow widths | Verification / Small |
| Movements, Waste, Adjustments, Audit | Separate correction and evidence destinations | Check quantity units, confirmations, return context and status announcements | Verification / Small |
| Reports & Shift Audit | Fulfilled/verified definition and Manila range | Reconcile synthetic journal/shift boundary before new metrics | Verification / Medium |
| Riders & Customers | Role-specific directory and private document flow | Test signed-document/error and confirmation focus with isolated account | Verification / Medium |
| Settings | One-time KDS secret handling | Test copy/close/secret disappearance in isolated session | Verification / Small |

## 15. Screenshots and evidence boundary

Representative current synthetic captures: [Dashboard desktop](manager-audit-browser-20261023/dashboard-1440x900.png), [Dashboard mobile](manager-audit-browser-20261023/dashboard-360x800.png), [Stock mobile](manager-audit-browser-20261023/inventory-390x844.png), [Requests mobile](manager-audit-browser-20261023/replenishment-390x844.png), [Receiving tablet](manager-audit-browser-20261023/stock-receiving-768x1024.png). The fixture contains synthetic numbers, names, request/receipt IDs, and a synthetic Manager session. Its first run lacked the session fields needed by Dashboard and displayed an access error; the final fixture runner supplies them and rendered the Dashboard. That was a harness setup correction, not a production defect. Previous authenticated local browser images are linked from [the 2026-10-13 report](MANAGER-MODULE-UIUX-IMPLEMENTATION-20261013.md); no current hosted authenticated screenshot was captured.

## 16. Value and sequencing

First, address **MGR-02** because it improves an operational attention signal using existing stock concepts without creating new menu authority. Then fix **MGR-03** after isolating the shared root overflow. Decide **MGR-01** with the restaurant owner before proposing database writes or editing current catalog data. Measure **MGR-04** only if history size/load time warrants it. Run authenticated visual/accessibility acceptance as a separate verification gate. No UI change was implemented in this audit.
