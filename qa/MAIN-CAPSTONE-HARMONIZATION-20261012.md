# Main Capstone two-folder audit and safe harmonization

**Date:** 2026-10-12 (Asia/Manila)  
**Canonical project A:** `C:\Users\Janmari\Downloads\Capstone Project` (Git branch `main`)  
**Merge source B:** `C:\Users\Janmari\Downloads\RRJ-Integrated-Candidate-20261012` (not a Git repository)  
**Read-only provenance C:** `C:\Users\Janmari\Downloads\RRJ-Inventory-Dev-20261011` (not a target)  
**Result:** MAIN now contains the candidate's Manager Inventory P1–P5 code and additive request migration. **Source/code integration PASS; authenticated database behavior NOT TESTED. Staging and production NO-GO.**

## Pre-edit evidence and lineage

- A started with **99** dirty/untracked Git status paths. Its status was byte-for-byte equal after newline normalization to B's saved `qa/source-a-status-before.txt`. All **407/407** files in B's recorded A starting hash snapshot still matched A before editing. This established that B was assembled from the *current* A baseline rather than a presumed newer branch.
- Excluding `.git`, `node_modules`, `dist`, `.tmp`, and `.codex-temp`, current A had **407** files and B had **413**. **397** paths were shared: **384** identical and **13** different. A had **10** unique paths; B had **16** unique paths.
- The 13 differences were the **11** Manager Inventory/integration paths listed below, plus `.env.local` and `supabase/config.toml`. Those last two have deliberately different targets and were **not copied**. `package.json` and `package-lock.json` matched exactly; lockfile SHA-256: `32099403e1637db3ab7fee968c80201fa3e79cf8aae05fcfdf7cf9059881e5bd`.
- B's prior report identifies 11 inventory transplants from frozen P1–P5 source C and five new paths. The added request migration's SHA-256 also matched C: `fec604aa63ac3b2b55703118dfac8858e921bc7ab1673872d15cbc4f446de969`. B's 403-file source checksum inventory matched **403/403** before and after this work. B and C were not edited.
- An initial Python-based inventory command could not run because Python is not installed through the shell alias. The complete comparison was rerun in PowerShell using SHA-256 and succeeded.

## Difference classification and decisions

**A-only protected paths (10):** `.openai/hosting.json` and `supabase/.temp/cli-latest`, `gotrue-version`, `linked-project.json`, `pooler-url`, `postgres-version`, `project-ref`, `rest-version`, `storage-migration`, `storage-version`. These were preserved without reading or printing remote values. A's hosted `.env.local` and `supabase/config.toml` were also preserved exactly.

**B-only paths (16):** the five added runtime/migration/test paths in the file table below; `scripts/verify-integration-candidate.mjs`; and ten B-specific QA artifacts: `qa/INTEGRATION-CANDIDATE-REPORT-20261012.md`, `qa/inventory-transplanted-paths.txt`, `qa/RECEIVING-MOVEMENT-AUTHENTICATED-VERIFICATION-20261012.md`, `qa/receiving-movement-source-before.sha256`, `qa/source-a-before.json`, `qa/source-a-after.json`, `qa/source-a-status-before.txt`, `qa/source-a-status-after.txt`, `qa/source-b-before.json`, `qa/source-b-after.json`. The QA artifacts and candidate-specific verifier were not copied into A. A's existing QA, fixture, asset, Storage, and business files were preserved.

**Shared code retained from A:** `src/app/routes.tsx`, `src/components/layout/AppShell.tsx`, `src/modules/customer/index.tsx`, `src/modules/cashier/index.tsx`, `src/modules/kitchen/index.tsx`, `src/modules/rider/index.tsx`, `src/modules/production/index.tsx`, `src/modules/manager/inventory/inventoryApi.ts`, `receivingApi.ts`, `replenishmentApi.ts`, and `ReplenishmentPage.tsx` all matched B before editing. Their existing functions, including Supplier PO and legacy Production request handling, stayed in place. A's other Manager, Auth, Customer, Cashier, KDS, Rider, and shared modules were not rewritten. The pre-existing `/production` route remains; no new Production identity or route was created.

**Merged inventory paths:** Stock Monitor, Requests, linked Receiving, Stock Movements, Waste/Spoilage, Adjustments, Audit, inventory navigation, Manager shell wiring, and an alert dialog. The Manager Requests screen embeds the pre-existing `ReplenishmentPage` as its legacy path. Its new document flow supports multi-item Manager-issued Production requests, manual Messenger dispatch/acknowledgment attestations, a named physical inspector, posted accepted-only stock, and linked reconciliation. New migration `20261011120154_manager_inventory_request_documents.sql` is additive and now sorts after A's existing 45 migrations. Its source defines request documents, lines, revisions, events, Manager-checked RPCs, RLS/ACL, and linked receiving guards; it does not replace `post_receiving_report` or Phase 7B. This is source inspection, not a migration replay or database proof.

