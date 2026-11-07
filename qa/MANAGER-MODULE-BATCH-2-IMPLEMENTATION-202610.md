# Manager Module — Batch 2 Implementation (2026-10-23)

**Status: COMPLETE for local frontend implementation and synthetic browser verification.**

## A. Executive summary

The Manager document could pan 80 px horizontally at desktop widths. A decorative pseudo-element of the desktop sidebar was positioned relative to the page because its sidebar had no positioned containing block. Adding `relative` to that sidebar fixed the source. No table column, card, navigation item, or business behavior was removed.

## B. Root cause and C. baseline measurements

The active Manager shell uses the desktop `<aside aria-label="Manager navigation" class="app-shell-sidebar …">` in `src/components/layout/AppShell.tsx`. Before the fix its computed `position` was `static`. `src/styles/theme.css` defines `.app-shell-sidebar::before` with `position: absolute`, `right: -5rem` (**−80 px**), and `width: 11rem`. The desktop aside therefore did not contain that decorative circle. Its right edge was measured beyond the viewport, creating document scroll even though the sidebar and shell themselves have `overflow: hidden`. An existing Manager `html/body overflow-x: clip` rule did not stop scripted horizontal panning; Batch 2 did not add document clipping.

The isolated [diagnostic browser run](manager-batch-2-browser-20261023/diagnosis.json) measured both interventions before source editing: setting the desktop aside to `position: relative` reduced scroll reach to **0**, and temporarily hiding the pseudo-element also reduced it to **0**. This isolates the decoration and its missing containing block as the cause.

| Viewport | Before `clientWidth` | Before document `scrollWidth` | Before pan | After document `scrollWidth` | After pan |
|---|---:|---:|---:|---:|---:|
| 1024×768 | 1014 | 1094 | 80 px | 1014 | 0 px |
| 1440×900 | 1430 | 1510 | 80 px | 1430 | 0 px |

The 10 px difference between `innerWidth` and `clientWidth` is the vertical scrollbar, not remaining horizontal overflow.

## D. Code changes and E. before/after comparison

- **Production:** `src/components/layout/AppShell.tsx` adds Tailwind `relative` to the Manager-only desktop sidebar. The fixed-position mobile drawer and other role shells are untouched.
- **Fixture/test:** `scripts/fixtures/visual-manager.config.ts`, `visual-manager-mocks.ts`, and `visual-manager.tsx` add local-only Menu, Reports, and Riders states to the pre-existing Manager fixture. Mutating mock functions throw; no hosted API is used.
- **Verification:** `scripts/verify-manager-batch-2.mjs` asserts DOM widths, scroll reach, shell interaction, an internally scrolling table, and safe synthetic requests. `qa/manager-batch-2-browser-20261023/diagnose.mjs` and its JSON preserve the root-cause experiment. The fixture screenshots, JSON result, and inventory verifier log are in the same QA directory.

Only the desktop sidebar's positioning changed in production. The new positioned containing block keeps the existing decorative circle inside the sidebar's overflow boundary; it does not hide operational content.

## F. Responsive verification matrix

The final [browser result](manager-batch-2-browser-20261023/result.json) contains **45 page/viewport renders**, all with `documentElement.scrollWidth <= clientWidth` and horizontal scroll reach **0**. Values below are the unique measured document/client widths; vertical scrollbars explain the two values at 768.

| Viewport | Screens | Renders | Document/client width | Pan |
|---|---|---:|---:|---:|
| 320×700 | Dashboard, Stock Overview, Requests, Receiving | 4 | 320/320 | 0 |
| 360×800 | Those four plus Menu, Reports, Riders, Stock Movements | 8 | 360/360 | 0 |
| 390×844 | Dashboard, Stock Overview, Requests, Receiving | 4 | 390/390 | 0 |
| 430×932 | Dashboard, Stock Overview, Requests, Receiving | 4 | 430/430 | 0 |
| 768×1024 | Dashboard, Stock Overview, Requests, Receiving | 4 | 758/758 or 768/768 | 0 |
| 1024×768 | Eight screens listed at 360 | 8 | 1014/1014 | 0 |
| 1280×800 | Core four plus Stock Movements | 5 | 1270/1270 | 0 |
| 1440×900 | Eight screens listed at 360 | 8 | 1430/1430 | 0 |

