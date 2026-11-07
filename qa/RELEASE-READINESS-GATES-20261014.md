# Release readiness gates — 2026-10-14

**Overall: BLOCKED.** Technical clean-install reproducibility is not established; no hosted deployment or production GO is authorized.

| Gate | Status | Evidence and limit |
| --- | --- | --- |
| Current 51-file pristine chronological replay | **FAIL** | New disposable, unlinked stack failed at Phase 2A statement 0, SQLSTATE `23503`; all 51 copied SQL files hash-matched canonical source. See `MIGRATION-REPRODUCIBILITY-RESOLUTION-20261014.md`. |
| Read-only prerequisite gate | **PASS as a blocker detector** | `node scripts/check-clean-migration-prerequisites.mjs` exited 1 and reported `BLOCKED`; 10 menu and 12 inventory identities are absent before Phase 2A. It does not install schema. |
| Current web typecheck, build, 11 quality checks | **PASS** | `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run verify:quality` completed in this pass. |
| Prior preserved-stack Customer/Cashier/KDS/Rider and Manager/Production flows | **PASS previously; NOT RETESTED here** | Dated QA results record local API/browser/RLS/RPC/Storage proof. The preserved stack was not reset. None proves a fresh 51-file install. |
| Clean-stack current additive migrations, schema comparison, Auth/Storage and end-to-end flows | **NOT TESTED** | Replay stopped at historical Phase 2A. KDS v2, Customer modifiers, grants/MAINTAIN, Production policy and trigger cleanup were not reached on this fresh stack. |
| Rider unchanged source typecheck and 8 tests | **PASS previously; NOT RETESTED here** | Prior release report; no Rider source changes in this pass. |
| Hosted schema/data and behavior, real GCash settlement, physical Android camera, paper print, fresh OAuth, screen reader | **NOT TESTED** | Separate acceptance and explicit hosted approval required. Hosted project remained untouched. |

**Next decision:** the accountable data owner must supply or approve a dated, checksummed historical master-data baseline and recipe mapping provenance for the exact Phase 2A references, plus an opening-stock decision. Engineering can then implement a reviewed pre-Phase-2A bootstrap and later enum compatibility plan, replay on a new isolated stack, and rerun the full acceptance matrix. Keep historical migration bodies and production records immutable.

**Forward/rollback:** the only code added here is a read-only gate script; it can be removed without database rollback. The disposable failure did not reach new additive migrations and left no hosted change. Future hosted promotion and rollback require separate review and approval. Preserve the dirty canonical checkout, local proof objects, and existing test volumes.

## October 14 recovery-engineering continuation

**Release decision remains NO-GO.** The following new local evidence supplements, and does not erase, the clean-replay failure above. The source modification scope for this continuation is five new recovery JavaScript tools, one read-only catalog SQL script, and the three companion recovery/provenance reports; no migration SQL or application workflow was changed. The earlier sentence about "only code added" describes the earlier reproducibility pass.

| Acceptance area | Current status | Evidence and boundary |
| --- | --- | --- |
| Hosted 46 vs repository 51 reconciliation | **PASS for version/name identity; SQL equivalence NOT TESTED for all 46** | Live read-only ledger matches first 46 repository versions/names; five later local-only files and hashes are recorded in `DATABASE-REPRODUCIBILITY-RECOVERY-20261014.md`. |
| Phase 2A provenance/bootstrap gate | **BLOCKED** | New validator exits 1 with 10 menu and 12 inventory IDs absent before Phase 2A. No authoritative baseline or approved bootstrap is available. |
| Full untouched 51-file replay | **FAIL previously; NOT RETESTED today** | Fresh-stack replay already stopped at Phase 2A SQLSTATE 23503. No synthetic historical data was inserted to manufacture a pass. |
| PostgreSQL/Auth/private Storage synthetic restore | **PASS, narrow local scope** | Two newly named unlinked stacks; 1/1 Auth users, identities, linked rows and initial private object; all three buckets then reached 1/1 objects each with equal SHA-256 and anonymous denial. Password sign-in passed. 8,929 ms backup, 1,640 ms restore, plus 7,125 ms for bucket completion. |
| Full hosted recovery set and off-device copy | **BLOCKED** | No verified encrypted independent off-device set, no restore from such a copy, and no current full 30-byte-object comparison. |
| Customer ordering, modifiers, payment | **PASS previously on preserved local API for base order/payment; current modifier acceptance NOT TESTED** | Prior October 13 local E2E; fresh 51-file environment blocked before modifier migration. No current hosted or browser proof. |
| Cashier verification, rejection, POS, receipts | **PASS previously for local verification/receipt; rejection and full POS current run NOT TESTED** | Prior local same-database API evidence; no current full acceptance replay. |
| KDS terminal authorization/transitions | **PASS previously for local base KDS; KDS v2 current run NOT TESTED** | Prior terminal credential denial and state transitions; fresh stack never reached v2 migration. |
| Rider assignment/private delivery proof | **PASS previously for local API/Storage; current full run NOT TESTED** | Prior authenticated local assignment and private proof E2E; no current Android or hosted proof. |
| Manager request/Receiving/stock/ledger | **PASS previously for local same-database API/SQL; current full run NOT TESTED** | Prior accepted-only posting, duplicate/concurrent denial, batches and ledger; not a pristine 51-file replay. |
| RLS, permissions, idempotency | **PASS previously for selected local cases; complete current run NOT TESTED** | Live hosted read-only catalog: all 34 public tables have RLS; counts alone cannot prove every policy or RPC grant. |
| Auth/Storage restoration | **PASS narrow synthetic; full hosted parity NOT TESTED** | Local sign-in, FK, private anonymous denial and three synthetic object byte hashes passed; OAuth/configuration and 30 hosted files remain open. |
| Current web checks | **PASS** | `npm.cmd run typecheck`, `npm.cmd run verify:quality` (11 checks), and `npm.cmd run build` passed in this continuation. |

Before release: approve an authoritative historical baseline and bootstrap/compatibility plan; pass a full clean 51-file replay on a new stack; produce and independently verify an encrypted off-device database plus Auth/Storage plus all-object-byte recovery set; restore from that copy; pass the complete isolated workflow/security matrix and hosted/browser/device acceptance as applicable. Keep the hosted project read only until its separate recovery and change approval gates are satisfied.

## October 14 prerequisite and controlled deployment preparation

**Overall: NO-GO.** `RELEASE-PREREQUISITE-RESOLUTION-20261014.md`, `HOSTED-RECOVERY-APPROVAL-20261014.md`, and `CONTROLLED-DEPLOYMENT-RUNBOOK-20261014.md` define the private owner approvals, custody evidence, ordered five-migration checks, and stop/restore sequence. The read-only `scripts/recovery/check-release-preflight.mjs` pins the five source hashes and rejects absent/incomplete approval records. Even a future `REVIEW_REQUIRED` result would leave independent backup, replay, and acceptance gates open. These preparation artifacts do not change the prior 51-file replay failure, do not authorize hosted export, and do not establish production readiness.
