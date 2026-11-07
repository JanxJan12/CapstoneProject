# MGR-REC-02B — Server-verified Manager inspector (23 October 2026)

## Disposition

**PARTIAL — local source and targeted contract accepted; hosted activation is not ready.** The owner confirms that the Manager who starts linked Receiving personally inspects that delivery. The two manual start fields are removed, and a local migration makes the existing five-argument RPC write the authenticated active Manager's profile UUID as the physical-inspector identifier. This avoids trusting a browser name or the Manager's self-editable profile names. No migration or frontend was deployed; the new local frontend requires this migration before it can start a hosted linked draft.

## Starting contract and minimum design

The pre-existing dirty worktree included untracked MGR-REC-01 Receiving components, API, migration, and tests. Nothing was reset or overwritten. The active `AwaitingProductionDelivery` queue and the posted receipt's next-delivery action both called `startInventoryRequestReceiving`; other source types have separate draft paths. The original `start_inventory_request_receiving(uuid,integer,uuid,text,text)` checked an active Manager via `inventory_request_manager_required()` and stored `auth.uid()` in `received_by`, but trusted the caller's nonblank inspector text. Its note was optional. The profile `first_name` and `last_name` are writable by the account holder, so they are not a verified inspector identifier.

`20261023113221_manager_receiving_verified_inspector.sql` uses `CREATE OR REPLACE FUNCTION` with the **same name, five argument types, result, SECURITY DEFINER setting, and empty search path**. It keeps current request/revision checks, locking, report-ID idempotency, event insertion, and the one-open-draft index. It ignores the legacy inspector argument and writes the authorized Manager profile UUID to `inspected_by_name` and the delivery-started event; `received_by` remains that authenticated UUID in its separate audit field. It accepts a null note. Older five-argument callers resolve to the same function and cannot nominate another inspector; their supplied note remains supported. Existing drafts returned by report-ID reuse are not rewritten, and historical rows are untouched. Existing authenticated/service-role EXECUTE is retained; PUBLIC/anon EXECUTE is revoked. The field now shows an account ID for new linked receipts, which is less readable than a human name but remains traceable through the profile and cannot be changed by editing display text.

`AwaitingProductionDelivery` now shows `Record delivery` → `Start Receiving`, with a personal-inspection instruction and no inspector or general note inputs. An existing draft offers `Resume Receiving`. The follow-up linked delivery action in `StockReceivingPage` uses the same three-argument frontend wrapper and also removes those two inputs. The wrapper sends nulls for the legacy RPC parameters; the server supplies the inspector. Supplier/Emergency draft entry, item rejection reasons, batch/expiry inputs, actual quantities, posting, issuance, and export code were not changed.

## Files changed for this assignment

| File | Change |
| --- | --- |
| `supabase/migrations/20261023113221_manager_receiving_verified_inspector.sql` | Local-only replacement of the linked draft RPC; SHA-256 `23D7F72D20C9D3B9C5791078EE56C17C8D458930EE7027164D49B0C582C8D776`. |
| `src/modules/manager/inventory/inventoryRequestApi.ts` | Send no inspector/note text; retain exact deployed RPC argument names. |
| `src/modules/manager/inventory/AwaitingProductionDelivery.tsx` | Remove inputs/state and use Start/Resume Receiving. |
| `src/modules/manager/inventory/StockReceivingPage.tsx` | Apply the same rule to next linked delivery; preserve other Receiving sources. |
| `scripts/fixtures/visual-manager-mocks.ts`, `scripts/verify-mgr-rec-02b-browser.mjs` | Update the local-only rendered fixture and add a separate 02B verifier. |
| `supabase/tests/mgr_rec_02b_fixture_supplement.sql`, `supabase/tests/verify_mgr_rec_02b_disposable.sql` | Focused synthetic schema/JWT-claim fixture and actual RPC checks. |
| `qa/mgr-rec-02b-rendered-20261023/` | Desktop/mobile screenshots and machine result. |

## Verification

