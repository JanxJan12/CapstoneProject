# RRJ's Food-House — historical inventory owner review

**UNSIGNED / PENDING APPROVAL.** Project `RRJS-Foodhouse-Final` (`zhzluhqvysvsadwuugpa`). This package asks the accountable restaurant owner to confirm what the original records support so engineering can consider a clean *isolated* replay. It authorizes no hosted stock change, recipe publication, migration deployment, or data insertion. The October 13 export is a later copy, not proof of what was originally approved.

## A. Menu and inventory verification

The 22 records below are required because an old database change references their exact IDs. They exist in the October 13 export, but we have not found an independent original menu, inventory import, intake sheet or owner approval proving their identity and attributes before Phase 2A. Please compare the names, units and IDs with an original dated source, or mark a record uncertain. The exact UUIDs appear by alias in the [earlier review draft](M3-2B-OWNER-REVIEW-DRAFT-20261018.md). All rows are **candidates requiring owner confirmation**; none is historically verified or newly classified as conflicting.

| Alias | Recorded name in later export | Recorded unit | Original source/record date and decision |
| --- | --- | --- | --- |
| M1 | White Rice | menu item | ______ |
| M2 | Sinigang na Baka | menu item | ______ |
| M3 | Kare-Kare | menu item | ______ |
| M4 | Softdrinks | menu item | ______ |
| M5 | Pinakbet | menu item | ______ |
| M6 | Adobong Manok | menu item | ______ |
| M7 | Fried Rice | menu item | ______ |
| M8 | Crispy Beef Tadyang | menu item | ______ |
| M9 | Buko Juice | menu item | ______ |
| M10 | Chicken Bicol Express | menu item | ______ |
| I1 | Coconut Milk | L | ______ |
| I2 | Beef | kg | ______ |
| I3 | Cooking Oil | L | ______ |
| I4 | Soy Sauce | L | ______ |
| I5 | Vinegar | L | ______ |
| I6 | Mixed Vegetables | kg | ______ |
| I7 | Buko Juice | bottle | ______ |
| I8 | Softdrinks | bottle | ______ |
| I9 | Rice | kg | ______ |
| I10 | Peanut Butter | kg | ______ |
| I11 | Chicken | kg | ______ |
| I12 | Sinigang Mix | pack | ______ |

The later export's recorded menu `created_at` date is August 16, 2026; inventory `created_at` date is August 31, 2026. Some `updated_at` values are later than Phase 2A, so current names, units or statuses cannot automatically be projected backward. For each record, confirm the original name/unit/status, whether it was edited later, the source custodian and date, and whether the exact UUID is traceable. A printed menu or purchase sheet without UUIDs can support business identity but still leaves the database-ID link for engineering to reconcile. Evidence reference(s): ______. Decision per row: approve / reject / defer, recorded privately by alias.

**Five required parent categories also need confirmation.** The ten menu records reference these non-null category UUIDs, and the schema enforces a foreign key. E1 contains candidate rows with the same recorded August 16 creation date, but no original category source or approval was found. They are additional prerequisites beyond the 22 recipe-referenced identities.

| Category alias | Candidate UUID | E1 name | Original source/date and decision |
| --- | --- | --- | --- |
| C1 | `0b632447-9b6d-4b15-8c75-cbe534240173` | Viands | ______ |
| C2 | `072d2c46-21be-4461-aa60-958a88069c07` | Soups | ______ |
| C3 | `b87ae32d-5b2e-43b1-9083-d53d01027799` | Vegetables | ______ |
| C4 | `69ddc6b1-5967-4def-b4dd-843620523d06` | Rice | ______ |
| C5 | `d37940ae-086f-4930-8358-f93a72329185` | Beverages | ______ |

## B. Confidential recipe mapping review

The old [Phase 2A SQL](../supabase/migrations/20260904000000_inventory_phase_2a_recipe_deduction.sql) contains 18 exact menu-to-ingredient relationships and numeric amounts. The later export contains the same 18 pairs and amounts. This proves internal consistency of later files, **not** that the restaurant approved the original recipes or units. No recipe quantity or pair is reproduced in this package.

An authorized owner may inspect the existing SQL and later export **locally in a restricted owner-controlled session**; the current backup directory's inherited group-read ACL must be reviewed before treating that file as protected. Do not email, paste into chat, upload to an external service, or commit a duplicate recipe sheet. If a private copy is needed, first select an owner-controlled restricted location and verify its access. The owner can compare each R-number with the original recipe card or approved formula, including kg/L/pack/bottle basis, preparation yield and conversions. The later export has no verified recipe-conversion source; do not assume that a pack, bottle or piece converts to kg/L by the numeric amount alone. A menu/ingredient association is sensitive even without its numeric amount.

