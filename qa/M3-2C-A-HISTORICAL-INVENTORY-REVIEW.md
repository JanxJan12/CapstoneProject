# M3.2C-A historical inventory and recipe approval review — 2026-10-18

**Conclusion: READY FOR OWNER REVIEW.** This means the review questions and candidate evidence are organized; **no owner approval, verified original history, protected private manifest, or clean Phase 2A replay exists.** Hosted M3 deployment remains NO-GO and Stage 4 remains paused. The canonical worktree was inspected before editing and all unrelated modified/untracked work was preserved. No database, USB, hosted project, migration body, business record or backup artifact was changed.

## Evidence and method

| Ref | Artifact, scope and SHA-256 | Evidentiary weight |
| --- | --- | --- |
| E1 | `%LOCALAPPDATA%\RRJ-Private-Backups\Supabase-20261013-062110\data.sql`; 188,003 bytes; `9FD18E166AAEF422F5BF8B7B6178642B1D7D02E61148D984EC29A9B1EF65B114` | Later October 13 master and movement snapshot; locally intact, original timing and approval unverified. |
| E2 | `supabase/migrations/20260904000000_inventory_phase_2a_recipe_deduction.sql`; `F06983ED7E9BA60F48654F8DF97F177FF8802A0C74297300B851B0226180A5D0` | Unchanged FK-dependent 18-tuple source. Ordered tuple SHA-256 `5d2551ee51d124346edc2bd884dce035f7234b9906f74b1385c9b9cbd8ba7677`. |
| E3 | `%LOCALAPPDATA%\RRJ-Private-Backups\rehearsal-20261013\public-only-data.sql`; 123,045 bytes; `5783653FD18968C141952FA44F4E3EACBA63D1AD397C6EAF122954FD762E4FB2` | Related October 13 copy. Relevant five public COPY sections have equal content hashes to E1; **not independent corroboration**. |
| E4 | Main `backup-manifest-v2.csv`; `E46B590ED584A19EC4714498D5B3C9597820DCC3B4B94134A233E723F3D7CDD1`. Supplement `recovery-supplement-manifest.csv`; `A298605C9282E4BF4DBCBA3C693A88C6DC5D12E1A68781E2C8CD021BA41AB4B7` | Integrity manifests; not historical approval or hosted SQL-body proof. |
| Excluded | October 10 Phase 8 synthetic historical-master-data fixture; `57D22174104C0DA33DF06E51CDE404BA9BF881500D83A95F5CF6AAEEA75F257D` | Test-only records; cannot authenticate original business state. |

Source hashes were recalculated. E1 and E3's complete `menu_items`, `inventory_items`, `menu_ingredients`, `inventory_opening_balances` and `inventory_transactions` COPY sections match byte-for-byte after line-ending normalization; E3 is not a second independent source. Git `-S` search found the Chicken ID in the Phase 2A introduction commit, and no earlier transaction-ID commit. Earlier schema design and schema-only diagnostics do not contain original rows. [M3.2A](M3-2A-EVIDENCE-DISCOVERY-20261018.md) records the scoped earlier-export/Git/authorized-artifact search and its limits. Unsearched owner paper records or private accounts remain unknown.

## 22 identity classifications

All rows below occur in the correct E1 master table with the shown UUID and label. `created_at` is recorded as August 16, 2026 for each menu row and August 31, 2026 for each inventory row (UTC). This is a **later export's timestamp claim**, not independent proof that the row existed before Phase 2A. Several `updated_at` values are later than Phase 2A; the original attributes must be checked separately. **Every row is “candidate requiring owner confirmation.”** None is independently historically verified; no direct conflict with E2 was detected. The synthetic fixture is classified **synthetic/test-only as a source**, not as proof about these E1 rows.