Representative synthetic captures include [Dashboard 1440](manager-batch-2-browser-20261023/dashboard-1440x900.png), [Menu 1024](manager-batch-2-browser-20261023/menu-1024x768.png), [Requests 1024](manager-batch-2-browser-20261023/replenishment-1024x768.png), [Receiving 360](manager-batch-2-browser-20261023/stock-receiving-360x800.png), [Reports 1024](manager-batch-2-browser-20261023/reports-1024x768.png), and [Riders 360](manager-batch-2-browser-20261023/riders-360x800.png). The fixture mounted actual active Manager page components with synthetic read responses; these are not hosted authenticated screenshots.

Dashboard DOM assertions found the Batch 1 usable-stock warning and unchanged synthetic fulfilled-sales value **₱12,480.00** at all eight widths, without attention-card overlap. Requests showed its editable unsaved sheet and synthetic request history. Receiving rendered the synthetic draft `RR-20261012-000002` and posted `RR-20261012-000001` at 1024 with no page overflow; no posting action was invoked. Menu showed product/category rows, effective availability, a Fixed Meal Options entry point, and a Drink Choice. Riders supplied the active staff-like directory; there is no separate Staff Management destination in the active Manager navigation.

## G. Table usability and H. accessibility

At 1024 the Menu table wrapper measured **692 px client width** and **928 px scroll width**. Scripted scrolling reached **236 px inside the wrapper** while page pan remained zero. Its six headers and two row actions were retained, and a row button could receive focus. Stock Overview uses cards below `xl` and retains its seven-column desktop table inside an `overflow-x-auto` wrapper at `xl`; the table fit at the tested desktop width, so actual Stock Overview table scrolling was **NOT TESTED**. Active Stock Movements is a list, not the older wide transaction table targeted by stale CSS.

At 390 px, the closed mobile navigation was inert; opening it produced a dialog from x=0 to x=288 within the viewport, and closing it restored focus to its trigger. A synthetic Rider suspension confirmation dialog fit x=16 to x=374 and held focus. No suspension was submitted. Focusable table controls and normal vertical scrolling remained present. A true 200% browser-zoom sequence, reduced-motion preference, complete Tab order, and screen-reader announcement were **NOT TESTED**; the 320–430 px reflow checks are separate evidence.

## I. Regression testing

| Command/check | Final outcome |
|---|---|
| `node scripts/verify-manager-batch-2.mjs` | **PASS**: 45 renders across 8 widths and 8 active screens; drawer/dialog, internal scroll, Request history, draft/posted receipt, zero external requests, and GET/HEAD-only local requests. |
| `node --experimental-strip-types scripts/verify-manager-batch-1.mjs` | **PASS**, 17 calculation/invalid-response checks. |
| `node --experimental-strip-types scripts/verify-h22-inventory-overview.mjs` | **PASS**, 21 assertions. |
| `node scripts/verify-manager-shell-navigation.mjs` | **PASS**, 21/21 checks. |
| `node scripts/verify-manager-inventory-workspace.mjs` | **PASS**, 36/36 assertions and exit 0. Its short-lived Vite dependency scan logged a server-closing warning; the final assertions passed. [Log](manager-batch-2-browser-20261023/inventory-workspace-verifier.log). |
| `npm.cmd run typecheck` | **PASS**. |
| `npm.cmd run verify:quality` | **PASS**, 11 checks. |
| `npm.cmd run build` | **PASS**, production bundle built in 8.28 seconds. |
| Scoped `git diff --check` | **PASS** (performed at closeout). |

Interim browser runs failed on fixture assertions for an inactive Stock Movements table and a selector that chose the closed navigation drawer instead of the Rider alert dialog. The verifier was corrected to reflect the active list view and select the visible alert dialog. The final full browser run passed.

## J. Scope compliance and K. data safety

Production changes are limited to one class on the Manager desktop sidebar. The existing dirty working tree, Batch 1 code, Dashboard metrics, stock logic, financial calculations, Manager actions, and other modules were preserved. Browser requests were confined to the local fixture host and used only GET/HEAD. **No hosted inventory, orders, payments, receiving, staff, or other business records were read or changed by this batch.** No migration or backend change was made.

## L. Remaining issues and M. final status

**COMPLETE** for the authorized local Batch 2 scope. Authenticated hosted Manager rendering and true browser zoom/accessibility technology acceptance remain untested. Those limits do not change the directly measured local correction of the 80 px defect.

**Next recommendation:** Resolve the roadmap's MGR-01 ordinary product/category administration policy with the restaurant before implementing any new Manager Menu authority. Do not begin that work under Batch 2.
