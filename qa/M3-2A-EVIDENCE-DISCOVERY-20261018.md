# M3.2A historical evidence and recovery discovery — 2026-10-18 (Asia/Manila)

**Decision: PARTIAL EVIDENCE — TARGETED FOLLOW-UP REQUIRED. Hosted M3 deployment remains NO-GO; Stage 4 remains paused.** This was a read-only investigation except for writing this QA report. No database, backup, migration, protected object, Git state, or hosted setting was changed. A file's modification time and checksum identify current bytes, not the historical truth or owner approval of those bytes.

## A. Scope and search method

I checked the dirty canonical worktree before writing; all existing modified/untracked paths were left intact. I read the [M3.2 review](M3-RECEIVING-RELEASE-REVIEW-20261018.md), [controlled runbook](CONTROLLED-DEPLOYMENT-RUNBOOK-20261014.md), [historical approval contract](MASTER-DATA-PROVENANCE-APPROVAL-20261014.md), [recovery approval contract](HOSTED-RECOVERY-APPROVAL-20261014.md), preflight/validator source, current migration directory, QA recovery evidence, and selected test files. Scoped filename and exact-UUID searches covered the canonical repository (including relevant untracked files and `.tmp`), relevant RRJ folders under Downloads, and the explicitly recorded local backup roots. A top-level Documents search found no RRJ/Capstone-named project directory; unrelated personal folders, removable devices, cloud accounts, and the whole system drive were not searched. The M3.1 temporary schema file was inspected without deletion.

Git inspection used `git log`, `git ls-tree`, and `git show`; no historical commit was checked out. Supabase calls were read-only catalog/ledger SQL on `zhzluhqvysvsadwuugpa`. Existing local Docker databases were queried for catalog metadata only; none was started, stopped, restored, or mutated. The connected Supabase capability does not expose a protected backup-file or private Storage-byte inventory.

## B. Evidence requirements matrix

| Requirement | Source | Expected artifact | Verification method | Approval needed |
| --- | --- | --- | --- | --- |
| Phase 2A identities and recipes | `validate-provenance.mjs`; historical approval contract | Two private JSON baselines with all 10 menu/12 inventory UUIDs, one Chicken/kg row, Phase 2A and ordered 18-tuple digests | File SHA-256, exact ID/duplicate/unit checks, human source/quantity review | Accountable data owner; engineering reviewer for bootstrap SQL |
| Opening-stock decision | Validator and runbook | `approved-zero` or `approved-physical-record`, with `openingStockEvidenceId`; physical evidence for positive balance | Owner review of original count, units, batches/expiry and ledger reconciliation | Data/stock owner |
| Historical approval manifest | Validator | Private `schemaVersion:1`, `environment:"historical-bootstrap"`, `phase2aSha256`, two relative `files` records (`kind/path/sha256`), and `approval` (`approved/owner/approvedAt/sourceDescription/recipeTuplesSha256/openingStockDecision/openingStockEvidenceId`) | Validator returns at most `REVIEW_REQUIRED`; independently review source and signature | Data owner |
| Chronological migration provenance | Runbook, preflight, M3.2 review | Preserved original SQL identities, approved pre-Phase-2A bootstrap for a new environment, later enum compatibility decision, hosted applied-SQL evidence | Hashes, ledger comparison, pristine replay, catalog/behavior comparison | Project/release owner and engineering reviewer |
| Hosted recovery authorization | `check-release-preflight.mjs`; recovery approval contract | Private `schemaVersion:1`, `projectRef:"zhzluhqvysvsadwuugpa"`, `approved:true`, owner/date, restricted destination, independent off-device location, encryption/key custodian, private-byte route, restore environment, five true coverage flags | Validate fields; human signature, access/key-custody review | Project/recovery owner and security reviewer |
| Actual protected recovery | Runbook and recovery contract | Encrypted PostgreSQL roles/schema/data/Auth/Storage metadata/catalog/ledger, all private object bytes, independent copy, hashes and restore record | Verify copied archive and per-object bytes; isolated restore, Auth/RLS/ledger/data relationships | Separate export/rehearsal authorization and reviewer sign-off |
| Exact M3 release | M3.2 review and runbook | Two pinned October 13 files in order, excluded later migrations, operator/window/recovery plan | Fresh project, hash, ledger, owner/grant, regression and backup gates | Separate exact hosted deployment approval |