| Alias | Exact UUID | E1 name / base unit | E1 line | Classification |
| --- | --- | --- | ---: | --- |
| M1 | `0e0939e8-5e5a-462d-95aa-caa834531a14` | White Rice | 759 | Candidate |
| M2 | `28cef5f3-b549-4d6a-9e39-61b1cf6f3e11` | Sinigang na Baka | 749 | Candidate |
| M3 | `36cf63ad-47bd-40d7-8239-0922769013d4` | Kare-Kare | 751 | Candidate |
| M4 | `3c78b355-2613-4f5b-af4d-ac2197d957fe` | Softdrinks | 755 | Candidate |
| M5 | `54cd08a0-e6fd-4d60-84f4-04fb9be8be44` | Pinakbet | 752 | Candidate |
| M6 | `79dc274a-b608-4ff8-b14a-c8f9b1effb4f` | Adobong Manok | 758 | Candidate |
| M7 | `a23b01b5-1c32-443e-9d3e-cbff54040aed` | Fried Rice | 753 | Candidate |
| M8 | `bf931531-0d32-4092-ae0e-448e40d5aaca` | Crispy Beef Tadyang | 747 | Candidate |
| M9 | `e2cd2cd2-1d5d-4a64-83fc-0c7b8efc0e9c` | Buko Juice | 756 | Candidate |
| M10 | `eda59cc3-eb0a-4090-80ef-1788229d619a` | Chicken Bicol Express | 760 | Candidate |
| I1 | `002ed07e-3cd8-4b36-b2b6-bad61e8a5579` | Coconut Milk / L | 550 | Candidate |
| I2 | `07e2a344-1d50-4453-b8b9-7f3a17251e5a` | Beef / kg | 551 | Candidate |
| I3 | `29c32f11-aaff-4e87-a781-4f4723924e41` | Cooking Oil / L | 547 | Candidate |
| I4 | `37401723-e5ca-4664-acad-d58281c61d15` | Soy Sauce / L | 554 | Candidate |
| I5 | `3a13849a-eb71-4806-8451-a0f3887746b1` | Vinegar / L | 555 | Candidate |
| I6 | `4271eea5-2c8a-413d-9d56-7fe47107f272` | Mixed Vegetables / kg | 548 | Candidate |
| I7 | `617cf643-6691-4710-834d-b9e9713d2bb9` | Buko Juice / bottle | 553 | Candidate |
| I8 | `7f9f25fd-6d1c-4177-8516-043d06f778a4` | Softdrinks / bottle | 539 | Candidate |
| I9 | `a3355239-1a21-4459-b80d-a174164872b9` | Rice / kg | 546 | Candidate |
| I10 | `b22e76f0-5e37-4228-9d21-9196b5ea93cd` | Peanut Butter / kg | 549 | Candidate |
| I11 | `b467aeba-d158-4c6d-b43b-1b71a60910c4` | Chicken / kg | 556 | Candidate |
| I12 | `d6d69f5e-00bf-4487-a1f8-f3fa5fe63bd8` | Sinigang Mix / pack | 552 | Candidate |

For **each row**, the minimum additional evidence is an original dated menu or inventory/import/intake record plus an accountable owner's confirmation of the exact ID link, name, unit, original status and later edits. If a business document lacks UUIDs, engineering must separately reconcile the identifier. The later Phase 6B.2 migration requires exactly one `Chicken` item with base unit `kg`; E1 has that candidate, but the requirement does not authenticate it. `secondary_unit = pcs` in later E1 is observational and supplies no fixed kg/pcs conversion.

**Additional parent dependency:** each required menu row has a non-null `category_id`, and the initial schema's `menu_items_category_id_fkey` requires a `menu_categories` parent. The ten candidate menus reference five distinct category UUIDs: `0b632447-9b6d-4b15-8c75-cbe534240173`, `072d2c46-21be-4461-aa60-958a88069c07`, `b87ae32d-5b2e-43b1-9083-d53d01027799`, `69ddc6b1-5967-4def-b4dd-843620523d06`, and `d37940ae-086f-4930-8358-f93a72329185`. E1 contains matching candidate category rows; the preceding migrations have no category insert. Their names and owner-review fields are in [Document A](M3-2C-A-OWNER-APPROVAL-PACKAGE.md). They too lack independently approved original provenance. The current `validate-provenance.mjs` checks the 22 recipe-referenced IDs and recipe digest, **not** these five parent records. A valid validator response alone would not make a bootstrap FK-complete.

## Eighteen mapping results and confidentiality

A read-only comparison extracted the 18 ordered E2 tuples and E1's 28 `menu_ingredients` rows. **18/18 required pairs exist, 18/18 numeric amounts match, 10/10 referenced menu IDs and 12/12 referenced inventory IDs exist in E1.** E1's required mapping dates are September 4; those are later-export row claims. No original recipe card, unit/yield conversion, owner attestation or original-version history was established. The ingredient base units are kg, L, bottle or pack as recorded in E1; no fixed conversion is inferred from a secondary unit or packaging label. These are **candidate mappings requiring confidential owner review**, not historically verified recipes.

No pair or quantity is copied into this report. The [owner package](M3-2C-A-OWNER-APPROVAL-PACKAGE.md) defines an owner-controlled local review of R1–R18 and a hash-only attestation path. The existing Phase 2A source itself contains recipe details; previous ordinary QA drafts had reproduced associations. Those two QA pair tables were removed in M3.2C-A, but underlying repository/source access still requires an owner/security access decision. The inherited `CodexSandboxUsers` read rule on the local backup was previously found; no ACL was changed. **Confidential distribution is not yet established** by these edits alone.

## Opening stock and Phase 2A coverage