## Exact changes and restore map

Only the following 16 B paths were installed. An original status of `clean` means the original file was tracked with no Git status entry; ` M` and `??` are the exact original porcelain codes. For each existing file, the backup path is under the out-of-tree folder named below. Original and installed SHA-256 values are complete.

**Backup root:** `C:\Users\Janmari\Downloads\RRJ-Main-Harmonization-Backup-20261012-040524`  
**Restore manifest:** `restore-manifest.json` in that folder. It records the original status, original hash, installed hash, and exact per-file backup path.

| Path | Original status | Original SHA-256 | Installed SHA-256 | Backup / restore source |
| --- | --- | --- | --- | --- |
| `scripts/verify-manager-shell-navigation.mjs` | `??` | `3be279f4113dd670c521ca3248380104f2990f510755387dedb358e0051333d5` | `05f0c333fd094c6650096cbb92903757803c015ca581b9d175a91cd1fc88f58c` | `files/scripts/verify-manager-shell-navigation.mjs` |
| `src/components/ui/alert-dialog.tsx` | clean | `16f0bf95de446a8579cba6e75557fd83eb4aa0dbbc77ee936fbb59451e9390e9` | `659f3efb7957965c999682e872935d3a541d713f5948a5136ffbf1385bc82bdd` | `files/src/components/ui/alert-dialog.tsx` |
| `src/modules/manager/index.tsx` | ` M` | `77eae71a3859e5235638b6fe598859099d67f8c2266929208fa126ea4d28a2a7` | `89d481222056ecf141d3cf3ac40d41c23dab381887ee7231564f623f1558b0b3` | `files/src/modules/manager/index.tsx` |
| `src/modules/manager/inventory/AdjustmentPage.tsx` | ` M` | `0e207d81963633668dfe2f3548d9b1618e9983b5375ecee0f552705521a66837` | `96a3c76b57ca1e1d94d9fc2ce11abdd32282068bff8774bbedd3e3361a643d22` | `files/src/modules/manager/inventory/AdjustmentPage.tsx` |
| `src/modules/manager/inventory/InventoryAuditPage.tsx` | `??` | `845c33b178ae7e2f3190c5fd443883cc1f08206792d9a5041d34051aaa626592` | `2b730d974c40f92c520ca5f229efb4c16b71d63e3241ffdea055fb2e4cfaa0b2` | `files/src/modules/manager/inventory/InventoryAuditPage.tsx` |
| `src/modules/manager/inventory/InventoryPage.tsx` | ` M` | `d5b8b61d1bb7755416d254f2b54439dabe236eba56f7ccec9d81564f49673f1e` | `196bedc4bd361ad5b3a7f4d5fc86a18e7754448be4d32d346f372dd1ef4951db` | `files/src/modules/manager/inventory/InventoryPage.tsx` |
| `src/modules/manager/inventory/InventoryReconciliationPanel.tsx` | clean | `fe4b46d2dd4c877adda17417efd7d7a0c7e4e53d0c100f0d075ab5b1020ff37c` | `d16b87c416a2c662073a160517bce5142ea590f4d447a0ddc8cadd74044419f3` | `files/src/modules/manager/inventory/InventoryReconciliationPanel.tsx` |
| `src/modules/manager/inventory/InventoryWorkspaceNav.tsx` | ` M` | `12d09a559597d2b619a78bdc4dbe0219d7ab38ab6f7eb0cb47e4baf400328512` | `a502530da75a04a2c284934cba6fcb9b0755abee5906f628f2d79edc80a5d3cd` | `files/src/modules/manager/inventory/InventoryWorkspaceNav.tsx` |
| `src/modules/manager/inventory/InvTransactionsPage.tsx` | ` M` | `ec85ec8f48543fc5e0065c42008943c54217b5c6c4756342aa60246798bd5af4` | `47a23df8aa559e8550c94be747b9b146e7ce4fc9d8b0dea1aa5dfc47ddcaaa2f` | `files/src/modules/manager/inventory/InvTransactionsPage.tsx` |
| `src/modules/manager/inventory/StockReceivingPage.tsx` | ` M` | `9f70dc5a4afdc0b8aeb5f74897dd59a58fff5e0e533092321618707a634d0986` | `f745b06e32ecb988a8cdea8af0bf560925c3b5ffda626eadbc543d7c0a83c572` | `files/src/modules/manager/inventory/StockReceivingPage.tsx` |
| `src/modules/manager/inventory/WasteSpoilagePage.tsx` | ` M` | `39bcb1ae0b9f1bcd26f93e83811099828cbe5c36b42e1d07f8e4309ed2cea7d0` | `750d035ae59372f649b2fbd2fa603ee085db09759ba71374be6a5ef626b6d336` | `files/src/modules/manager/inventory/WasteSpoilagePage.tsx` |
| `src/modules/manager/inventory/inventoryRequestApi.ts` | absent | — | `2b3c7ad29e234679f33256b674eaf3908cd1dffeb9de09b14a874e4ec48f5f37` | new file; remove only after review |
| `src/modules/manager/inventory/ManagerRequestsPage.tsx` | absent | — | `88159038e6551538fefce2366aa97f8fe74f3bb0cae02b131c17853122b7e93d` | new file; remove only after review |
| `supabase/migrations/20261011120154_manager_inventory_request_documents.sql` | absent | — | `fec604aa63ac3b2b55703118dfac8858e921bc7ab1673872d15cbc4f446de969` | new file; remove only after review |
| `supabase/tests/verify_manager_inventory_request_documents.sql` | absent | — | `97cfd5389279be7bfa2155ad37166b41aa1febdbae8202f31e22a408aef0acc9` | new file; remove only after review |
| `supabase/tests/verify_manager_inventory_request_security.sql` | absent | — | `463748625de64a4f327796a2a0226290c087c8983554cd35dfd8418fd382f871` | new file; remove only after review |