The current Phase 2A SHA-256 is `F06983ED7E9BA60F48654F8DF97F177FF8802A0C74297300B851B0226180A5D0`; the ordered recipe-tuple digest is `5d2551ee51d124346edc2bd884dce035f7234b9906f74b1385c9b9cbd8ba7677`. Neither checksum is an approval.

## C. What exists: candidate inventory and lineage

Times below are filesystem last-modified timestamps in Manila time. Hashes were recomputed in this investigation unless labeled as prior QA evidence. Private Storage object paths and record contents are intentionally omitted.

| Candidate (exact path) | Bytes; modified | SHA-256 | Classification and verification |
| --- | --- | --- | --- |
| `C:\Users\Janmari\Downloads\Capstone Project\supabase\migrations\20260904000000_inventory_phase_2a_recipe_deduction.sql` | 9,313; 2026-09-04 14:03 | `F06983ED7E9BA60F48654F8DF97F177FF8802A0C74297300B851B0226180A5D0` | Tracked historical SQL, introduced in Git commit `6ba695ba134e799abc3c502f6324d56a9f247aaa` (2026-09-10). Recipe references, not source master rows. |
| `C:\Users\Janmari\Downloads\rrjs_foodhouse_corrected_initial_schema.sql` | 23,634; 2026-07-20 00:15 | `46D81D6A03DBF326F6A655C1884946AD5443B24C5F558458E373B375ADD6A005` | Early schema design; contains no required 22 UUIDs. File date is not proof of a hosted snapshot. |
| `C:\Users\Janmari\Downloads\20260903180000_phase8_test_historical_master_data.sql` | 5,298; 2026-10-10 21:15 | `57D22174104C0DA33DF06E51CDE404BA9BF881500D83A95F5CF6AAEEA75F257D` | **Synthetic/test-only.** Contains all 22 UUIDs and zero opening inventory, but is explicitly a Phase 8 simulation migration, absent from canonical history; no data-owner provenance. Copies exist in Phase 8/RC and local `.tmp` stacks. |
| `C:\Users\Janmari\AppData\Local\Temp\rrj-m31-prefix-schema-20261018.sql` | 451,253; 2026-10-18 13:58 | `99D193C18DDE6C065E52960F456856FF205544E177B74F9805228B5946178E59` | PostgreSQL 17.11 schema-only diagnostic; `CREATE TABLE` present, no required UUIDs or menu/inventory `COPY` rows. Not a historical data backup. |
| `C:\Users\Janmari\AppData\Local\RRJ-Private-Backups\Supabase-20261013-062110\backup-manifest-v2.csv` | 6,866; 2026-10-13 07:32 | `E46B590ED584A19EC4714498D5B3C9597820DCC3B4B94134A233E723F3D7CDD1` | Later local hosted-export manifest: three database files, one managed Auth/Storage dump, 30 private Storage files. Rechecked **34/34** current size/hash entries; Storage matched by size/hash multiset, not by joining logical object paths to physical files. No owner approval or independent copy. |
| `C:\Users\Janmari\AppData\Local\RRJ-Private-Backups\Supabase-20261013-062110\roles.sql` | 1,327; 2026-10-13 06:21 | `427EA3CB24083D778BB59F8AEEAD481FD62ED216AD329E94198CC43914BAF444` | Local roles export; current hash matches manifest. |
| `C:\Users\Janmari\AppData\Local\RRJ-Private-Backups\Supabase-20261013-062110\schema.sql` | 538,815; 2026-10-13 06:21 | `F1022EB33031D3D62AE27A4E9564632BF2338BA019CCA834CDF95B42DAAF1A9B` | Local public schema export; current hash matches manifest. It has no migration-ledger SQL text. |
| `C:\Users\Janmari\AppData\Local\RRJ-Private-Backups\Supabase-20261013-062110\data.sql` | 188,003; 2026-10-13 06:22 | `9FD18E166AAEF422F5BF8B7B6178642B1D7D02E61148D984EC29A9B1EF65B114` | Later public-data export; 10 required IDs occur in the 20-row `menu_items` COPY and 12 in the 18-row `inventory_items` COPY. Embedded row timestamps say menu 2026-08-16 and inventory 2026-08-31; they are record claims, not independent pre-Phase-2A proof. Current stock quantities are not opening-stock evidence. No unrelated customer rows were examined. |
| `C:\Users\Janmari\AppData\Local\RRJ-Private-Backups\Supabase-20261013-062110\managed-auth-storage-data-retry.dump` | 31,493; 2026-10-13 07:31 | `AFCF6E4EDBF8379A00C8DA8EC9AB82EDE689585F452E0D3CAA0121D03EDFBD20` | `PGDMP` managed Auth/Storage data retry; current hash matches manifest. The earlier zero-byte `managed-auth-storage-data.dump` is invalid. |
| `C:\Users\Janmari\AppData\Local\RRJ-Private-Backups\RRJ-Recovery-20261013.7z` | 2,739,138; 2026-10-13 07:39 | `37A6CD5A11F17AFFC0A99D3EC5953D2DA1011C07F279A1BFD140FC5CC1852E50` | Existing local archive. Prior QA reports a 7-Zip password/encryption test, not repeated here. It predates the later recovery supplement; inclusion of supplement, independent off-device copy, current snapshot, key recovery, and restore **not verified**. |
| `C:\Users\Janmari\AppData\Local\RRJ-Private-Backups\rehearsal-20261013\recovery-supplement-manifest.csv` | 655; 2026-10-13 08:08 | `A298605C9282E4BF4DBCBA3C693A88C6DC5D12E1A68781E2C8CD021BA41AB4B7` | Six local Auth-trigger/Storage-policy/ACL/restore-support files; **6/6** current size/hash entries match. Stored separately after archive timestamp; not verified inside an encrypted independent copy. |
| `C:\Users\Janmari\Downloads\RRJ-Phase8-Simulation\backups\phase8c-pre-loopback-20261010-230755.dump` | 975,982; 2026-10-10 23:07 | `E17406B3EE3D5E7233FD2A4B80FA18E965A8B0E289DFE6E8E3298D053D56A8FC` | `PGDMP` custom archive; prior QA identifies local simulation data, not hosted recovery or approved historical stock. |
| `C:\Users\Janmari\Downloads\RRJ-Phase8-Simulation\backups\phase8d-pre-20261011-011233.dump` | 992,003; 2026-10-11 01:12 | `4486127C55D8C5939AE1C06A32B4495E2A66B9C330172BDA5589AEB1ED95FF43` | `PGDMP` custom archive; prior QA describes a separate-database synthetic restore. No approved historical baseline. |
| `C:\Users\Janmari\Downloads\RRJ-Inventory-Dev-20261011\.tmp\phase8-local-schema-acl-restorable.sql` | 635,569; 2026-10-11 20:45 | `514ED9B0B61C7736F92905C2845A2EFF794AE4F3B3E050C39A46C41FDF8D473B` | Local schema/ACL only; prior QA confirms no master rows or opening balances. |
| `C:\Users\Janmari\Downloads\RRJ-Recovery-20261014-Synthetic-Bundle\manifest.json` | 695; 2026-10-14 05:44 | `D033B90DC02DA5806BDAE8811B6EBE12AF83E31059C6282C03B45CEDBADE0B39` | Explicit `synthetic-local-drill` manifest: three files and one object in the original bundle. Later two-object completion is separate; neither is hosted recovery. |

