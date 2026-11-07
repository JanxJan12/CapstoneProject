# Track A authenticated disposable-local integration, 26 October 2026

**Result: PASS for the bounded Manager request → linked Receiving → accepted-only post journey.** The malformed proposal response was rejected at the shared API boundary. **Full clean migration replay: BLOCKED.** This run made no hosted access or writes and did not change canonical migrations or existing business modules.

## Boundary and method

Fresh unlinked Supabase runtime `.tmp/track-a-auth-20261026-targeted/`, API `http://127.0.0.1:64521`, 54 local migration entries. The fixture uses the previously established synthetic defense base (51 source-era migrations, one explicitly synthetic historical prerequisite, and two private compatibility variants), then applies current `20261018204755_remove_inventory_request_reason.sql` and `20261023113221_manager_receiving_verified_inspector.sql`. It is a targeted functional fixture, **not** a faithful replay or production clone. One synthetic inventory item began at zero, with no prior batches or movements. An actual local GoTrue password session with active Manager profile called all business RPCs through PostgREST; privileged SQL and Auth admin calls were limited to synthetic fixture setup and evidence reads. A second local Manager session attempted the duplicate post.

The first private full-set bootstrap stopped at `20261021120000_restore_closed_cashier_shifts_rpc.sql` because `get_closed_cashier_shifts` already existed after `20261014191853_h08c_historical_shift_access.sql`. A second private attempt omitting that duplicate stopped at `20261021190000_drink_choices_transition.sql` because its hosted-specific seven-option catalog check did not match the synthetic base. Both failed private runtimes and the canonical source files were preserved. The 54-entry targeted runtime omits those unrelated later migrations; only the request reason removal and verified-inspector update were added to the established base.

## Single request and measured SQL state

Request `PR-20261026-000001` (`237fbc20-8a13-43c2-8cbc-d90fd5e75730`) requested 4 synthetic pieces. Linked Receiving `RR-20261026-EE1C9EC4` (`ee1c9ec4-6089-4638-8e3f-6270945b8690`) recorded 3 delivered, 2 accepted, 1 rejected with a reason. The authenticated Receiving workspace reopened that draft. The table shows SQL counts and sums scoped to this item, request, and report; the raw stage snapshots are in [TRACK-A-AUTH-LOCAL-20261026.json](./TRACK-A-AUTH-LOCAL-20261026.json).

| Stage | Request docs / lines | Receiving reports / lines | Aggregate on hand | Batch rows / on hand | Ledger rows / quantity |
| --- | ---: | ---: | ---: | ---: | ---: |
| Before | 0 / 0 | 0 / 0 | 0 | 0 / 0 | 0 / 0 |
| Issued | 1 / 1 | 0 / 0 | 0 | 0 / 0 | 0 / 0 |
| Linked draft saved | 1 / 1 | 1 / 1 | 0 | 0 / 0 | 0 / 0 |
| Posted once | 1 / 1 | 1 / 1 | 2 | 1 / 2 | 1 / +2 |
| Duplicate rejected | 1 / 1 | 1 / 1 | 2 | 1 / 2 | 1 / +2 |

**PASS:** Net posting delta was `+2` aggregate, `+1` batch row holding 2, and `+1` receiving transaction of `+2`; rejected quantity added zero. The ledger's `inventory_batch_id` points to the batch whose `receiving_report_item_id` is the saved line, and its reason names the Receiving number. Report status is `posted`; request status is `partially_received`. The duplicate authenticated call returned HTTP 400 / SQLSTATE `22023` (`Receiving report is already posted.`); a subsequent SQL snapshot exactly matched the first-post snapshot. No second business request was issued.

**PASS:** `node scripts/verify-request-proposal-contract.mjs` exercised a malformed RPC response through `getRequestProposal` and observed rejection before any Manager view could consume it. This is a mocked malformed response at the actual shared application boundary; the local server's normal proposal was valid. `node scripts/verify-h23-request-workflow.mjs` passed 40 checks, `verify-receiving-posting.mjs` passed 42/42, `verify-receiving-draft-authoring.mjs` passed 65/65, and `npm.cmd run typecheck` passed.

**Limitation:** This establishes the current request/Receiving RPC path against a genuine local Manager Auth session and targeted disposable schema. It does not establish hosted authenticated behavior, a clean replay of all current migrations, a browser workflow, or real restaurant stock acceptance. The initial verifier reached the successful first post, then failed because its evidence query assumed a nonexistent `inventory_transactions.receiving_report_id` column. The query was corrected to prove linkage through the batch and reason; verification resumed against that same posted record, and no replacement request was created. Reusable scripts are [verify-track-a-auth-local.mjs](../scripts/fixtures/verify-track-a-auth-local.mjs) and [finish-track-a-auth-local.mjs](../scripts/fixtures/finish-track-a-auth-local.mjs).
