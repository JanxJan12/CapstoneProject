# H-16B RRJ Docker deletion readiness — 2026-10-16 Manila

**Decision: BLOCKED for every Docker mutation.** This is a strictly read-only inventory and an approval proposal. No container was stopped, archived, removed, or recreated; no volume, network, image, database, fixture, backup, service, WSL instance, hosted Supabase project, Rider file, or application source was changed. No destructive command in this proposal was executed. The [machine-readable manifest](H16B-RRJ-DOCKER-PROPOSED-DELETION-MANIFEST.json) records **every live full container ID/name/image/state/label/port/network/mount**, every named volume and mountpoint, and every network. IDs are an inventory snapshot and must be checked again before any separately approved action.

## Current evidence and limits

Bounded read-only `docker ps -a --no-trunc`, container inspect, volume list and network list all responded. There are **99 containers, 94 running, 5 stopped**, in **16 container groups**, with **45 volumes and 21 networks**. The counts match H-11I's older 99/94 snapshot; this does **not** establish that every resource ID or state is unchanged. H-12's Docker API timeout was a different observation. Inspect confirmed matching `com.docker.compose.project` and `com.supabase.cli.project` labels for labeled containers; `com.docker.compose.service` and declared `depends_on` were absent. Service roles below follow names and prior reports. Separate project networks and named mounts establish a Docker boundary, but cannot prove no browser, job, external client or human currently uses a stack. No active-client audit, private Storage byte/hash inventory, full database export, service health campaign, or container recreation test was performed here. Image references were recorded; digests were not verified. Current RAM gain is **not measured or claimed**.

The H-16 preflight earlier at 07:01 recorded H-09 Auth/REST HTTP 200 and read-only SQL success, but only 375 MiB Docker VM memory available with 2 GiB swap full. This assessment did not repeat authentication or SQL. A healthy label or Docker response does not make the H-16 acceptance matrix pass; it remains **0 PASS, 0 FAIL, 59 BLOCKED** per the cited preflight state. The full 51-file original migration chain still fails at migration 13 (`SQLSTATE 23503`, missing approved recipe identities). The checkout currently has 52 SQL files including the additive H-08C file; some source is untracked. Reset plus replay cannot stand in for preserved data.

The recovery reports document a local 34-entry file manifest and six-entry supplement, a prior same-drive restaurant restore, and a narrow two-stack synthetic Auth/Storage drill. They do **not** prove an independently encrypted off-device set and successful full isolated restore of each live candidate's PostgreSQL database, managed Auth and private Storage bytes. **Preservation is NOT VERIFIED for all 45 volumes.** An existing volume, local copy, SQL dump, or backup manifest alone is insufficient. The canonical recovery source/target, demo, and H-09 fixtures therefore remain protected.

## Approval inventory — containers

| Classification | Exact group | Live state | Evidence / decision |
| --- | --- | ---: | --- |
| **PROTECTED_KEEP** | `rrj_h09_order_flow_20261015` | 6/6 running | Active H-09/H-10 backend and H-16 target; API/DB/Mailpit loopback 48321/48322/48324. Preserve orders, Auth, Storage. |
| **PROTECTED_KEEP** | `rrj_defense_demo_20261014` | 5/5 | Canonical consumable defense demo; 61321/61322. |
| **PROTECTED_KEEP** | `rrj_recovery_20261014_source`, `rrj_recovery_20261014_target` | 5/5 each | Evidence-bearing synthetic recovery pair; 65321/65322 and 64321/64322. |
| **PROTECTED_KEEP** | `rrj_phase3_prefix_20261014_a1` | 5/5 | Unique 12-migration prefix/FK evidence for the blocked original replay; 63221/63222. |
| **PROTECTED_KEEP** | `rrj_h08c_history_20261015` | 11/12 | H-08C authoritative shift/RLS and later H-09D fixture; full feature stack, 59321/59322/59323/59324/59327. Edge exited. Its analytics service's historical allowlist is not approval to stop it now. |
| **RRJ_DISPOSABLE_CANDIDATE, BLOCKED** | `rrj_h07_financial_20261014` | 5/5 | RRJ synthetic finance fixture, 57321/57322. Unique browser receipts/accounts exist; custody and no-current-use still unverified. |
| **RRJ_DISPOSABLE_CANDIDATE, BLOCKED** | `rrj_h08b_history_20261015` | 5/5 | Earlier synthetic history fixture, 58321/58322; review comparative evidence and local account/data custody. |
| **RRJ_DISPOSABLE_CANDIDATE, BLOCKED** | `rrj_manager_lifecycle_20261014` | 5/5 | Synthetic Manager/Receiving lifecycle fixture, 52321/52322; protect request/Receiving evidence until archived. |
| **RRJ_DISPOSABLE_CANDIDATE, BLOCKED** | `rrj_defense_demo_20261014_r2`, `_r3` | 5/5 each | Separate demo variants, 62321/62322 and 63321/63322; r3 has documented synthetic full-stack harmonization fixtures. Neither is the canonical demo. |
| **UNKNOWN / NOT APPROVED** | `rrj_phase8_sim`, `rrj_rc_synthetic_replay_20261013` | 11/12, 5/5 | Release simulation and replay evidence; current dependencies/custody unresolved. The replay now has live 60321/60322 bindings, unlike the earlier H-11 table; historic bind failures are not current absence. |
| **UNKNOWN / NOT APPROVED** | Unlabeled `rrj_recovery_rehearsal_20261013` | 0/1 | Full ID in JSON; no owner labels or mounts, so its name is insufficient for RRJ deletion. |
| **UNRELATED PROTECTED** | `isolated-stack`, `my-local-todo-app` | 5/6, 11/12 | Separate recovery rehearsal and unrelated personal app. No RRJ approval can touch them. |