Additional `.tmp/defense-demo-20261014{,-r2,-r3}` and `.tmp/manager-lifecycle-20261014` `before-demo-data.dump` files are approximately 1.2 MB `PGDMP` local demo snapshots; the first is 1,201,318 bytes, modified 2026-10-14 06:25, SHA-256 `9356E8B59EDF12684961D9F641B183F29B0AD0DAD898B92726B1FE6B8EE9E788`. The others are the same class, not separately approved hosted recovery. The restricted-backup attempt under `C:\Users\Janmari\RRJ-Secure-Backups\2026-10-13` contains only small encryption test files, not a restaurant backup. Candidate archives were not extracted or restored.

**Lineage limits:** Git commit `a4758ef10de6d578023ebab406c8a259d15e2de3` introduced the first repository Supabase schema on 2026-08-26; `6ba695b...` introduced Phase 2A on 2026-09-10. Current Git tracks only 36 migration files; the later 16 are present as preserved untracked files. `git log -S` for the first missing Chicken UUID found the Phase 2A introduction, not an earlier source-master insert. The October 10 simulation fixture and October 13 backup are later artifacts. The backup's recorded 2026-08 timestamps make the IDs plausible historical candidates, but neither timestamps nor later presence establish how/when they entered hosted, who approved the records, or what stock existed before Phase 2A.