The [read-only reconciliation](M3-2C-A-OPENING-STOCK-RECONCILIATION.md) traces all three early Rice transactions and the Manager-profile link. E1 has zero formal opening-balance rows. A +20 kg `receiving` labeled “Opening stock” and offsetting +2/−2 kg adjustments reconcile arithmetically to 20 kg in this three-row sequence. They have no purchase-order item, batch, formal opening-balance ID or original document. A positive historical opening count, a real zero balance, and the reason for the adjustments are **unknown**. The owner sheet offers a sourced physical record, explicitly replay-only zero assumption, defer, or separately reviewed reconstruction. No option was selected.

The prior clean replay failed at Phase 2A on SQLSTATE `23503` because its unchanged insert needs the 22 missing master IDs. A reviewed pre-Phase-2A bootstrap would also need **five approved category parents inserted first**, followed by correct approved menu/inventory rows, in a new unlinked environment. The candidate E1 coverage is sufficient only for structural planning. It is **not** authorization to insert E1 rows or proof a full replay will pass. A later migration additionally requires one Chicken/kg row; the current candidate covers its identity. The known later unqualified `cashier_shift_status` return fields and hosted/local function/ACL provenance differences remain outside this owner approval and require separate engineering resolution. No disposable replay was run because approved historical rows and an owner stock decision are absent; synthetic records would not advance this gate.

## Approval materials and validator boundary

The [owner package](M3-2C-A-OWNER-APPROVAL-PACKAGE.md) contains Documents A–E, a separate decision register, recipe-confidential review instructions and a **non-operative manifest field plan**. It is unsigned. No private manifest JSON or baseline files were created: there is no owner-approved source and the previously identified backup ACL is too broad to claim a protected destination. `validate-provenance.mjs` expects two private hashed JSON baselines and an approved `historical-bootstrap` manifest; if valid it returns only `REVIEW_REQUIRED`, followed by human source and SQL review. Do not encode owner option C or D as a false accepted zero/physical decision.

| Required check | Result | Basis |
| --- | --- | --- |
| 22 identity references accounted for | **PASS** | Exact E2 UUIDs match E1 correct master tables and table above. |
| 18 mappings accounted for | **PASS** | Exact pair and numeric comparison, no mismatch; historical approval separate. |
| Source-file hash verification | **PASS** | E1, E2, E3 and manifests recalculated. |
| Historical provenance assessment | **PASS — assessment; BLOCKED — independent verification** | Later copy/simulation separated; no original approval. |
| Recipe confidentiality protection | **BLOCKED for controlled distribution** | No new relationships/amounts in ordinary QA; prior pair tables removed; source and inherited backup access still need owner/security review. |
| Three early movements investigated | **PASS — export trace; BLOCKED — original documentation** | IDs, units, amounts, timestamps, actor role and absent links documented. |
| Opening-stock evidence assessed | **PASS — assessment; BLOCKED — original count/decision** | Zero formal rows; 20 kg recorded chain is not independently proven. |
| Owner review package prepared | **PASS** | Unsigned A–E and decision register. |
| Actual owner approval received | **BLOCKED** | No accountable signature or source approval. |
| Private manifest draft prepared | **BLOCKED** | Non-operative field plan ready; protected approved JSON cannot yet be populated truthfully. |
| Phase 2A prerequisite coverage | **BLOCKED — authorized replay** | 22 recipe IDs and five category parents are candidates in later copy; no approved bootstrap or clean replay. |
| Release-preflight safeguards | **PASS** | `preflight-self-test.mjs` exit 0; `validate-provenance.mjs` without private manifest exit 1 `BLOCKED`; no script changed. |

**Smallest next action:** the restaurant/stock owner reviews [the package](M3-2C-A-OWNER-APPROVAL-PACKAGE.md) against original records in a controlled session, decides each of the 22 identities and five parent categories, reviews R1–R18 recipe mappings by exact digest, and selects a documented opening-stock option. Provide only evidence identifiers/hashes and signed scope to engineering; keep confidential recipe material owner-controlled. Until then, the historical-bootstrap manifest cannot be approved and the Phase 2A replay remains blocked.

**Files added:** this report, `M3-2C-A-OWNER-APPROVAL-PACKAGE.md`, `M3-2C-A-OPENING-STOCK-RECONCILIATION.md`. **Existing scoped QA files redacted:** `M3-2A-EVIDENCE-DISCOVERY-20261018.md` and `M3-2B-OWNER-REVIEW-DRAFT-20261018.md` (pair tables removed). The principal other sources inspected were the reports named in the directive, E1–E4, Phase 2A and Phase 6B.2 SQL, `validate-provenance.mjs`, `preflight-self-test.mjs`, `check-release-preflight.mjs` and the provenance approval contract. No unrelated module file was changed.
