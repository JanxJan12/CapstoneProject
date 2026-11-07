# M3.2B historical evidence and recovery readiness — 2026-10-18 (Asia/Manila)

**Decision: M3.2B PARTIAL — TARGETED OWNER ACTION REQUIRED. Hosted M3 deployment remains NO-GO; Stage 4 remains paused.** This investigation wrote only three new QA drafts in the canonical repository. It did not write to the USB, decrypt an archive, export hosted data, restore business/Auth/Storage records, change ACLs, run migrations, or modify hosted Supabase. Existing modified and untracked work was preserved.

## Executive summary and evidence classes

The October 13 local export contains all **10 required menu IDs, 12 inventory IDs and 18 exact Phase 2A recipe mappings**, including matching numeric mapping quantities. This is a later snapshot. No independent original record or accountable owner attestation was confirmed for the pre-Phase-2A identities, recipes or opening stock. The export has **zero** `inventory_opening_balances` rows, while three pre-September-4 inventory movements appear in its transaction history; neither fact authorizes an invented or assumed opening balance. [The unsigned owner review draft](M3-2B-OWNER-REVIEW-DRAFT-20261018.md) lists every ID and the hash-bound R1–R18 review scope while leaving decisions blank; the mapping pair table was redacted in M3.2C-A to reduce recipe disclosure.

The local October 13 main backup matches its manifest **34/34** by size/hash, and the separate supplement matches **6/6**. This proves current local file integrity, not original business provenance, full current hosted coverage, encryption or an off-device restore. A read-only hosted Storage metadata check found the same 30 bucket/name identities as the local manifest; private byte parity was not checked. The positively identified USB is `D:`; its free space suffices for this small partial source set, but encryption status is unknown, the filesystem is FAT32, and unrelated content exists. It was not written. Release preflight remains fail-closed.

| Evidence class | Finding | Status |
| --- | --- | --- |
| Later local candidate records | 22 IDs and 18 mappings in October 13 export | **PASS — existence/consistency only** |
| Original pre-Phase-2A source and owner approval | No independently approved originals or signed manifest confirmed | **BLOCKED** |
| Local source integrity | 34/34 main and 6/6 supplement size/hash matches | **PASS — local bytes** |
| Hosted-project origin and currentness | Manifest claims hosted export; 46 hosted ledger names and current 30 Storage names match selected evidence; no full signed chain/current byte parity | **BLOCKED — complete attribution** |
| Protected complete recovery, independent copy and restore | Missing approved key/custody, full catalog/ledger evidence and actual copy/restore | **BLOCKED** |

## Historical candidate validation

The unchanged [Phase 2A migration](../supabase/migrations/20260904000000_inventory_phase_2a_recipe_deduction.sql) has SHA-256 `F06983ED7E9BA60F48654F8DF97F177FF8802A0C74297300B851B0226180A5D0`; its ordered 18-tuple digest is `5d2551ee51d124346edc2bd884dce035f7234b9906f74b1385c9b9cbd8ba7677`. The backup `data.sql` SHA-256 is `9FD18E166AAEF422F5BF8B7B6178642B1D7D02E61148D984EC29A9B1EF65B114`. Its correct `menu_items` COPY has the ten expected IDs, its `inventory_items` COPY the twelve expected IDs, and its `menu_ingredients` COPY has 28 rows, including all eighteen required pairs with matching numeric `quantity_required`. All 22 exact IDs, units and the 18 pair/source-line references are in the [owner draft](M3-2B-OWNER-REVIEW-DRAFT-20261018.md); the same exact IDs are independently enumerated by `validate-provenance.mjs`. Confidential numeric recipe values remain in the protected source/Phase 2A SQL rather than being repeated here.

Embedded menu creation dates say August 16, inventory creation dates August 31, and recipe mapping dates September 4. These are claims inside an October 13 export, not proof that original records existed on those dates. The only other located all-ID source is the October 10 Phase 8 **synthetic** fixture; it is excluded. The earlier schema design, Git history search and schema-only diagnostic did not supply the missing original master-data rows. No owner-signed recipe or original inventory/menu intake was found within the scoped authorized artifacts. Exact search limits and lineage are recorded in [M3.2A](M3-2A-EVIDENCE-DISCOVERY-20261018.md).

The October 13 export's `inventory_opening_balances` COPY has **0 rows**. Of 43 `inventory_transactions` rows, three precede September 4: one receiving and two adjustments, none linked to an opening-balance ID. This cannot establish a physical count or prove zero opening stock. The owner must choose `approved-zero`, a sourced `approved-physical-record`, or reject/defer, and provide an `openingStockEvidenceId` and reconciliation. No stock transaction was created.