For a selective restore, compare the current target hash with the installed hash in the manifest, then copy that file's `backupPath` over the matching main path. For each path marked absent, remove that newly added file only after reviewing dependencies. This work did not reset, stage, stash, or commit the repository. Existing 11-file backups were hash-verified before the edit; all 16 installed paths were hash-verified afterward.

## Local validation on the MAIN project

All commands ran on A. Typecheck, source verifiers, and build received process-only `VITE_SUPABASE_URL=http://127.0.0.1:57321` and `VITE_SUPABASE_PUBLISHABLE_KEY=local-verification-only` overrides, `npm_config_offline=true`, local-only proxy settings, and a Node preload guard that rejects non-loopback sockets and DNS. A's hosted environment file was not edited. The Vite build output went to the out-of-tree backup folder, leaving A's pre-existing `dist` alone.

| Check | Result |
| --- | --- |
| Preflight: A baseline/status, B source hashes, package lock, config separation | **PASS**; A 407/407 recorded files and 99 status entries matched pre-edit; B 403/403 recorded source hashes matched |
| `npm.cmd run typecheck` | **PASS**, exit 0 |
| Local Vite production build to out-of-tree `validation-build` | **PASS**, exit 0; 3,015 modules transformed. Vite warned that the external output directory would not be emptied; it was initially absent. |
| Six focused Manager Inventory/source verifiers | **PASS, 176/176**: shell 19, workspace 24, UI 19, Receiving draft 61, Receiving posting 42, quality 11. The two local Vite-based verifiers exited 0 without the prior candidate's dependency-scan shutdown diagnostic. |
| Main-adapted candidate integration source/route/migration verifier | **PASS, 322 checks**, exit 0. It replaces candidate-only environment/link-marker assertions with unchanged-main-environment/config hash checks. The original B-only 329-check verifier was not run against A because A intentionally retains hosted config and active link metadata. Adapted verifier is stored only with the out-of-tree backup. |
| Non-target baseline hashes and Git status | **PASS**; 396/396 recorded non-target files unchanged. The 90 original non-target dirty status entries remained identical after edits. |
| Offline build target scan | **PASS**; the build contains the temporary loopback URL and no occurrence of A's hosted hostname in 76 JS files. This scan does not prove all runtime paths are safe against future hosted execution. |
| Lint/format script | **NOT AVAILABLE** in `package.json`; no lint or format script was run. |
| Authenticated Receiving → new Stock Movement on one database | **NOT TESTED / BLOCKED**; no approved local-test schema baseline was identified in the prior bounded attempt. No schema approval, receipt, or new movement was manufactured here. |
| Database migrations, Auth, Storage, RLS runtime, browser/device, hosted/staging/production | **NOT TESTED**; no Supabase CLI, hosted contact, migration application, deployment, or real business transaction. |

## Current source result and remaining gates

At source/code level, **MAIN contains the completed candidate P1–P5 Manager Inventory paths**, and its pre-existing Customer, Cashier, KDS, Rider, Production, other Manager, Supplier PO, and legacy request route bindings remain present. Source checks and the offline build establish compilation and expected wiring; they do not establish authenticated runtime behavior or physical stock correctness. The newly added request RPCs will be unavailable to a database until its reviewed migration is applied in an approved environment. A's hosted config still points to its original target, so this main checkout must not be launched for business testing without a separate controlled local target.

No source conflict remained after comparing A to B's recorded starting hashes. The open gate is the already documented same-database authenticated Receiving-to-Stock-Movement test, plus SQL replay/permission evidence and any later staging/production checks. The prior attempted test remains **BLOCKED / NO TEST**. Historical Storage bootstrap, recipe/business identity, Auth/Storage, and real-world opening balance caveats were not changed. **Staging and production remain NO-GO.**

