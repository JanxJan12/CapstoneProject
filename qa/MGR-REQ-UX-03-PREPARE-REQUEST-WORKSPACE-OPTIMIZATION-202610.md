# MGR-REQ-UX-03 — Prepare Request workspace optimization

**Date:** 2026-10-25 (Asia/Manila)  
**Result:** **PARTIAL.** The local frontend implementation and focused regressions pass. The latest implemented desktop screenshot was compared with the rendered active component and written approved design; the approved illustration itself was unavailable for pixel-level comparison. Native 200% zoom, screen reader, and authenticated hosted acceptance were not run.

## Baseline and implementation

Before this change, Prepare Request had one long column: header, an attention disclosure limited to zero suggestions, selected items, a separate item picker, then Priority/Needed time and review actions below the work. On initial load it automatically selected every positive suggested item and wrote the working sheet to session storage. Quantity validation, explicit review, and issue RPCs were already present.

`src/modules/manager/inventory/ManagerRequestsPage.tsx` now presents an item-centered authoring area beside a compact Request Details panel at desktop width. The left side has the unsaved-sheet identity, a small stock-attention disclosure, Search/Add Items, and a selected-item table with actual item unit, usable stock at need, recorded minimum, open requests, provisional gap, editable request quantity, validation, justification, and removal. Tablet stacks the details panel after the item work. Mobile uses the existing editable item cards. Adding an item focuses its visible quantity input, and selected items disappear from picker options. The empty state is short and explicit.

The attention count uses currently loaded proposal items whose usable stock at the selected needed time is at or below the recorded minimum. Its detail preserves the distinction between usable stock, open requests, and a zero provisional suggestion. Attention items are never selected automatically. The working sheet remains in React state while navigating within the mounted workspace; this milestone removes the previous session-storage autosave and does not introduce a persisted draft. A Stock Overview item deep link still selects that specifically requested item. Existing provisional quantities, precision, override justification, selected needed-time refresh, review confirmation, issue/revision RPCs, and manual external handoff remain.

The Request Details panel uses only the supported Priority and Manila needed date/time inputs. It shows the fixed Production Team destination as information. The illustration's destination dropdown, general Notes, sample units, and sample stock numbers were not copied because the active issuance contract does not support those fields. The panel shows selected item-line and correction counts, refreshes guidance without overwriting entered quantities, and keeps Review Request separate from Issue Request. No mixed-unit total is shown.

## Files changed

- `src/modules/manager/inventory/ManagerRequestsPage.tsx` — authoring composition, deliberate selection, guidance, validation summary, input focus, and removal of session autosave.
- `src/styles/theme.css` — scoped desktop grid, details panel, and item-table styling.
- `scripts/fixtures/manager-focused-mocks.ts` — synthetic mixed-unit/zero-gap proposal, needed-time call tracking, and service-error case.
- `scripts/verify-mgr-req-ux-03-browser.mjs` — focused authoring regression and screenshots.
- `scripts/verify-mgr-req-ux-01-browser.mjs`, `scripts/verify-mgr-req-ux-02-browser.mjs`, `scripts/verify-mgr-req-ux-02a-browser.mjs` — earlier browser regressions now deliberately select two items before review, preserving their review/issue assertions.
- This report and `qa/MANAGER-MODULE-IMPLEMENTATION-ROADMAP-202610.md`.

No backend file, Supabase RPC signature, schema, migration, Receiving screen, or issued-request detail view changed.

## Rendered evidence

These are actual Chrome screenshots of isolated synthetic fixtures. The referenced conversation supplied a [full-app screenshot of the implemented empty desktop Prepare Request screen](mgr-req-ux-03-rendered-20261025/reference-implemented-desktop-20261025.png). Its approved illustration was not included in the cached conversation or local project mirror, so exact illustration fidelity is **NOT TESTED**. The full-app screenshot was compared with the active component's empty desktop rendering; the fixture screenshots omit the app sidebar and use a 1280 px viewport, so shell-level pixel alignment is also **NOT TESTED**. The written target and rendered screens were compared for the two-column composition, density, units, guidance, input access, and horizontal overflow.

| Required view | Screenshot |
| --- | --- |
| Empty Prepare Request, desktop | [prepare-1280](mgr-req-ux-03-rendered-20261025/prepare-1280.png) |
| Populated multi-item table, desktop | [populated-multi-item-1280](mgr-req-ux-03-rendered-20261025/populated-multi-item-1280.png) |
| Request Details, desktop | [request-details-1280](mgr-req-ux-03-rendered-20261025/request-details-1280.png) |
| Validation/error state, desktop | [validation-1280](mgr-req-ux-03-rendered-20261025/validation-1280.png) |
| Explicit pre-issue Review Request | [review-1280](mgr-req-ux-03-rendered-20261025/review-1280.png) |
| Populated tablet | [tablet-populated-820](mgr-req-ux-03-rendered-20261025/tablet-populated-820.png) |
| Mobile item editor | [mobile-item-editor-390](mgr-req-ux-03-rendered-20261025/mobile-item-editor-390.png) |
| Mobile details and review action | [mobile-review-action-390](mgr-req-ux-03-rendered-20261025/mobile-review-action-390.png) |
| Proposal service error | [proposal-error-1280](mgr-req-ux-03-rendered-20261025/proposal-error-1280.png) |
| Expanded stock attention | [stock-attention-open-1280](mgr-req-ux-03-rendered-20261025/stock-attention-open-1280.png) |
| Stock-aware picker selection, tablet | [stock-aware-picker-820](mgr-req-ux-03-rendered-20261025/stock-aware-picker-820.png) |