## D. Phase 2A identity and mapping evidence

**All 22 identities are FOUND BUT PROVENANCE UNVERIFIED** in the later local export's *correct* master tables, and also FOUND ONLY IN SYNTHETIC OR TEST DATA in the separate Phase 8 fixture. None has independently verified pre-Phase-2A source/approval. The M3.1 schema-only diagnostic contains none. In the table, `M` denotes `menu_items`, `I` denotes `inventory_items`; inventory units are copied from the later backup, not inferred from recipe quantities.

| Alias | Required UUID | Unit in later backup | Alias | Required UUID | Unit in later backup |
| --- | --- | --- | --- | --- | --- |
| M1 | `0e0939e8-5e5a-462d-95aa-caa834531a14` | — | I1 | `002ed07e-3cd8-4b36-b2b6-bad61e8a5579` | L |
| M2 | `28cef5f3-b549-4d6a-9e39-61b1cf6f3e11` | — | I2 | `07e2a344-1d50-4453-b8b9-7f3a17251e5a` | kg |
| M3 | `36cf63ad-47bd-40d7-8239-0922769013d4` | — | I3 | `29c32f11-aaff-4e87-a781-4f4723924e41` | L |
| M4 | `3c78b355-2613-4f5b-af4d-ac2197d957fe` | — | I4 | `37401723-e5ca-4664-acad-d58281c61d15` | L |
| M5 | `54cd08a0-e6fd-4d60-84f4-04fb9be8be44` | — | I5 | `3a13849a-eb71-4806-8451-a0f3887746b1` | L |
| M6 | `79dc274a-b608-4ff8-b14a-c8f9b1effb4f` | — | I6 | `4271eea5-2c8a-413d-9d56-7fe47107f272` | kg |
| M7 | `a23b01b5-1c32-443e-9d3e-cbff54040aed` | — | I7 | `617cf643-6691-4710-834d-b9e9713d2bb9` | bottle |
| M8 | `bf931531-0d32-4092-ae0e-448e40d5aaca` | — | I8 | `7f9f25fd-6d1c-4177-8516-043d06f778a4` | bottle |
| M9 | `e2cd2cd2-1d5d-4a64-83fc-0c7b8efc0e9c` | — | I9 | `a3355239-1a21-4459-b80d-a174164872b9` | kg |
| M10 | `eda59cc3-eb0a-4090-80ef-1788229d619a` | — | I10 | `b22e76f0-5e37-4228-9d21-9196b5ea93cd` | kg |
| — | — | — | I11 | `b467aeba-d158-4c6d-b43b-1b71a60910c4` | kg (Chicken in later backup) |
| — | — | — | I12 | `d6d69f5e-00bf-4487-a1f8-f3fa5fe63bd8` | pack |

