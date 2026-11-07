# H-25 Manager visual design and operational usability refinement

**Scope and baseline:** Focused offline frontend work on 2026-10-16 in the canonical worktree. Starting branch/status was `main...origin/main`; HEAD was `9748bdef6d31a96282b88dc67f02724b8fd05819`. The worktree already had extensive modified and untracked user-owned files, including `InventoryPage.tsx` and the H-20 through H-24 reports. No existing work was reset, cleaned, stashed, or discarded. H-16 remains **10 PASS / 0 FAIL / 49 NOT RUN**.

## A. Executive summary

The mounted Inventory Overview now presents its three independent attention sources as simpler, readable lists, gives the stock panel more width at laptop breakpoints, and lets mobile stock quantities reflow. Its header actions can wrap their labels on narrow screens. The change is limited to presentation in the active Overview; no new data, operational action, route, or business rule was introduced. These are source-level improvements. Rendered browser and device appearance remains **NOT TESTED**.

## B. Current Manager UI structure

`src/modules/manager/index.tsx` mounts the 15 Manager menu destinations through the existing page switch and shared shell. Inventory Overview (`InventoryPage.tsx`) leads to Item Stock (`InventoryItemDetail.tsx` and `InventoryBatchList.tsx`), Requests (`ManagerRequestsPage.tsx`), Receiving (`StockReceivingPage.tsx` and `ReceivingDocumentList.tsx`), Stock Movements (`InvTransactionsPage.tsx` and `StockMovementList.tsx`), Waste, Adjustments, and Audit. H-24 groups these destinations by task; Item Stock is a drill-down rather than another menu entry. Dashboard, Orders, Menu, Riders, Reports, and Settings use the existing Manager shell and design system.

The selected page uses Tailwind utility classes, the shared `Button`, the application palette in `src/styles/theme.css`, `manager-*` Inventory styles, semantic headings, status text, and independent stock/proposal/Receiving read states. Existing desktop tables and smaller-screen stock cards coexist. Requests and Receiving already have their own document and post-review surfaces; this phase does not rewrite them.

## C. Source-confirmed UX problems

1. The H-22 attention area had three bordered panels, each containing individual rounded, tinted row cards. Up to five rows per source added repeated surfaces around names, quantities, and next actions. This made the decision text and navigation harder to scan in source layout.
2. The three attention panels switched directly to three columns at `lg`. At laptop widths this allocated a narrow column to the stock item name, three quantity labels, and a long item-specific action. The stock card below also forced its three quantity cells into one row at every narrow width.
3. Overview header actions used the shared Button's `whitespace-nowrap` behavior. The header could wrap buttons as a group, but their labels could not wrap inside a constrained button. This was a source-level responsive concern, not a measured overflow incident.

## D. Design rationale and task impact

The hierarchy remains **location → attention source → affected record and condition → existing action → supporting quantities and caveats**. Each source retains its own section, heading, loading/error/empty content, and retry. Divided list rows replace repeated nested cards without hiding any stock condition, outstanding amount, draft state, or source caveat. Stock health spans two columns at `lg`, while the other two sources share the next row; all three return to one row at `2xl`. The smaller-screen stock card uses two quantity columns until `sm`, then three. Header button text can wrap while the existing primary Prepare Request and secondary actions keep their visual hierarchy.

Managers can scan affected records and reach Item Stock, Requests, or Receiving with less repeated decoration and fewer cramped lines. No backend authority, request dispatch evidence, post consequence, or batch order is inferred from this layout.

## E. Actual source changes and before/after experience

| File and component | Previous behavior | New behavior and reason |
| --- | --- | --- |
| `src/modules/manager/inventory/InventoryPage.tsx`, `InventoryPage` attention center | Three panels at `lg`, with separate tinted row cards inside each. | Two-column laptop layout with wider stock health; three columns at `2xl`. Three labeled `section` landmarks contain compact divided lists. The same first-five records, warnings, quantities, source caveats, retries, and callbacks remain. |
| `src/modules/manager/inventory/InventoryPage.tsx`, `StockOverviewCard` | Physical, usable, and expired quantities always occupied three columns. | Two columns on narrow screens and three from `sm`; labels and numeric values retain their definitions. |
| `src/modules/manager/inventory/InventoryPage.tsx`, Overview header and list actions | Button labels could be kept on one line even when the header wrapped; item actions had a 40 px minimum and limited long-text wrapping. | Header buttons permit internal text wrapping; item actions have a 44 px minimum, long-text wrapping, and existing visible focus treatment. |
| `qa/H25-MANAGER-VISUAL-DESIGN-AND-USABILITY-REFINEMENT.md` | No H-25 evidence record. | Records scope, source findings, changes, checks, boundaries, and next visual acceptance. |