The [owner draft](M3-2B-OWNER-REVIEW-DRAFT-20261018.md) is **UNSIGNED** and **not** a validator manifest. It includes 22 identity review rows, a hash-bound 18-mapping review scope, opening-stock questions, a new-unlinked-environment bootstrap scope statement, source hashes, unresolved items, and blank owner/reviewer signoffs. Names, numeric recipe quantities and any later private baseline JSON should be reviewed in a restricted owner-controlled location; the present repo's recovery ACL findings make it unsuitable to claim a protected private appendix. The historical source exports remain preserved. No approved historical-bootstrap JSON was generated or inferred.

## Recovery component inventory and limits

Exact source paths, sizes and hashes for the four database files, the 34-file manifest, the 30 local private objects, the six-file supplement, and the earlier archive are recorded in [the recovery package draft](M3-2B-RECOVERY-PACKAGE-DRAFT-20261018.md) and [M3.2A](M3-2A-EVIDENCE-DISCOVERY-20261018.md). The main root is `%LOCALAPPDATA%\RRJ-Private-Backups\Supabase-20261013-062110`; the six-file supplement is under `%LOCALAPPDATA%\RRJ-Private-Backups\rehearsal-20261013`. Files were hashed directly against manifest values in this investigation. The 30 physical objects were matched to size/hash manifest entries as a multiset, avoiding disclosure of private paths. The manifest itself is SHA-256 `E46B590ED584A19EC4714498D5B3C9597820DCC3B4B94134A233E723F3D7CDD1`; supplement manifest SHA-256 `A298605C9282E4BF4DBCBA3C693A88C6DC5D12E1A68781E2C8CD021BA41AB4B7`.

| Recovery component | Local evidence | Remaining requirement |
| --- | --- | --- |
| Roles, public schema/functions/RLS, business data | `roles.sql`, `schema.sql`, `data.sql` each hash-match | Restore and compare privileges, functions, data; establish current hosted snapshot and provenance. |
| Auth and Storage metadata | Valid `PGDMP` retry dump hash-matches; earlier zero-byte dump invalid | Confirm actual restore/config coverage and current hosted parity. |
| Private Storage bytes and buckets | 30 local byte files hash-match; hosted read-only metadata has 11/16/3 in delivery/payment/rider buckets | Prove per-object current hosted bytes and restore from independent protected copy. |
| Auth trigger, Storage policies, ACLs, restore aids | Six supplement files hash-match | Review applicability, include and restore; archive predates supplement. |
| Migration ledger/applied SQL | Hosted read-only 46 version/name entries; local hash inventory | Export/attest complete applied ledger and SQL-body provenance; current backup has no ledger SQL. |
| Independent encrypted copy and recovery | Existing 7z archive only on local disk; synthetic/local prior rehearsals | Verified complete encrypted off-device set, recoverable key, isolated genuine restore. |

Hosted `storage.buckets`/`storage.objects` were queried read-only. Their three private-bucket counts total 30 and the sorted bucket/name identity MD5 `77779feb58df942aa09a81e7936ec620` equals the normalized local manifest identity digest. This strengthens object-list coverage only; no hosted private bytes were downloaded, and metadata can change. The old 7z is 2,739,138 bytes, SHA-256 `37A6CD5A11F17AFFC0A99D3EC5953D2DA1011C07F279A1BFD140FC5CC1852E50`; its modification time precedes the supplement. It was not opened or decrypted and may omit that supplement. Prior local/synthetic restores do not verify this independent recovery path.

The backup root, set, `data.sql`, Storage directory, supplement and archive inherit an Allow ReadAndExecute ACL for `LAPTOP-H4CQIVB8\CodexSandboxUsers`, alongside user/SYSTEM/Administrators access. This is a potential private-data exposure to members of that group. Whether the membership and inheritance are expected is unverified. Owner/security review should check effective group membership, backup service needs and inheritance, then authorize a least-privilege correction with tested recovery access. No ACL was changed. Plaintext local sources are not protected merely by their directory name.

## USB identity, suitability and proposed operation

