# H-26 controlled Manager UI/UX acceptance

**Date and scope:** 2026-10-16, canonical worktree, controlled local preflight and newly executed offline checks. No Manager page was rendered in H-26. H-16 remains **10 PASS / 0 FAIL / 49 NOT RUN**; H-26 results do not change that historical matrix.

## A. Executive summary

Rendered and authenticated Manager acceptance is **BLOCKED** by the current environment. There is no running local frontend or exposed browser tab, and the effective default Vite environment points to hosted Supabase. H-26 did not start a frontend against that target, access hosted resources, or create a database or Docker service. Consequently, visual, navigation, accessibility, and responsive outcomes are not claimed.

Fresh offline checks passed after one narrow repair to a source verifier. The H-24 verifier had required an exact single-line JSX attribute layout; H-25's formatting preserved the section and label but split its attributes over lines. The verifier now accepts whitespace between the same required attributes. No application component, style, route, API, or business logic was changed in H-26.

**Manager controlled-demo recommendation: NOT ASSESSED.** Static checks cannot establish that staff can use the rendered Manager workflow at the required viewports.

## B. Environment preflight

| Preflight item | Observation and boundary |
| --- | --- |
| Existing frontend | No Vite/app Node process and no Node-owned listening frontend port were found. The checked local ports, including 5173 and 5174, had no listener. No trustworthy local application URL was available. |
| Backend target | `.env.local` defines `VITE_SUPABASE_URL` with host `zhzluhqvysvsadwuugpa.supabase.co` over HTTPS. No `VITE_DEMO_MODE` was defined in that file or the checked process environment. `src/lib/supabase.ts` creates the client from `import.meta.env.VITE_SUPABASE_URL`; default `vite.config.ts` reads the normal environment unless `RRJ_DEFENSE_DEMO=1`. A default frontend launch would target hosted Supabase. No key or token was printed. |
| Local backend and authentication | No checked local Supabase/app port listener or reusable authenticated local Manager session was identified. Existing sessions could not be validated against a safe local backend. |
| Resources | Windows reported 4,588,660 KiB free of 16,493,360 KiB visible physical memory at preflight. Resource headroom alone did not clear the backend-safety gate. |
| Browser | Chrome 155.0.8059.80 and Edge 155.0.4283.45 are installed. The read-only Computer Use inventory returned no controllable app/browser session or tab. No browser was launched. |
| H-26-owned runtime | None. Offline check processes exited normally; no frontend, browser, backend, or Docker process was created for runtime testing. |

**Gate decision:** Do not start Vite or open the protected Manager UI while the effective frontend target is hosted and no isolated authenticated local session is available. No environment file was changed. Docker and hosted Supabase were left untouched.

## C. Baseline source state

Starting branch/status: `main...origin/main`. Starting HEAD: `9748bdef6d31a96282b88dc67f02724b8fd05819`. The worktree contained extensive pre-existing modified and untracked files, including the Manager shell, Inventory Overview, Receiving, styles, verification scripts, and QA reports. The relevant Manager diffs were inspected without reset, clean, stash, or restoration. Existing reports H-20 through H-25 were read; H-15B/C guards were considered through their current source verifier.

`src/modules/manager/index.tsx` still defines 15 menu destinations: Dashboard, Orders, Menu, Inventory Overview, Requests & Replenishment, Receiving, Stock Movements, Waste / Spoilage, Adjustments, Inventory Audit, Riders, Customers, Reports, Shift Audit, and Settings. Item Stock remains a drill-down. The active source paths include `InventoryPage.tsx`, `InventoryItemDetail.tsx`, `InventoryBatchList.tsx`, `ManagerRequestsPage.tsx`, `StockReceivingPage.tsx`, `InvTransactionsPage.tsx`, `StockMovementList.tsx`, `AdjustmentPage.tsx`, `AppShell.tsx`, and `theme.css`. Their mounted/contract claims below are source-review and verifier evidence, not live UI observations.

## D. Rendered UI test matrix

No viewport was executed. The actual observation for each protected screen is therefore the environment gate, not a screenshot or DOM assertion.

