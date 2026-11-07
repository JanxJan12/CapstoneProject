# Manager workspace smoke test — 27 October 2026 (Asia/Manila)

## Verdict

**PASS for the tested local Manager path, with one reproducible error-state defect.** A real local GoTrue Manager session opened the active React `/manager` route, dashboard, Stock Overview, formal two-item Request editor/review/Issue/register, linked Receiving draft/review/post, and Stock Movements. The receipt posted **3 + 5 accepted units only**; rejected **1 + 2** stayed out of stock. The request remains partially received with **1 + 2** outstanding. This is a targeted local smoke result, **not hosted acceptance** or six-table release approval.

## Boundary and setup

- Canonical checkout: `C:\Users\Janmari\Downloads\Capstone Project`. Existing dirty source, QA reports, and `20261026232229_six_table_dependency_harmonization.sql` were not edited. Only this report, the checkpoint, and screenshots under `qa/manager-workspace-smoke-20261027/` are deliverables.
- Browser: Codex in-app browser at `http://127.0.0.1:5173`, narrow viewport. The served `src/lib/supabase.ts` was checked to contain **only** `http://127.0.0.1:64521` as its Supabase URL, not the hosted project URL. Vite ran with `.env.local` loading disabled. The local stack was the already running `rrj_track_a_targeted_20261026` fixture: **34 public tables, 55 local migration entries** at test time. It is not the hosted 36-table schema or the local 30-table retirement clone.
- One new `@example.invalid` Auth user with active Manager profile and two `__MANAGER_SMOKE_*` inventory items were created in that loopback fixture. The initial profile intentionally lacked a first/last name by setup omission; these fields were filled after the observed Receiving error. No live account, business record, hosted migration ledger, hosted schema, or hosted Auth/Storage state was changed.
- Test references: request `PR-20261027-000005` (`422dcadc-d975-41c3-b545-f06498b1a143`); receipt `RR-20261027-3EFC8A14` (`3efc8a14-8460-49d5-8f88-a4b94c7a22c4`). These are local synthetic records, retained with their immutable audit and ledger links in the disposable fixture.
- Temporary setup files and the local password file were removed after the run. The authenticated narrow browser tab and loopback Vite server were left open so the tested Manager dashboard can be inspected. The synthetic local account/records remain only in the existing disposable stack.

## Result ledger

| Route or check | Result | Fresh observation |
| --- | --- | --- |
| Manager sign-in and role | **PASS local** | QA-only same-origin page called local GoTrue password sign-in; unchanged AuthProvider loaded the active Manager profile and `/manager`. Account menu said `Manager`. Direct `/cashier` navigation redirected through unauthorized to the signed-in Manager dashboard. Production Google OAuth was **NOT RUN**. |
| Dashboard and navigation | **PASS local** | Dashboard loaded queue counts and quick links. `Open Stock Monitor`, Inventory Requests, Receiving, and sidebar navigation opened their mounted views. No orders existed in this fixture. |
| Stock Overview | **PASS local** | Initial synthetic items showed physical/usable `0/0`, minima `4/7`; recent receipts and movements loaded. After posting they showed `3/3` and `5/5`, with the new receipt and both movements in Recent activity. Counts changed from 18 usable-out/3 low-usable to 16/5. |
| Formal Prepare and review | **PASS local** | Contextual Prepare Request opened an unsaved sheet. Entered positive quantities `4` and `7`; zero-quantity suggestions stayed excluded. Review displayed two lines with matching suggested gaps and `DRAFT · NOT ISSUED`. |
| Issue and request register | **PASS local** | One Issue created `PR-20261027-000005` Rev 1; UI stated stock did not change. Register listed it as Issued. After receipt it became `partially_received` in the local database. Register search/filter/export and revision were **NOT RUN**. |
| Linked Receiving draft and review | **PASS local after profile correction** | The new request appeared in Receiving Register. A draft held two saved inspection lines: delivered/accepted/rejected `4/3/1` and `7/5/2`, with rejection reasons and local lot codes. Before posting, direct local reads showed both item aggregates `0` and zero movements. Review displayed expected changes `+3` and `+5`. |
| Post and read-only receipt | **PASS local** | One UI Post returned `RR-20261027-3EFC8A14 posted successfully`, with two accepted batches and two movements; receipt reopened as `POSTED · read only`. Direct local reads found item aggregates `3.000/5.000`, one batch each totaling `3.000/5.000`, and one ledger movement each totaling `3.000/5.000`. Request/receipt each have two lines; request status `partially_received`, receipt status `posted`. Duplicate POST API call was **NOT RUN**; no second UI Post control was present. |
| Stock Movements | **PASS local** | Mounted `/manager?view=inv-transactions` loaded five movements, with the new `+5` and `+3` Receiving rows and their receipt reference at the top. Filtering and pagination were **NOT RUN**. |
| Loading and error states | **PASS loading; FAIL error consistency** | Dashboard/Stock/Requests/Receiving/Movements showed loading states then resolved. A nameless Manager profile caused `The server returned an invalid receiving actor name.` after Start Receiving; reload showed that a linked draft had nevertheless persisted. See issue below. General network-failure/retry state was **NOT RUN**. |
| Typecheck and build | **PASS** | `npm.cmd run typecheck` exited 0. `npm.cmd run build` exited 0 (3,039 modules transformed). These checks alone do not establish runtime acceptance. |
| Hosted Manager acceptance and six-table 30-table candidate UI | **NOT RUN** | No hosted browser sign-in, hosted write, or API runtime against the candidate clone. |