No screenshot is presented as current rendered evidence. The before/after descriptions are based on the inspected source.

## F. Accessibility and responsiveness

The attention panels are now named sections under the existing page `h1` and attention `h2`, each with its own `h3`. The native buttons remain keyboard operable, and their focus rings and disabled behavior remain. Item navigation links have at least a 44 px coded height and can wrap long names; the header's shared Buttons retain their existing focus and variants. Existing status, alert, and retry semantics remain visible to assistive technology.

The CSS breakpoint and text-wrap changes are source-level. Actual spacing, contrast, focus order, screen-reader announcements, horizontal overflow, and touch use need rendered testing.

## G. Preserved workflows and contracts

- **H-21:** Server-ordered batch decision support, eligibility guard, and stock-consistency warning were not edited.
- **H-22:** Three independent Overview reads, read gates, version/in-flight protections, truthful loading/error/empty states, bounded rows, filters, and stock/detail/Receiving navigation callbacks remain.
- **H-23:** Formal Requests progress, recorded dispatch distinction, linked Receiving, conditional outstanding quantities, accepted-only posting review, confirmed-post feedback, and unknown-outcome safeguards were not edited.
- **H-24:** The 15 Manager menu destinations, current-page preservation, and item-detail title/selection remain.
- **Authority:** Manager role authorization and all inventory posting, batch, movement, ledger, payment, and order semantics remain in their existing paths. No API, database, migration, RLS, Docker, hosted, or business-data operation was changed.

## H. Verification results

| Check | Result | Evidence boundary |
| --- | --- | --- |
| `npm.cmd run typecheck` | **PASS** | Static TypeScript compilation. |
| `npm.cmd run verify:quality` | **PASS** | Existing 11 quality checks. |
| H-21 batch, H-22 overview, H-23 request, H-24 navigation verifiers | **PASS** | 10, 10, 15, and 16 focused assertions respectively; H-24 also found 15 unique mounted destinations. Offline source/synthetic scope. |
| H-15B/C consistency verifier | **PASS** | Existing stale-register and pagination assertions. |
| Manager Inventory UI completion verifier | **PASS** | Existing 19 source checks. |
| Prettier and changed-file `git diff --check` | **PASS** | Source formatting and whitespace only. |
| Authenticated Manager, browser render, tablet/mobile render, screen reader, keyboard journey, database, hosted, physical operation | **NOT TESTED** | Prohibited by H-25's offline-only scope. |

## I. Security, performance, and maintenance

The change adds no fetches, polling, writes, permission checks, state, dependencies, or UI framework. Each attention list retains its existing five-record bound; there is no expanded historical read. Additional semantic sections and changed CSS utilities have negligible rendering cost. Reusing the current Button and palette avoids a second presentation system. The main regression risk is visual: at particular viewport widths, text and button wrapping or a wider stock panel may not look as intended until rendered review.

## J. Outstanding visual acceptance

In a separately authorized rendered session, inspect desktop Manager navigation and laptop, tablet, and mobile layouts; Overview attention/list readability and failure/empty states; Item Stock tables and H-21 batch guidance; Requests lifecycle and Receiving posting review; Movement history, forms, and dialogs. Check keyboard navigation and focus, screen-reader headings/status announcements, touch targets, long item/report names, and page/table overflow. Reconcile any visual concern with the current source before another change. No runtime or hosted acceptance is claimed here.

## K. Next recommendation

Review the formal Requests audit timeline's raw event details for a narrow, source-backed readability improvement, while retaining exact actor, revision, timestamp, and Manager-attestation labels. This is a recommendation for a later phase, not part of H-25.