The 18 tuples are `public.menu_ingredients(menu_item_id, inventory_item_id, quantity_required)` records in the unchanged [Phase 2A SQL](../supabase/migrations/20260904000000_inventory_phase_2a_recipe_deduction.sql). The FK failure is on an inventory identity, with a corresponding menu FK requirement. The ordered tuple digest is given above. Menu-to-ingredient associations are confidential, so this ordinary QA report does not duplicate them; the authorized owner can review R1–R18 in the source SQL through the [M3.2C-A confidential review process](M3-2C-A-OWNER-APPROVAL-PACKAGE.md).

No signed original stock count, batch/expiry opening record, or ledger reconciliation was found in the searched sources. The later dump includes stock and transactions, but these are subsequent state and cannot establish an opening balance.

## E. Migration provenance

The fresh read-only hosted ledger still has **46** versions, `20260825183637` through `20261012181744`, matching the first 46 repository version/name pairs. The local `qa/H09-ORDER-FLOW-MIGRATION-HASHES.json` (14,365 bytes; SHA-256 `0D502A33634F95955323BB360A4E24D1FDFD82BB12374F6773C637B4D4CA71B3`) inventories **current local files**, not the SQL historically run on hosted. The October 13 database export files have no `supabase_migrations` ledger references; the protected recovery supplement is not a complete applied-SQL archive.

| Hosted-recorded group | Ledger statement evidence | SQL-body conclusion |
| --- | --- | --- |
| `20260831151352_manager_inventory_mvp` | `statements` array is null | Unresolved body provenance; name/ledger presence only. |
| `20260903170000_remove_legacy_confirm_order` | One statement, hosted MD5 `f52015b49404f98c2806c96e354bf96e` | Previous QA explains local punctuation/terminal-semicolon normalization; semantic equivalence of this simple DROP is plausible, but byte equality is absent. |
| `20261012181744_manager_inventory_request_documents` | One statement, hosted MD5 `497300ed776f4a0631ec4024cc7fa7cf` | Prior QA matched local text after terminal-newline removal. This is the only previously direct statement-text match, still not a signed deployment artifact. |
| Remaining 43 versions between first and last | Each has a multi-statement ledger array | Version/name parity and current catalogs are available; full per-statement SQL-body attestation remains unresolved for every version in this group. No specific version is proven mismatched by this investigation. |

The M3.2 selected Receiving baseline matched hosted for nine tables, 141 columns, 115 constraints, 49 indexes and 23 triggers; that is catalog parity in the selected objects. M3.2's isolated behavior tests are useful but not historical body provenance. The exact two candidate hashes remain as documented in M3.2; no pending migration was applied here.

## F. Public-function drift: what can be classified

The M3.2 disposable target is gone and its full per-function comparison was not retained. Its report records **21 of 100** different functions: 11 definition/body digests, 11 ACL digests, with `create_walk_in_sale` in both sets. Four body-difference names were retained; seven were not. I did not reconstruct or fabricate those seven identities. A new read-only control compared hosted with the preserved **different**, host-derived local `rrj_rc_synthetic_replay_20261013` database: 100 shared hosted signatures, 105 local functions, **zero shared body/definition/owner/search-path differences**, and 12 ACL differences. This does not erase the prior diagnostic-baseline result, because the local provenance and applied migration set differ.