The five candidate groups have **25 live full IDs** in the JSON, all with matching owner labels, the expected five named core services, distinct network membership and loopback API/DB bindings. Their containers are **proposed for possible later review only**: `containerRemovalApproved=false` and `containerRemovalReady=false` for every group. The JSON keeps image reference and current state per ID. There is no current-use or independent recovery proof, so **zero containers are approved for stopping or removal**. A container deletion would lose its configured process even if volumes remain; recreation from retained volumes must be proved first.

## Separate volume, network and image decision

**Volume deletion proposal: empty list.** All volumes remain protected pending a separate, named approval after independent archive and full restore proof. Candidate-associated volumes are listed for custody review, not for removal:

| Candidate group | Exact volumes to retain |
| --- | --- |
| H-07 | `supabase_db_rrj_h07_financial_20261014`, `supabase_storage_rrj_h07_financial_20261014` |
| H-08B | `supabase_config_rrj_h08b_history_20261015`, `supabase_db_rrj_h08b_history_20261015`, `supabase_storage_rrj_h08b_history_20261015` |
| Manager lifecycle | `supabase_db_rrj_manager_lifecycle_20261014`, `supabase_storage_rrj_manager_lifecycle_20261014` |
| Demo r2 | `supabase_db_rrj_defense_demo_20261014_r2`, `supabase_storage_rrj_defense_demo_20261014_r2` |
| Demo r3 | `supabase_db_rrj_defense_demo_20261014_r3`, `supabase_storage_rrj_defense_demo_20261014_r3` |

The remaining **34 volumes** are individually enumerated in JSON: 13 attached to protected-keep groups, 5 to unrelated groups, and 16 unknown/not approved. Ten have no current container mount, including two anonymous names, one unlabeled Capstone edge volume, and older labeled config/DB/Storage volumes from `codex_phase7a_local`, `rrj_cutover_6b7a_qa`, and `RRJ_RC_Repro_20261013_1`. They are **not orphans authorized for deletion**; previous owner, data and restore state are unresolved. Volume name prefixes alone are never a deletion rule. Every mountpoint and attached container is recorded in JSON.

**Network and image deletion proposals: empty lists.** The 21 network records include shared/default networks and three currently unattached phase-8 replay networks. Unattached does not mean disposable. Image references may be shared across protected and unrelated stacks; no image removal is proposed. No blanket prune, broad Compose teardown or factory reset is in scope.

## Ordered future proposal — all steps unexecuted

1. **Evidence and archive gate.** Privately inventory every candidate's PostgreSQL roles/schema/data, Auth identities/configuration, Storage metadata and all private object bytes/hashes, migration ledger, grants/RLS/functions/triggers, local runtime config, fixture provenance, and users/jobs. Verify a restricted encrypted archive from an independent off-device copy, extraction, key recovery and a full isolated restore. Preserve the dirty checkout and all existing QA reports. Mark any failed or missing check **BLOCKED**.
2. **Individual pause approval gate.** Review one exact complete candidate stack and its live full IDs, last use, clients, dependency graph, original running states, ports, mounts and rollback plan. With fresh Docker/host capacity and protected H-09/demo health, obtain explicit approval for a *reversible pause only*. A verified-idle whole-stack pause could reduce load while keeping containers and volumes, but no RAM saving is assumed. Do not use the current H-11 single-analytics script as a whole-stack plan.
3. **Health and restoration gate.** After a separately approved pause, measure VM/host headroom and H-09/demo Auth/REST/read-only SQL health. If service degrades, restore the exact original states and investigate. Prove candidate restart from retained DB/Storage volumes before any container removal proposal proceeds.
4. **Separate container deletion approval gate.** Only after the evidence and recreation gates pass, present the exact paused full IDs from a **fresh** manifest for a new approval. Remove only individually approved candidate containers, retain every volume/config, and recheck protected health. No candidate is eligible now.
5. **Independent later volume approval gate.** Only after a verified independent full restore and retention decision, request a *different* approval listing each exact volume and its hashes/custodian. Networks and images remain a separate decision. No volume, network or image is eligible now.

No executable deletion, stop, archive or reset commands are supplied. The narrow phase 1 recommendation is **preserve everything, complete candidate-specific archive/use/dependency evidence, and then consider one explicitly approved reversible whole-stack pause**. Do not approve container or volume removal from this inventory alone.

## Sources reviewed

`H11C-FIXTURE-ELIGIBILITY-MATRIX.md`, `H11C-SANITIZED-INVENTORY.json`, `H11I-IDLE-FIXTURE-PAUSE.md/.json`, `H11F-WINDOWS-RESTART-AND-RECOVERY.md/.json`, `H12-LOCAL-DOCKER-RESET-READINESS.md` and its JSON inventory, `H16-LOCAL-ACCEPTANCE-PREFLIGHT.md`, H-09/H-10 browser and reliability reports, `DATABASE-DISASTER-RECOVERY-PHASE3.md`, `DATABASE-MIGRATION-REPRODUCIBILITY-PHASE3.md`, `RESTORE-DRILL-20261014.md`, selected fixture reports, `scripts/demo/prepare-defense-demo.ps1`, `scripts/recovery/local-synthetic-drill.mjs`, and sanitized `project_id`/port lines from local Supabase configs. Scripts were read, not executed. This report contains no credentials, connection strings, personal addresses or private object paths.
