# Manager Inventory authenticated browser E2E — 2026-10-13 (Manila)

**PASS — one connected local Manager browser workflow.** The canonical React Manager route used a real GoTrue session, same-database PostgREST/RPC, and persisted synthetic test stock. One explicit Issue created one request. One explicit Post created two accepted-stock movements linked to one receipt. **PARTIAL — requested mobile screenshots of the original unsaved editor, pre-issue review, and Receiving draft/review were not captured before those states were finalized; connected error-state and Google OAuth UI were not exercised.** Staging and production remain **NO-GO**.

## Auth and isolation

- Browser authenticated: **YES**. A QA-only page used `supabase.auth.signInWithPassword` against disposable local GoTrue. The unchanged application `AuthProvider` restored that Supabase session, read the active Manager profile from the same database, and opened `/manager`. The production staff sign-in button is Google OAuth only; its OAuth flow was **NOT TESTED** offline. This local test page is not a production auth bypass and was not added to the app routes.
- The canonical `.env.local` was neither edited nor loaded by the test Vite configuration (`envDir: false`). Browser API URL was `http://127.0.0.1:58421`; Vite was bound to `127.0.0.1:58420`; the test publishable value was local and client-safe. A QA-only gateway forwarded browser Auth/REST calls into three disposable containers on an internal Docker network with no published ports. Remote font import was suppressed only in the local Vite config, so screenshots use system font fallback.
- The same schema/ACL snapshot and additive request migration as the prior successful API E2E were used: snapshot SHA-256 `514ED9B0B61C7736F92905C2845A2EFF794AE4F3B3E050C39A46C41FDF8D473B`; migration SHA-256 `FEC604AA63AC3B2B55703118DFAC8858E921BC7AB1673872D15CBC4F446DE969`. The local Auth marker/ownership adapter was disposable. This is neither historical clean replay nor hosted parity.
- Two `.invalid` synthetic items had opening batches of Paa 20 pcs and Wing 5 pcs, with minimums 30 and 12. No real account, client count, production stock, Storage, Messenger, cloud service, image pull, npm install, or linked Supabase CLI was used.

## Browser journey and persisted proof

| Step | Observed result |
| --- | --- |
| Stock Monitor | Paa physical/usable 20/20 pcs, minimum 30, pending 0, new gap 10; Wing 5/5 pcs, minimum 12, pending 0, new gap 7. Pending requests were labeled not on hand. |
| Contextual Prepare Request | Paa row action opened the real Requests screen with an **unsaved two-item** sheet prefilled at 10 and 7. Quantities were edited to **11 and 8**, each with an override reason. Priority changed to Priority, requested delivery to Oct 16, 2026 at 2:00 PM Manila, and a reason was entered. Suggestions were refreshed for the changed time. |
| Review / Back / Review | Formal document said **DRAFT · NOT ISSUED** and showed both edited lines. Back-to-Edit retained quantities, priority, date, reason, and overrides; focus reached the review heading. Before Issue: **0 issue calls, 0 request rows, 0 receipt rows**. |
| Explicit Issue | One click created `PR-20261013-000001` Rev 1, request ID `c6fc89b6-8e61-4215-a1f8-4c9df66cd927`. The browser captured a CORS preflight plus the issue request; **one issue event and one request row** persisted. Stock did not change. The issued document, history, Text and PNG downloads worked. Print/PDF was not invoked. No Messenger message was sent or manually attested; `Send Not Recorded` remained visible. |
| Linked Receiving | From that issued request, the Manager named **Synthetic Local Inspector (separate from Manager)** and opened `RR-20261013-CE5412AA`, receipt ID `ce5412aa-960b-465a-8bc2-0278c5c38afc`. Physical delivered/accepted inputs initially appeared blank. Paa delivered 11, accepted 10, rejected 1; Wing delivered 8, accepted 7, rejected 1. Each line had a local lot and future expiry. Draft stock stayed 20/5 and receiving movement count stayed 0. |
| Review and Post | The browser review showed accepted-only deltas **+10 Paa, +7 Wing** and rejected 1 each. Exactly **one POST** to `post_receiving_report` was observed. Receipt became posted and read only, including after reload; the Post control was absent on reopening. No second browser post call occurred. The earlier [authenticated API/RPC report](MAIN-MANAGER-AUTHENTICATED-E2E-20261012.md) separately proved duplicate-post denial and Cashier issue/post/elevation denials. |
| Reconciliation / Stock / Movements | Paa physical/usable **20/20 → 30/30**; Wing **5/5 → 12/12**. Request is correctly **partially received**: requested 11/8, accepted 10/7, rejected 1/1, outstanding 1/1. New movement IDs `e68fd0c0-68b8-4f59-98a4-756484cee9e8` (+10) and `38f7d937-427a-4f81-90ef-94f139a51d3f` (+7) both join through their batches to this same receipt. Stock Movements displayed both receipt references and balances. |