## Visible issue and reproduction

**P2 — Receiving can create a linked draft while telling the Manager it failed.** In this local fixture, create an active Manager profile whose `first_name` and `last_name` are empty, issue a formal request, then choose `Record Delivery` → `Start Receiving`. The UI displayed **“The server returned an invalid receiving actor name.”** Reloading `/manager?view=stock-receiving` showed the same request as **Draft in Progress**, with `RR-20261027-3EFC8A14` and `Resume Receiving`. After assigning the synthetic profile a name and reloading, the draft could be inspected and posted. The visible error did not tell the Manager that a draft had already been created, which could prompt a repeat attempt. This was an atypical synthetic profile; whether real Manager accounts can lack a name is **NOT VERIFIED**. The issue is the mismatch between persisted mutation and failure feedback, not evidence of a failed post.

Secondary UX observation: before the synthetic profile name was filled, the issued document showed **“Issued by Manager not recorded”** despite the authenticated user. That may be an expected fallback for incomplete profile data; no production-account conclusion is drawn.

No other visible layout or interaction defect was established in the narrow browser viewport. Desktop viewport, mobile device behavior, Google OAuth, offline/retry injection, and other Manager modules were **NOT RUN**.

## Screenshots

These are current React renders from the authenticated local browser, not static fixtures. The in-app browser used a narrow viewport; some captures reflect the current scroll position.

| State | Evidence |
| --- | --- |
| Dashboard | [dashboard.png](manager-workspace-smoke-20261027/dashboard.png) |
| Stock before and after | [stock-before.png](manager-workspace-smoke-20261027/stock-before.png), [stock-after.png](manager-workspace-smoke-20261027/stock-after.png) |
| Request editor, review, issued, register | [request-editor.png](manager-workspace-smoke-20261027/request-editor.png), [request-review.png](manager-workspace-smoke-20261027/request-review.png), [request-issued.png](manager-workspace-smoke-20261027/request-issued.png), [request-register.png](manager-workspace-smoke-20261027/request-register.png) |
| Receiving draft, review, confirmation, posted | [receiving-draft-empty.png](manager-workspace-smoke-20261027/receiving-draft-empty.png), [receiving-draft-saved.png](manager-workspace-smoke-20261027/receiving-draft-saved.png), [receiving-review.png](manager-workspace-smoke-20261027/receiving-review.png), [receiving-post-confirm.png](manager-workspace-smoke-20261027/receiving-post-confirm.png), [receiving-posted.png](manager-workspace-smoke-20261027/receiving-posted.png) |
| Movements | [movements.png](manager-workspace-smoke-20261027/movements.png) |

## Next priority

Fix or explicitly handle the **persisted draft after actor-name parse error** in a focused Manager Receiving change, then rerun that case with an incomplete local profile. Keep hosted data and the six-table candidate untouched. A separate authenticated hosted acceptance and a faithful candidate-stack integration run remain outside this smoke test.