| Function(s), all `public` | Observed difference and classification | Immediate M3 relevance |
| --- | --- | --- |
| `accept_rider_offer`, `complete_rider_delivery`, `offer_order_to_next_rider`, `reject_rider_offer`, `release_ready_order`, `set_rider_availability` | Six prior ACL-drift candidates; current host-derived local control confirms identical bodies, `postgres` owner/config, but extra local anonymous EXECUTE. **Unrelated existing/local-environment drift**; never copy local grants to hosted. | No direct call or alteration in either M3 migration; Rider/order regression remains a separate release concern. |
| `get_kds_queue`, `verify_kds_terminal`, `provision_kds_terminal` | Three ACL-drift candidates; local control has extra anonymous EXECUTE for `provision_kds_terminal`, while hosted allows anonymous only on the two terminal-token RPCs. Bodies/owners/config match in this control. **Unrelated local-environment drift.** | No direct M3 dependency. |
| `cancel_order` | One ACL-drift candidate; local control has extra anonymous EXECUTE, hosted does not. Body/owner/config match. **Unrelated local-environment drift.** | No direct M3 dependency. |
| `create_walk_in_sale` | Prior M3.2 **body and ACL** difference. Current host-derived control has equal body/owner/config and extra local anonymous EXECUTE. The original body discrepancy cannot be attributed without the discarded diagnostic snapshot. **Potential indirect stock/order dependency; body cause unresolved.** | Candidate SQL does not invoke or replace it; include in general order/stock regression before release. |
| `get_cashier_sale`, `submit_customer_payment`, `verify_customer_gcash_payment` | Three named prior body differences; current host-derived control has equal bodies. **Unresolved diagnostic-baseline cause**, with no direct M3 SQL reference. | Cashier/payment regression outside the Receiving policy's direct contract. |
| Seven additional prior body-difference functions | Names and per-function digests were not retained in M3.2's durable report; **unresolved**, not assigned a fabricated risk class. | Cannot rule out an indirect dependency from the historical aggregate alone. Preserve as a full-parity follow-up, not automatic proof all seven block the two-file M3 DDL. |
| `create_replenishment_request` (additional current-control difference, outside the prior 21 baseline) | Body/owner/config match. Local authenticated EXECUTE is absent after the candidate policy migration, while hosted still grants it. **Expected candidate effect / direct M3 contract.** | Verify this revocation as part of the exact two-file deployment review. |

The hosted ACLs for the first 11 listed drift candidates retain the intended authenticated/service-role access; the local control grants anonymous EXECUTE on those signatures. This is a real local-versus-hosted grant difference, not evidence that hosted is over-permissive. Targeted M3.2 comparison already found the six Receiving-adjacent function bodies/owners matched. An exact reproduction of the original 21-row comparison requires the same diagnostic baseline or retained per-function output; no local database was created for that purpose in this read-only task.

## G. Recovery coverage and approvals

| Component | Artifact found | Current integrity evidence | Protection and restore evidence | Remaining gap |
| --- | --- | --- | --- | --- |
| PostgreSQL roles/schema/public business data | October 13 local `roles.sql`, `schema.sql`, `data.sql` | Three direct size/hash matches to manifest | Prior local restoration reported; no independent-copy restore | Current hosted snapshot, signed source/project linkage, off-device copy, complete fresh restore |
| Managed Auth and Storage metadata | `managed-auth-storage-data-retry.dump` (`PGDMP`, 31,493 bytes); an older zero-byte failed dump also remains | Retry dump size/hash matches manifest; zero-byte file is **not** valid backup | Prior local Auth/Storage restore reported | Independent protected copy, current identity/config parity and restore |
| Private Storage bytes | 30 physical local files under protected-set `storage` directory | **30/30** present and size/SHA-256 multiset matches manifest | Prior local 30/30 upload/readback reported; no new private-byte access | Independent encrypted copy, current hosted object count/bytes, restore from that copy |
| Auth trigger, Storage policies, effective grants | Six-file local supplement | **6/6** size/hash matches | Prior local application/rehearsal reported | Supplement is newer than 7z archive; complete encrypted-set inclusion and independent restore unverified |
| Migration ledger/applied SQL | Hosted 46-version read-only ledger; local file-hash manifest | Version/name parity and one direct prior statement match | October 13 database export lacks ledger supplement | Signed applied-SQL provenance and ledger/restored-catalog coverage |
| Encryption and independent custody | Local 7z and prior encryption-test report | Archive SHA-256 matches prior QA | Archive decryption not tested here; no off-device copy or owner-held key rehearsal found | Independent encrypted copy and verified key recovery |
| Restore rehearsal | October 13 local restaurant restore; October 14 synthetic two-stack drill | Prior QA reports local checks and three synthetic bucket types | Neither is from a verified independent current hosted copy | Full separately authorized rehearsal with Auth/RLS/ledger/byte and business reconciliation |