Windows read-only disk/volume inspection identified disk 1 as `General UDisk USB Device` (`USBSTOR`, removable media, USB bus, MBR, online/healthy); its `D:` volume has an empty label, GUID `\\?\Volume{037908d5-cac3-11f1-ada6-cc4740379154}\`, FAT32 filesystem, 8,051,064,832-byte capacity and 7,558,397,952 bytes free. The physical disk is 8,053,063,680 bytes. No other removable candidate was identified in this inspection. The disk's read-only flag is false, but write capability was not tested. `Get-BitLockerVolume D:` returned Access denied, so encryption status is **unknown**. Detailed media health was not proven by the basic Healthy status. Its root has unrelated existing entries and no RRJ recovery directory; unrelated names are omitted. FAT32 cannot hold a single file of 4 GiB or more. It is physically removable, but off-device custody is unverified.

**Exact proposed destination, not approved:** `D:\RRJ-Recovery\M3-2B-20261018\`, with a new authenticated encrypted **partial evidence** package of the 34 main plus six supplement source components, manifest and non-secret receipt. The 40 source files total 6,475,637 bytes before packaging, encryption and metadata; no existing file would be overwritten. Use a reviewed authenticated-encryption implementation and owner-held recovery key, recheck drive identity and hashes, then compare source/destination size and SHA-256 and authenticate the USB copy. Safe removal and protected physical custody require a separate owner action. [The draft package design](M3-2B-RECOVERY-PACKAGE-DRAFT-20261018.md) defines inclusion/exclusion and recovery dependencies. Node 22 offers AES-256-GCM; no reviewed package implementation or secure credential route is approved yet. Installed 7-Zip AES availability alone does not prove authenticated protection. **No encryption package was created and no USB write occurred.** Per the M3.2B directive, the user must explicitly approve this exact device, directory, operation and method before a write.

## Verification results and release gate

| Check | Result | Evidence / limit |
| --- | --- | --- |
| Git baseline and work preservation | **PASS** | Dirty worktree inspected before edits; only the three new M3.2B QA drafts were added. |
| Master IDs and mapping consistency | **PASS** | 22/22 IDs and 18/18 pairs plus numeric quantities match later export; historical provenance **BLOCKED**. |
| Opening-stock source/decision | **BLOCKED** | 0 opening-balance rows and 3 earlier movements; no signed original count/zero decision. |
| Main and supplement integrity | **PASS** | 34/34 and 6/6 size/SHA-256. No current-hosted byte or full recovery claim. |
| USB positive identification/capacity | **PASS** | USB disk 1 and D: GUID identified; 7.56 GB free. Protection and FAT32 suitability for future full backup **BLOCKED**. |
| Package encryption and off-device copy | **NOT RUN** | No approved method/key/copy operation; USB untouched. |
| Genuine isolated restore | **NOT RUN** | No separately authorized protected target, key route, complete hosted material or restore permission. |
| `preflight-self-test.mjs` | **PASS** (exit 0) | Missing/malformed approvals fail closed; migration hashes checked. |
| `validate-provenance.mjs` without private manifest | **BLOCKED** (exit 1) | Reports no authoritative approval manifest; enumerates 22 absent pre-Phase-2A IDs. |
| `check-release-preflight.mjs` without private manifests | **BLOCKED** (exit 1) | Missing historical and hosted recovery authorizations; six pending migration hashes intact. |
| Exact M3 migration file hashes | **PASS — unchanged** | `20261013000302`: `CBC8B54349E724EEB75796984014B33DF9F8B3EF46415647FE33F7FA02A27828`; `20261013053159`: `EBE0B2C02F3035602D5544B5EC024FE5FCFB2F58FA4CDAB2C9784305CCA058EE`. |

The preflight lists six pending files but the separately reviewed M3 release scope is **only** those two October 13 files in that order. The later four remain excluded. A passing self-test is not release approval. No M3.3, hosted Receiving deployment, or Stage 4 acceptance was performed.

## Decisions and next action

1. **Data/stock owner:** supply independently sourced original menu/inventory identities and recipe records for every row of the unsigned owner draft, identify changes, approve/reject each, and sign a supported opening-stock decision with evidence ID. A later export or synthetic fixture does not fill this role.
2. **Data owner and engineering reviewer:** after that review, prepare private hashed menu/inventory baselines and a signed `historical-bootstrap` manifest outside the repo; review deterministic FK-safe inserts for a newly named unlinked environment, unchanged historical migrations and pristine replay. Resolve known later enum/function parity issues before claiming full migration history.
3. **Project/recovery owner and security reviewer:** decide whether to preserve a **partial** encrypted October 13 evidence copy now or first obtain a fresh complete hosted recovery authorization and export. Provide secure key provisioning/custody, restricted staging and retention, verify the `CodexSandboxUsers` ACL exposure, and approve an exact USB path/method before any write. Full recovery also requires applied ledger/SQL, current catalog/Auth and all private bytes, plus independent custody.
4. **Restore owner:** approve a named isolated protected target and actual business/Auth/Storage restore scope after a complete package exists; verify the entire recovery chain. Prior schema or synthetic tests cannot substitute.
5. **Release owner:** only after provenance, replay, full parity, backup and restore gates pass, consider separate exact two-file hosted deployment approval. The existing fail-closed preflight remains in force.

**Files added:** `qa/M3-2B-OWNER-REVIEW-DRAFT-20261018.md`, `qa/M3-2B-RECOVERY-PACKAGE-DRAFT-20261018.md`, and this report. **Principal sources read:** the three prior QA/runbook documents cited above; `qa/MASTER-DATA-PROVENANCE-APPROVAL-20261014.md`, `qa/HOSTED-RECOVERY-APPROVAL-20261014.md`; the Phase 2A and two selected M3 migrations; `scripts/recovery/{validate-provenance,check-release-preflight,preflight-self-test}.mjs`; the exact local backup, manifest, supplement and old archive paths named above; Windows disk/volume/ACL catalogs and read-only hosted Storage metadata. No source code, migration or protected artifact was modified.
