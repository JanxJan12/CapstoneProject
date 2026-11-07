# H-16 master acceptance matrix — 2026-10-16 Manila

**Live H-09 continuation, 2026-10-16 11:20–11:23 Manila:** The existing `rrj_h09_order_flow_20261015` stack at `127.0.0.1:48321` was identified by project labels, workdir, port and DB volume; Auth/REST responded HTTP 200. An existing synthetic Manager account authenticated. Ten rows below were executed through Manager RPCs and independently checked with SQL against the same preserved local database. Evidence is [H16-LIVE-ACCEPTANCE-20261016.json](H16-LIVE-ACCEPTANCE-20261016.json). `PR-20261016-000001` / `RR-20261016-B6B1E3F1` are this run's isolated synthetic fixtures. No browser screenshot was taken. After posting, the Docker VM had about 726 MiB available and only 165 MiB swap free; Windows had about 707 MiB free physical memory. The rendered browser and multi-session campaign was deferred to avoid adding a Vite/Chrome load. The earlier 07:01 P0 resource gate and Docker outage are historical, not this run's outcome.

| Scenario | Expected behavior | Execution | Evidence | Status |
| --- | --- | --- | --- | --- |
| A1 Multi-item issue | Two server-validated lines and numbered request; stock unchanged | Manager RPC + SQL | H16 live JSON; PR-20261016-000001, two lines, unchanged items/batches/ledger | PASS |
| A2 Revision | New revision and preserved historical snapshot | Not run | No current scenario evidence | NOT_RUN |
| A3 Dispatch attestation | Event persists without claiming supplier delivery or changing stock | Manager RPC + SQL | H16 live JSON; one synthetic dispatch event, unchanged stock | PASS |
| A4 Failed register read | Stale actions unavailable; Try again restores current register | Not run | No current scenario evidence | NOT_RUN |
| A5 Out-of-order register reads | Older response cannot replace newer data | Not run | No current scenario evidence | NOT_RUN |
| B1 Linked draft | Request/report/line link; no stock change | Manager RPC + SQL | H16 live JSON; RR-20261016-B6B1E3F1 linked to request, draft stock unchanged | PASS |
| B2 Partial acceptance | Delivered, accepted and rejected persist; rejected stock excluded | Manager RPC + SQL | H16 live JSON; delivered 3, accepted 1, rejected 2, draft stock unchanged | PASS |
| B3 Posted receipt | Accepted quantity creates exact item/batch/ledger change | Manager RPC + SQL | H16 live JSON; chicken +1, one batch and one ledger movement; Beef +0 | PASS |
| B4 Duplicate post | No second stock, batch or ledger effect | Manager RPC + SQL | H16 live JSON; HTTP 400 already posted, snapshot unchanged | PASS |
| B5 Concurrent post | One authoritative winner and one stock effect | Not run | No current scenario evidence | NOT_RUN |
| B6 Failed workspace read | Stale post controls close; selected-ID retry restores report | Not run | No current scenario evidence | NOT_RUN |
| B7 Superseded workspace read | Older report response cannot replace latest selection | Not run | No current scenario evidence | NOT_RUN |
| C1 Physical and usable baseline | Summary and item detail reflect distinct authoritative grains | Manager read RPC + SQL | H16 live JSON; summary/detail physical, usable and batch total matched SQL | PASS |
| C2 Batch suitability | Batch quantities and expiry rules explain usable stock | Manager read RPC + SQL | H16 live JSON; new chicken batch current, 1 unit, derived use-by checked | PASS |
| C3 Receiving reconciliation | Final item balance equals baseline plus posted accepted quantity | SQL before/after | H16 live JSON; chicken +1, Beef +0 | PASS |
| C4 Batch/ledger linkage | Accepted line maps to correct batch and movement identity | SQL before/after | H16 live JSON; exact receiving line, batch and movement UUIDs | PASS |
| C5 Cross-view stock consistency | Summary, detail, batches, movement RPC and SQL agree | Not run | No current scenario evidence | NOT_RUN |
| D1 Initial movements | Newest-first displayed ledger IDs match RPC/SQL | Not run | No current scenario evidence | NOT_RUN |
| D2 Rapid Load More | One page claim; no repeated displayed ID | Not run | No current scenario evidence | NOT_RUN |
| D3 Failed page/retry | Cursor unchanged on failure; retry returns correct page | Not run | No current scenario evidence | NOT_RUN |
| D4 Filter during page load | Old-filter response cannot append | Not run | No current scenario evidence | NOT_RUN |
| D5 Ledger identity | Displayed IDs match distinct database movement IDs | Not run | No current scenario evidence | NOT_RUN |
| E1 Manager positive adjustment | Exact authorized item/batch/ledger increase | Not run | No current scenario evidence | NOT_RUN |
| E2 Manager negative adjustment | Exact authorized nonnegative item/batch/ledger decrease | Not run | No current scenario evidence | NOT_RUN |
| E3 Waste | Exact authorized loss and reason/actor ledger record | Not run | No current scenario evidence | NOT_RUN |
| E4 Batch versus legacy path | Appropriate existing RPC and stock grain used | Not run | No current scenario evidence | NOT_RUN |
| E5 Invalid or insufficient quantity | Rejected without stock side effect | Not run | No current scenario evidence | NOT_RUN |
| E6 Duplicate/replay and role denial | No duplicate or unauthorized mutation | Not run | No current scenario evidence | NOT_RUN |
| F1 Synthetic order and server total | Authorized order uses server-calculated pricing | Not run | No current scenario evidence | NOT_RUN |
| F2 Payment/confirmation timing | Deduction occurs only at backend-authorized confirmation | Not run | No current scenario evidence | NOT_RUN |
| F3 Recipe batch/ledger | Exact server recipe quantity and traceable allocation | Not run | No current scenario evidence | NOT_RUN |
| F4 Confirmation replay | No second ingredient deduction | Not run | No current scenario evidence | NOT_RUN |
| F5 Insufficient/unrelated stock | Defined rejection; other ingredients unchanged | Not run | No current scenario evidence | NOT_RUN |
| G1 Historical Production access | Legitimate queue read; formal Manager queue isolated | Not run | No current scenario evidence | NOT_RUN |
| G2 Production conflict | Stale expected status rejected and latest state shown | Not run | No current scenario evidence | NOT_RUN |
| G3 Rapid advance | One status event for one accepted transition | Not run | No current scenario evidence | NOT_RUN |
| G4 Committed write/failed read | Truthful success plus unavailable queue and retry | Not run | No current scenario evidence | NOT_RUN |
| G5 Production stock boundary | Status change alone leaves stock unchanged; Receiving link correct | Not run | No current scenario evidence | NOT_RUN |
| H1 KDS credential gate | Valid terminal accepted; invalid secret denied | Not run | No current scenario evidence | NOT_RUN |
| H2 Kitchen progression | Authorized status transitions and events agree | Not run | No current scenario evidence | NOT_RUN |
| H3 Two-terminal conflict | Stale advance rejected without duplicate event | Not run | No current scenario evidence | NOT_RUN |
| H4 Older poll release | Old ticket cannot revive after newer result | Not run | No current scenario evidence | NOT_RUN |
| H5 Kitchen committed/failed read | Stale ticket cleared; retry matches database | Not run | No current scenario evidence | NOT_RUN |
| I1 Pending payment read | Authenticated Cashier queue matches backend | Not run | No current scenario evidence | NOT_RUN |
| I2 Verify payment | One verified payment, receipt, order transition and eligible deduction | Not run | No current scenario evidence | NOT_RUN |
| I3 Reject/resubmit | Supported rejection and new proof/state without duplicate receipt | Not run | No current scenario evidence | NOT_RUN |
| I4 Two-session payment conflict | Losing verify/reject denied; stale dialog and row removed | Not run | No current scenario evidence | NOT_RUN |
| I5 Failed Cashier refresh | Unavailable state and Retry restore latest payment | Not run | No current scenario evidence | NOT_RUN |
| I6 Payment/shift reconciliation | Collection, fulfilled sales and as-closed shift facts remain distinct | Not run | No current scenario evidence | NOT_RUN |
| J1 Rejected before write | UI and SQL show no committed side effect | Not run | No current scenario evidence | NOT_RUN |
| J2 Commit/lost response | Independent SQL proves commit before any safe retry | Not run | No current scenario evidence | NOT_RUN |
| J3 Commit/follow-up read failure | UI retains truthful success and clears stale data | Not run | No current scenario evidence | NOT_RUN |
| J4 Two-session race | One accepted side effect and exact event/ledger identity | Not run | No current scenario evidence | NOT_RUN |
| J5 Old read after new read | Old result cannot restore stale action | Not run | No current scenario evidence | NOT_RUN |
| S1 Authorized role paths | Manager/Production/Cashier/Customer/KDS permitted only as designed | Not run | No current scenario evidence | NOT_RUN |
| S2 Unauthorized/deactivated denial | Backend rejects role/account misuse without row change | Not run | No current scenario evidence | NOT_RUN |
| S3 Direct-table denial | Protected table mutation denied independently of hidden UI | Not run | No current scenario evidence | NOT_RUN |
| S4 RPC replay protection | Duplicate IDs/status replays cause no repeated effect | Not run | No current scenario evidence | NOT_RUN |
| S5 Stale-session authorization | Relevant revoked/inactive role cannot perform action | Not run | No current scenario evidence | NOT_RUN |

**Counts, denominator 59 planned runtime scenarios:** PASS 10; FAIL 0; BLOCKED 0; NOT_RUN 49. **Executed runtime scenarios: 10/59, all at authenticated local API/SQL level; rendered UI execution: 0/59.** The other rows were not executed and cannot inherit prior H-09/H-14 passes. The one rejected chicken line attempt used a use-by date contrary to the configured shelf-life rule; it left no row/stock change, and the same draft was completed using the policy-derived date. This was a test-input correction, not an application FAIL. Browser, concurrency, failure/retry, other role paths, hosted and device outcomes remain unproven.