The sanitized [database evidence](manager-authenticated-browser-20261012/db-evidence.json) records the final IDs, deltas, and event counts. Opening-balance movements predate the receipt and were excluded from its two new movements.

## Browser images and UX checks

All paths below are under `qa/manager-authenticated-browser-20261012/` and are real React renders backed by this local database.

| Screen | Desktop | Pixel 8 Pro size, 412×915 |
| --- | --- | --- |
| Stock before issue | `desktop-stock.png` | Not captured before issue |
| Unsaved editor / pre-issue review | `desktop-editor.png`, `desktop-preview.png` | Not captured before issue |
| Issued document | `desktop-issued.png` | `mobile-issued-document.png` (same persisted issued revision after posting) |
| Linked Receiving draft / accepted-only review | `desktop-receiving-draft.png`, `desktop-receiving-review.png` | Not captured before posting |
| Posted report / reconciliation | `desktop-posted.png`, `desktop-reconciliation.png` | `mobile-posted-report.png`, `mobile-reconciliation-detail.png` |
| Stock / Movements after post | `desktop-stock-after.png`, `desktop-movements.png` | `mobile-stock-after.png`, `mobile-movement-rows.png` |

- **PASS:** Desktop body width stayed 1440px with main scroll width equal to its client width. On the four measured mobile post-issue screens, body and root width were 412px, main had no horizontal overflow, and no visible button measured below 44px in either dimension. The prior desktop `documentElement.scrollWidth` anomaly remains 1520px at a 1440px viewport; body and main did not overflow. No global CSS fix was introduced.
- **PASS:** The saved browser post and verification traces had zero non-loopback HTTP requests, zero console errors, and zero uncaught exceptions. The pre-issue safety check also rejected any non-loopback request before mutation. Chrome blocked external host resolution throughout. No hosted traffic was observed.
- **PARTIAL:** The connected browser showed the real post-issue empty suggestion state. A connected failure/retry error state and mobile captures of the original editor, preview, draft, and review were not run. Existing synthetic visual QA covers those states separately and is not counted as authenticated browser evidence.

## Verification, changes, and cleanup

- **PASS:** `npm.cmd run typecheck`; Vite production build with the local-only QA config to a temporary output directory (3,015 modules transformed). No application source or migration was edited. New files are this report and the QA-only runner, evidence JSON, exports, and screenshots under `qa/manager-authenticated-browser-20261012/`.
- **PASS:** Only the three `rrj_manager_browser_20261012_*` containers, their internal network, and their dedicated volume were removed. The original **22** running containers remained running. Vite and the local gateway were stopped. The synthetic database and its Auth users no longer exist.
- **PARTIAL cleanup:** Automatic approval review rejected recursive removal of the new temporary browser workspace and then rejected removal of its individual credential files. The rejected target was `C:\Users\Janmari\AppData\Local\Temp\rrj-manager-browser-20261012`. No alternative deletion method was attempted. Synthetic local passwords/JWTs may remain there, but the only database/Auth service and volume that accepted them were removed. Previously cleanup-blocked QA Chrome profiles were not touched.

Physical-device behavior, Google OAuth, local Storage, historical clean migration replay, staging parity, production deployment, and real opening counts remain outside this test. Staging and production remain **NO-GO** pending their separate approval, Storage/replay/parity gates, and Ralph's business signoff.