| Check | Result | Evidence and limit |
| --- | --- | --- |
| Exact migration replacement | **PASS** | Original RPC definition extracted verbatim from the October 12 migration into a fresh targeted fixture; new migration applied. Function OID stayed `17602`, `prosecdef=t`, five-argument signature unchanged, authenticated EXECUTE true, anon EXECUTE false. |
| Inspector/creator and note | **PASS, targeted disposable SQL** | Two synthetic active Manager JWT claims created different linked drafts. Each stored its own profile UUID in `inspected_by_name`, `received_by`, and event actor/details. A forged legacy inspector argument was ignored; null note stayed null. Missing/non-Manager claims (Cashier, Rider, unauthenticated) were denied. One call was also executed with database role `authenticated`. |
| Draft start/resume and duplicate | **PASS, targeted SQL + synthetic browser** | Correct request/revision, same report-ID resume without changing original inspector/note, one-open-draft unique denial, no aggregate stock change. Browser start sent only request ID/revision/report ID, and resume sent no new start call. |
| Historical inspector | **PASS, targeted SQL** | A synthetic posted row with `Legacy Staff Inspector` and `RR-LEGACY-SYN` was unchanged after the exact migration was reapplied. No real historical row was touched. |
| Rendered UI | **PASS, synthetic fixture** | `node scripts/verify-mgr-rec-02b-browser.mjs`: 1280 px and 390 px queue, no linked entry inputs, Start/Resume behavior, request refresh/error, no auto-draft, no horizontal overflow, browser exception, external request, or network write. See [desktop start](mgr-rec-02b-rendered-20261023/receiving-start-entry.png), [mobile](mgr-rec-02b-rendered-20261023/receiving-390.png), and [result](mgr-rec-02b-rendered-20261023/result.json). Browser RPCs were mocks; identity proof comes only from SQL. |
| TypeScript and build | **PASS** | `npm.cmd run typecheck`; `npm.cmd run build` (3,039 modules transformed). |
| Partial delivery, rejection, duplicate post, stock movement | **NOT RETESTED under 02B migration** | The MGR-REC-01 targeted PostgreSQL suite previously passed 2 delivered / 1 accepted / 1 rejected, +1 stock, 1 outstanding, and duplicate-post denial. The 02B migration changes only draft creation, not posting. The 02B fixture does not install the real posting RPC or full batch/ledger schema, so it cannot establish a new end-to-end posting pass. |
| Full migration chain / hosted parity | **NOT TESTED** | An attempted broader disposable replay from the August remote schema stopped at `20260923000000_inventory_po_semantics_foundation.sql`: its prerequisite expected exactly one Chicken/kg inventory row. No quantity or master record was invented; no unrelated migration history was repaired. The passing fixture is a targeted contract fixture, not a faithful hosted-schema replay or real GoTrue/PostgREST session. |

The focused SQL test rolled back its rows; the fixture had zero linked receipt rows afterward. `git diff --check` on the modified Receiving page found no new whitespace error. A global check reported pre-existing whitespace in unrelated files and CRLF warnings; no unrelated source was edited to address those.

The first Vite fixture dependency scan failed because a separate Rider dialog imported `setManagerRiderApprovalStatus`, which the existing visual mock had not exported. A read-only throwing stub was added to the visual mock; the subsequent rendered check passed. No Rider production code was changed.

## Release and acceptance

The new local UI **must not be activated against the old hosted RPC**: hosted currently rejects the null inspector argument. Deployment requires separate explicit approval for the exact migration, a read-only hosted preflight of the function signature/grants/profile ID mapping, a coordinated migration/frontend cutover, and focused postdeployment checks. No hosted SQL, business data, migration history, or deployment was changed in this task. The simplified local entry is ready for isolated Manager review; full operational acceptance remains partial until the reviewed migration is deployed and an authenticated integrated Receiving/posting check is performed safely.

| Required disposition | Result |
| --- | --- |
| MGR-REC-02B | **PARTIAL** |
| Manual Inspector Input Removed | **PASS** |
| Manual Condition Input Removed | **PASS** |
| Server-Verified Inspector Identity | **PASS in targeted disposable SQL** |
| Authenticated Manager Authorization | **PASS in targeted SQL/JWT-claim context** |
| Linked Draft Start/Resume | **PASS in targeted SQL and synthetic browser** |
| Historical Inspector Preservation | **PASS in synthetic migration check** |
| Partial Delivery and Rejection | **NOT TESTED under 02B** |
| Duplicate Prevention | **PASS for open drafts; posting not retested** |
| Stock Posting Integrity | **NOT TESTED under 02B** |
| Desktop/Mobile Rendering | **PASS in synthetic browser** |
| Focused Tests | **PASS for tests run** |
| TypeScript | **PASS** |
| Production Build | **PASS** |
| Hosted Business Data Modified | **NO** |
| Hosted Migrations Applied | **NONE** |
| Deployments | **NONE** |