| ID | Page or workflow | Viewport | Preconditions | Expected result | Actual observation | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R01 | Inventory Overview / H-25 attention layout | 1440 × 900 desktop | Local authenticated Manager and safe backend | Scannable attention sources; working item/request/Receiving links | No safe local runtime or browser tab | **BLOCKED** | Environment preflight; no screenshot |
| R02 | Inventory Overview | 1280 × 800 laptop | Same | Stock panel, lists, and actions fit | Not rendered | **BLOCKED** | Same |
| R03 | Item Stock, batch guidance, movements | 768 × 1024 tablet | Safe Manager session and suitable existing item data | Distinct physical/usable totals, supported priority and exclusions | Not rendered; data edge cases unavailable | **BLOCKED** | Same |
| R04 | Requests and linked Receiving | 390 × 844 mobile | Safe Manager session and existing documents | Readable lifecycle and conditional post review | Not rendered; no read-only document inspection | **BLOCKED** | Same |
| R05 | Overview, tables, dialogs, mobile menu | 360 × 800 small mobile | Safe Manager session | No inaccessible control or unintended page overflow | Not rendered | **BLOCKED** | Same |
| R06 | All 15 Manager destinations, sidebar/top bar | Desktop and mobile | Safe authenticated Manager and browser | Each destination navigable, correct active/title state | Source verifier passed; browser navigation not executed | **BLOCKED** | H-24 offline result only |
| R07 | Keyboard, focus, labels, alerts, dialog Escape | Desktop and mobile | Rendered protected UI | Usable keyboard and semantic interactions | No UI interaction executed | **BLOCKED** | No screenshot or interaction log |
| R08 | Authenticated read-only stock/request/receipt projection | Local session | Verified isolated backend | Current records shown without writes | No safe session/backend | **BLOCKED** | Preflight |
| R09 | Database reconciliation and mutation outcomes | Isolated database | Separately authorized suitable environment | Server inventory and ledger contracts verified | Not executed under read-only H-26 | **NOT TESTED** | Scope boundary |
| R10 | Hosted and physical-device acceptance | Hosted/device | Separate authorization and device | Independent hosted/device proof | Not executed | **NOT TESTED** | Scope boundary |

No H-26 screenshot, video, trace, DOM capture, or browser console observation was created. `qa/evidence/H26/` was not created merely to imply coverage.

## E. Manager operational journey results

| Journey | Meaningful transitions measured | Result and context |
| --- | --- | --- |
| Overview attention → affected item → Item Stock | None | **BLOCKED**. Existing `onOpenItem` handoff and item-detail mount are source visible; destination clarity and preserved live context were not observed. |
| Item Stock → batch decision support | None | **BLOCKED**. H-21 helper passed offline; actual server order, mismatch display, and item switching were not exercised. |
| Overview → formal Requests | None | **BLOCKED**. Existing navigation callback is source visible; no browser task was performed. |
| Requests → linked Receiving document | None | **BLOCKED**. Existing report-ID handoff and H-23 assertions are source evidence only. No issue, dispatch, or post was performed. |
| Overview/Item Stock → Stock Movements | None | **BLOCKED**. Existing movement destination and H-15C pagination checks passed offline; a rendered list was not inspected. |

## F. Accessibility and responsiveness

Source review found the H-25 named attention sections, two-to-three-column stock quantity reflow, wrap-capable header actions, existing focus classes, and native action buttons. This establishes the presence of coded affordances only. Actual contrast, accessible names as announced, tab order, dialog focus/Escape behavior, table scrolling, touch targets, long text, and overflow are **BLOCKED** from rendered verification. No WCAG 2.2 AA compliance claim is made.

## G. Defect register

| ID | Classification / severity | Component and reproduction | Evidence and root cause | Resolution / remaining limit |
| --- | --- | --- | --- | --- |
| H26-01 | Source-confirmed verification defect / P2 | Run `node scripts/verify-h24-manager-navigation.mjs` on the H-25 source. | Initial **FAIL** expected `<section ref={stockResultsRef} aria-label="Stock and batches"` on one line. The mounted `section` still has the same ref and label on separate JSX lines after formatting. The regex tested whitespace layout as if it were behavior. | Verifier regex now allows whitespace between the two required attributes. Rerun **PASS**: 15 unique mounted destinations and 16 assertions. This is no rendered navigation proof. |
| H26-02 | Blocked prerequisite | Attempt a controlled Manager render preflight. | No safe local frontend/session; normal frontend target is hosted. | Runtime review withheld. Requires a separately suitable isolated local frontend/backend and authorized Manager session. |