## Visual-fidelity follow-up

The accepted desktop structure is retained: requested items on the left, Request Details on the right, and a compact editable table when populated. The latest full-app screenshot showed the same structure and an empty requested-items placeholder. This follow-up made three concrete changes: the stock-attention summary now has an icon, explicit Details cue, and readable separate item rows when opened; the item picker names each item's unit and provisional gap and shows usable stock, open requests, and gap before adding; and the empty state has centered spacing and a clear heading. The expanded notice height was adjusted after the first render cut off the fourth synthetic item. No quantity, unit, proposal, validation, or issue calculation changed.

The active desktop multi-item table remains compact and shows each catalog unit alongside usable stock, recorded minimum, open requests, provisional gap, and editable quantity. Tablet stacks Request Details below the item workspace; mobile uses editable item cards. This is a visual and local fixture comparison, not a hosted authenticated acceptance claim.

## Verification

| Check | Result | Scope |
| --- | --- | --- |
| `node scripts/verify-mgr-req-ux-03-browser.mjs` | **PASS** | 1280/820/390 px: initially empty selection; search/no match; add/focus/multiple items; duplicate prevention; units and provisional guidance; zero, negative and excess-decimal errors; manual justification; remove; changed needed time and matching proposal request; entered-value preservation on refresh; no autosave; explicit review then synthetic issue; service error; no horizontal overflow, browser exception, external request, or network write. [Result](mgr-req-ux-03-rendered-20261025/result.json). |
| `node scripts/verify-mgr-req-ux-01-browser.mjs`; `node scripts/verify-mgr-req-ux-02-browser.mjs`; `node scripts/verify-mgr-req-ux-02a-browser.mjs` | **PASS** | Prior Request register, fulfillment, Actions, History & Audit, authoring, and issue regressions. The 02A check timed out once under simultaneous browser load and passed on a standalone rerun. |
| `node scripts/verify-inv-export-browser.mjs`; `node scripts/verify-inv-export-pdf.mjs` | **PASS** | Document/prior-revision exports and 3-line/36-line PDFs. Browser PNG timing failed once under simultaneous load and passed on a standalone rerun. |
| `node scripts/verify-h23-request-workflow.mjs`; `node scripts/verify-h24-manager-navigation.mjs` | **PASS** | 40 Request assertions and 15 mounted Manager destinations. |
| `node scripts/verify-mgr-rec-ux-02-browser.mjs` | **PASS** | Separate synthetic Receiving regression at 1280/820/390 px. |
| `npm.cmd run typecheck`; `npm.cmd run verify:quality`; `npm.cmd run build` | **PASS** | TypeScript, 11 quality checks, and production bundle. |

Browser checks covered keyboard-operable selection and focus after adding, labeled quantity/date inputs, field errors, status text, and viewport overflow. **NOT TESTED:** native 200% zoom, screen reader, actual Manager authorization/issuance on hosted Supabase, real inventory accounting, and exact approved-image fidelity. These limits keep the overall milestone at PARTIAL despite the passing local implementation.

**2026-10-25 follow-up verification:** The focused MGR-REQ-UX-03 fixture passed again at 1280/820/390 px, including opening and closing the stock-attention disclosure and checking stock guidance before Add item; it recorded zero external requests, network writes, and browser exceptions. MGR-REQ-UX-01/02/02A, text/PNG/PDF export, and MGR-REC-UX-02 browser regressions passed. MGR-REQ-UX-02A timed out once while waiting for dialog focus and passed on a standalone rerun. H-23 (40 assertions), H-24 (15 destinations), typecheck, 11 quality checks, and production build passed. The Receiving post and request issue in these checks were synthetic fixture actions only.

**Hosted business writes: NO. Backend migration: NO. Deployment: NO.** `PR-20261023-000004`, `RR-20261024-E3761566`, `RR-20261024-D5CCDA2A`, and `PR-20261013-000001` were not touched.

## Selected-item density refinement (2026-10-25)

The selected-item row now keeps **Expiry unverified** and **No positive suggestion** as short visible guidance, with separate keyboard-operable Guidance details for the expiry check and why the provisional gap may be zero. Remove sits beside the item name. The zero-quantity field error reads **Enter a quantity greater than 0.** and remains linked to its input through `aria-describedby`; the advisory does not serve as validation. The same guidance appears on mobile. This is presentation-only; proposal values, catalog units, quantity precision, override justification, review, and issuance are unchanged.

The synthetic Buko Juice fixture now exercises unverified expiry and a zero suggested gap. [1280](mgr-req-ux-03-rendered-20261025/compact-advisory-1280.png), [820](mgr-req-ux-03-rendered-20261025/compact-advisory-820.png), and [390](mgr-req-ux-03-rendered-20261025/compact-advisory-390.png) px captures show the collapsed state. The focused browser check **PASS** confirms visible statuses, input-linked error, Enter open/close and focus, no page overflow, multiple selected items, and the existing synthetic review/issue flow. Request UX-01 browser, H-23 (40 checks), typecheck, quality (11 checks), and build **PASS**. Browser proof uses a local fixture; screen reader, native 200% zoom, authenticated hosted issuance, and exact approved-image fidelity remain **NOT TESTED**. Hosted writes, migrations, and deployments: **NO**.