The ordered 18-tuple SHA-256 is `5d2551ee51d124346edc2bd884dce035f7234b9906f74b1385c9b9cbd8ba7677`; Phase 2A file SHA-256 is `F06983ED7E9BA60F48654F8DF97F177FF8802A0C74297300B851B0226180A5D0`. These hashes bind the review scope. R1–R18 are the SQL tuple order; source lines 15, 20, 25, 32, 37, 44, 49, 56, 61, 66, 73, 80, 85, 92, 97, 104, 111 and 118 locate them. Record a private per-R decision and any exception, then sign **only the approved hash and scope** in the register below. A digest does not itself show that a human compared the content.

Recipe reviewer identity/role: ______  Original recipe source/date: ______

R1–R18 privately checked (list exceptions by alias only here): ______

Decision: ______ approve exact digest / ______ reject / ______ defer. Conditions: ______  Date: ______

## C. Opening-stock decision

The export has **no formal opening-balance rows**. Its first three recorded movements are all Rice: +20 kg labeled “Opening stock”, then +2 kg and −2 kg labeled “Physical count correction.” The arithmetic returns to 20 kg, but no linked purchase document, stock sheet, batch or formal opening-balance record was found. The [reconciliation sheet](M3-2C-A-OPENING-STOCK-RECONCILIATION.md) gives exact transaction IDs, dates, actor role, source lines and four owner options. Review a genuine count or explicitly approve a limited zero-opening replay assumption; neither decision may overwrite hosted stock. Decision/conditions/evidence ID: ______.

## D. Isolated historical-bootstrap authorization

If the owner approves exact IDs, the five parent categories, original attributes, recipe digest and an opening-stock decision, engineering can **propose** deterministic master-data inserts before Phase 2A in a newly named, unlinked disposable database. The old migration text and hosted migration ledger stay unchanged. Engineering must independently review foreign keys, the one Chicken/kg identity, insertion order, later enum compatibility and a pristine replay. No approved decision here authorizes any SQL execution or hosted deployment. Scope authorized, if any: ______. Exclusions and expiry: ______.

## E. Approval register and evidence references

| Separate decision | Approver/role | Source reference and SHA-256 | Approve / reject / defer; date; conditions |
| --- | --- | --- | --- |
| Ten menu IDs and original attributes | ______ | Original source: ______; October 13 candidate E1 | ______ |
| Five required menu-category parent IDs | ______ | Original source: ______; E1 category rows | ______ |
| Twelve inventory IDs, units and original attributes | ______ | Original source: ______; E1 | ______ |
| Eighteen confidential recipe mappings and unit/conversion basis | ______ | Original recipe: ______; Phase 2A hash and tuple digest above | ______ |
| Opening stock or replay-only assumption | ______ | Original count/reconstruction or decision ID: ______ | ______ |
| Restricted private baseline files and bootstrap scope | ______ | Two file hashes and manifest digest: ______ | ______ |
| Engineering SQL/replay review | ______ | Proposed SQL hash, target and evidence: ______ | ______ |

Candidate E1 is `%LOCALAPPDATA%\RRJ-Private-Backups\Supabase-20261013-062110\data.sql`, SHA-256 `9FD18E166AAEF422F5BF8B7B6178642B1D7D02E61148D984EC29A9B1EF65B114`. The independent original-source fields remain blank. The companion `public-only-data.sql` is a derivative same-row copy; a simulation fixture is excluded. The owner should supply only the minimum original records needed, via a channel they control; engineering can record hashes and conclusions without copying confidential formulas into QA.

### Non-operative private manifest plan

No private JSON manifest was created: source approval and a suitable protected destination are missing. When authorized, prepare it **outside the repository and synced mirror**, with `schemaVersion: 1`, `environment: "historical-bootstrap"`, `phase2aSha256` as above, three confined relative baseline files (`kind: "category"`, `"menu"`, and `"inventory"`, each with actual `path` and `sha256`), and an `approval` object with `approved`, owner, approval date, original-source description, `categorySourceDescription`, the ordered recipe digest, `openingStockDecision` and `openingStockEvidenceId`. It must cover all exact recipe IDs and each menu row's category parent; the inventory baseline must identify exactly one Chicken/kg row. The updated validator checks category FK coverage and file hashes, but **does not prove the historical identity or business correctness** of the five candidate categories. Their original source and exact attributes still require human review before bootstrap. The current validator recognizes only `approved-zero` or `approved-physical-record`. If the owner chooses defer or reconstruction, keep the gate blocked and review how to represent that decision; never encode it as a false approval. Even a valid manifest yields `REVIEW_REQUIRED`, then human source and SQL review.

**Overall owner decision:** ______ approve scoped historical review / ______ reject / ______ defer

Restaurant owner name/role: ______  Date: ______  Evidence reference(s): ______  Limitations: ______

Engineering reviewer name/role: ______  Date: ______  Conditions: ______

**All fields are deliberately blank. Silence is not approval.**