The local backup root's **current inherited ACL** permits Read/Execute to `CodexSandboxUsers`, with Full Control for the user, SYSTEM, and Administrators. It is not an independently protected off-device location, and the plaintext supplement should not be assumed encrypted. I did not alter permissions. The manifest's 34/34 hash match proves local bytes are internally consistent today, not that they equal a current hosted snapshot, are safely custodied, or can restore the whole system.

No private JSON historical-bootstrap approval manifest or exact-project recovery authorization manifest was found in the searched repository/Downloads JSON files or the two named local backup roots. The QA approval documents are **templates and requirements**, explicitly marked BLOCKED, not signed approvals. Inaccessible off-device/cloud/password-manager locations were not searched; absence there is **UNKNOWN**, not a claim they do not exist. No exact two-file M3 deployment authorization was found.

## H. Release gates and owner action

| M3 gate | Status | Evidence |
| --- | --- | --- |
| Candidate migration identities/hashes and selected Receiving catalog | **PASS for read-only/source comparison** | M3.2 evidence; no source changes here |
| Required Phase 2A UUIDs in a candidate later export | **PASS for presence only** | 10/10 menu and 12/12 inventory in the October 13 local data file |
| Pre-Phase-2A historical provenance and opening stock | **BLOCKED** | No independently dated/approved original master data or opening-stock decision |
| 46-version ledger names | **PASS** | Fresh read-only hosted count/order boundary |
| Full historical SQL-body provenance and pristine replay | **BLOCKED** | One direct statement match; 43 multi-statement and one null-entry provenance gaps; Phase 2A FK and later enum issues |
| Function drift fully classified | **PARTIAL / BLOCKED** | 11 ACL candidates and four named body candidates assessed; seven prior body identities not retained |
| Local backup manifest integrity | **PASS for current local files** | 34/34 main and 6/6 supplement hashes |
| Current, encrypted independent hosted recovery and rehearsal | **BLOCKED** | No verified independent complete copy, custody/key rehearsal, or restore from it |
| Exact M3 hosted release authorization | **BLOCKED** | No owner approval; deployment remains NO-GO |

**Smallest owner action:** identify the original source/capture and accountable approver for the 22 already-located menu/inventory rows and the 18 recipe mappings; review whether the backup's recorded identities/units reflect the actual pre-Phase-2A state; provide a signed opening-stock decision and evidence ID. The owner can approve these existing records if they are authentic—no re-creation from memory or synthetic fixture is requested. Supply the private manifest described above only after that source review. Separately, have the project/recovery owner locate or authorize an independent encrypted copy that includes the later supplement and every private byte, with key custody and a restore rehearsal; a file on the same drive is insufficient. If such copies or approvals exist elsewhere, provide only their private location identifiers and non-secret verification record for scoped review.

**Smallest independent engineering follow-up:** preserve a full per-function diagnostic comparison if a future approved pristine replay is performed, and reconcile the seven unnamed definition differences against that exact baseline. Do not repeat broad M3.1 behavior tests merely to compensate for missing provenance. No deployment, historical migration rewrite, local restore, or Stage 4 work is justified by this discovery.