No reproducible rendered visual, responsive, or accessibility defect was observed. No additional application source change is justified by the available evidence.

## H. Source correction

| File | Original behavior and confirmed problem | Correction, design reason, risk, verification |
| --- | --- | --- |
| `scripts/verify-h24-manager-navigation.mjs` | Exact single-line JSX regex failed after H-25 formatting although the labeled Stock section and scroll target remained. | Replaced the literal spaces with `\s+` around the same `ref` and `aria-label` tokens. This tolerates line breaks while retaining the original source guard. Risk is limited to a less formatting-sensitive source assertion; it still does not mount React. Initial failure and passing rerun were recorded. |
| `qa/H26-CONTROLLED-MANAGER-UIUX-ACCEPTANCE.md` | No H-26 record. | Adds preflight, matrix, finding, verification, and readiness decision without changing runtime code. |

No Manager application source, CSS, API, database contract, or business workflow changed in H-26.

## I. Business rules and preservation

H-26's code edit is confined to a verifier. Source and offline checks continue to assert H-21 batch guidance and mismatch guard, H-22 independent Overview reads, H-23 request/Receiving presentation and confirmed-post safeguard, H-24 menu continuity, and H-15B/C stale-register/pagination behavior. Formal issuance, recorded dispatch, drafts, and rejected quantities remain distinct from posted accepted stock in the existing source. Manager authorization, batch allocation, ledger, payment/order, and mutation code were not edited. These are preservation statements about source scope; no database invariant was independently tested in H-26.

## J. Verification results

| Category / command | Result | Evidence limit |
| --- | --- | --- |
| Offline TypeScript: `npm.cmd run typecheck` | **PASS** | Static compile only. |
| Offline quality: `npm.cmd run verify:quality` | **PASS** | 11 existing checks. |
| H-15B/C verifier | **PASS** | Nine stale-state and pagination checks. |
| H-21 batch verifier | **PASS** | Ten focused offline assertions. |
| H-22 Overview verifier | **PASS** | Ten offline classification assertions. |
| H-23 Requests/Receiving verifier | **PASS** | Fifteen offline/source assertions. |
| H-24 navigation verifier, initial run | **FAIL** | Formatting-sensitive regex after H-25. See H26-01. |
| H-24 navigation verifier, after narrow repair | **PASS** | 15 unique destinations and 16 source assertions; no browser route test. |
| Manager Inventory UI completion verifier | **PASS** | 19 source checks. |
| H-25 relevant source formatting: Prettier on `InventoryPage.tsx` | **PASS** | Formatting only; no layout rendering. |
| Changed-file whitespace check | **PASS** | No whitespace diagnostics for the untracked verifier and this report; Git's expected no-index difference exit code is not a test failure. |
| Rendered visual, browser navigation, accessibility interactions, authenticated local workflows | **BLOCKED** | Unsafe hosted default target and absent local session/browser. |
| Database correctness, hosted, physical device | **NOT TESTED** | Outside executed H-26 scope. |

The H-20 through H-25 report results are historical context. Only the commands listed above were newly executed for H-26.

## K. Resource safety

No Vite, browser, Docker, Supabase CLI, backend, or emulator process was started or stopped for H-26. The transient offline check processes exited. There were no H-26-owned runtime services requiring cleanup. Docker and hosted Supabase were not accessed.

## L. Remaining acceptance work

An isolated local frontend/backend with a verified Manager role and no hosted routing is required before executing the viewport matrix and five navigation journeys. That session should include existing safe records sufficient to view stock/batch guidance, formal requests, a Receiving draft/posted report, and movement history without business mutations. Then inspect desktop, laptop, tablet, and mobile layouts sequentially; capture minimal redacted visual evidence; test keyboard, screen reader, long text, empty/error states, and current-page reselection. A real Receiving post, database reconciliation, hosted parity, and physical-device proof remain separate authorizations/evidence scopes.

## M. Final recommendation

**NOT ASSESSED for controlled Capstone demonstration.** No rendered authenticated Manager journey ran in H-26. The offline checks support source continuity after the verifier repair, but cannot establish visual usability or demo readiness. This is not a production deployment decision.
