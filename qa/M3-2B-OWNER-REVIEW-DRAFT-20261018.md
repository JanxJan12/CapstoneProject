# M3.2B owner review draft — historical master data and opening stock

**Status: UNSIGNED / UNAPPROVED / NOT A BOOTSTRAP MANIFEST.** Project: RRJS-Foodhouse-Final (`zhzluhqvysvsadwuugpa`). Purpose: decide whether the October 13 local export can support a *new-environment* pre-Phase-2A historical bootstrap. This draft authorizes no data load, migration, backup export, or hosted change.

## 1. Evidence references and limitations

| Ref | Artifact | SHA-256 and role |
| --- | --- | --- |
| E1 | `%LOCALAPPDATA%\RRJ-Private-Backups\Supabase-20261013-062110\data.sql` | `9FD18E166AAEF422F5BF8B7B6178642B1D7D02E61148D984EC29A9B1EF65B114`; later public-data export containing the candidate records. Treat row timestamps as claims within the later export. |
| E2 | `supabase/migrations/20260904000000_inventory_phase_2a_recipe_deduction.sql` | `F06983ED7E9BA60F48654F8DF97F177FF8802A0C74297300B851B0226180A5D0`; unchanged 18-tuple source. Ordered tuple digest: `5d2551ee51d124346edc2bd884dce035f7234b9906f74b1385c9b9cbd8ba7677`. |
| E3 | `%LOCALAPPDATA%\RRJ-Private-Backups\Supabase-20261013-062110\backup-manifest-v2.csv` | `E46B590ED584A19EC4714498D5B3C9597820DCC3B4B94134A233E723F3D7CDD1`; current file-integrity inventory, not historical authorization. |
| E4 | `C:\Users\Janmari\Downloads\20260903180000_phase8_test_historical_master_data.sql` | `57D22174104C0DA33DF06E51CDE404BA9BF881500D83A95F5CF6AAEEA75F257D`; simulation data, **excluded as historical proof**. |

See [M3.2A discovery](M3-2A-EVIDENCE-DISCOVERY-20261018.md) for the search scope and record lineage. No independently sourced pre-Phase-2A stockroom/menu record or signed approval was identified. Names/descriptions and full recipe quantities remain in the source files for controlled owner review; this broadly accessible draft repeats only IDs, units, and mapping references.

## 2. Historical master-data attestation

In E1's `menu_items` COPY, all ten required menu identities are present; in E1's `inventory_items` COPY, all twelve required inventory identities are present. The embedded `created_at` dates are 2026-08-16 for the menu rows and 2026-08-31 for the inventory rows. The data owner must compare each recorded name, unit, status and creation history with an **independent original source**. Tick or annotate each row only after that review.

| Alias | Candidate ID | E1 unit | Original source/date and name verified by owner | Decision |
| --- | --- | --- | --- | --- |
| M1 | `0e0939e8-5e5a-462d-95aa-caa834531a14` | — | ______ | ______ |
| M2 | `28cef5f3-b549-4d6a-9e39-61b1cf6f3e11` | — | ______ | ______ |
| M3 | `36cf63ad-47bd-40d7-8239-0922769013d4` | — | ______ | ______ |
| M4 | `3c78b355-2613-4f5b-af4d-ac2197d957fe` | — | ______ | ______ |
| M5 | `54cd08a0-e6fd-4d60-84f4-04fb9be8be44` | — | ______ | ______ |
| M6 | `79dc274a-b608-4ff8-b14a-c8f9b1effb4f` | — | ______ | ______ |
| M7 | `a23b01b5-1c32-443e-9d3e-cbff54040aed` | — | ______ | ______ |
| M8 | `bf931531-0d32-4092-ae0e-448e40d5aaca` | — | ______ | ______ |
| M9 | `e2cd2cd2-1d5d-4a64-83fc-0c7b8efc0e9c` | — | ______ | ______ |
| M10 | `eda59cc3-eb0a-4090-80ef-1788229d619a` | — | ______ | ______ |
| I1 | `002ed07e-3cd8-4b36-b2b6-bad61e8a5579` | L | ______ | ______ |
| I2 | `07e2a344-1d50-4453-b8b9-7f3a17251e5a` | kg | ______ | ______ |
| I3 | `29c32f11-aaff-4e87-a781-4f4723924e41` | L | ______ | ______ |
| I4 | `37401723-e5ca-4664-acad-d58281c61d15` | L | ______ | ______ |
| I5 | `3a13849a-eb71-4806-8451-a0f3887746b1` | L | ______ | ______ |
| I6 | `4271eea5-2c8a-413d-9d56-7fe47107f272` | kg | ______ | ______ |
| I7 | `617cf643-6691-4710-834d-b9e9713d2bb9` | bottle | ______ | ______ |
| I8 | `7f9f25fd-6d1c-4177-8516-043d06f778a4` | bottle | ______ | ______ |
| I9 | `a3355239-1a21-4459-b80d-a174164872b9` | kg | ______ | ______ |
| I10 | `b22e76f0-5e37-4228-9d21-9196b5ea93cd` | kg | ______ | ______ |
| I11 | `b467aeba-d158-4c6d-b43b-1b71a60910c4` | kg; E1 name Chicken | ______ | ______ |
| I12 | `d6d69f5e-00bf-4487-a1f8-f3fa5fe63bd8` | pack | ______ | ______ |

**Owner attestation questions:** What original business system, signed menu, inventory intake, purchase record, or dated export establishes these IDs and attributes before Phase 2A? Who created or checked them? Were any IDs, units, names, status flags, or timestamps later edited or reconstructed? Attach private evidence references and hashes; do not substitute the simulation fixture or current stock values.

## 3. Recipe mapping review sheet

E1 has 28 `menu_ingredients` rows. The exact 18 Phase 2A menu/inventory pairs and numeric quantities all match E1; their embedded mapping dates are 2026-09-04. This is **later-copy consistency**, not independent recipe approval. Menu-to-ingredient associations are confidential too, so this ordinary QA draft records only the mapping count, ordered digest above, and R1–R18 private review scope. The authorized owner should review E2 and E1 in a restricted session, record exceptions by R-number, and attest to the exact digest without copying the formulation into QA. See the [M3.2C-A owner package](M3-2C-A-OWNER-APPROVAL-PACKAGE.md).

## 4. Opening-stock decision record

E1 contains **zero** `inventory_opening_balances` rows. It contains three recorded pre-2026-09-04 inventory movements (one receiving, two adjustments), with no `opening_balance_id` linkage. They are later-exported database history, not an independently signed physical opening count. Subsequent stock balances and the Phase 8 zero-stock fixture cannot decide historical opening stock.

- Decision (choose one only): ______ `approved-zero` / ______ `approved-physical-record` / ______ reject or defer.
- If `approved-zero`: explain why a zero opening balance is historically correct, despite recorded early movements; identify original source and accountable reviewer: ______.
- If `approved-physical-record`: identify signed count/export, date/time, item IDs/units, quantities, lot/batch/expiry treatment, and reconciliation to the opening ledger: ______.
- Required `openingStockEvidenceId`: ______.
- Unresolved conflicts or exclusions: ______.

## 5. Historical bootstrap scope statement

If and only if the owner approves the exact hashed sources and opening-stock decision, engineering may draft deterministic master-data inserts **before** Phase 2A for a newly named unlinked environment. Every already-applied historical migration body and the hosted 46-version ledger stay unchanged. The draft needs separate SQL review, a history-safe later enum compatibility plan, a pristine replay, and functional/security comparison. This form does not authorize executing a bootstrap, loading data, changing hosted, or approving M3 deployment.

The future private `historical-bootstrap` validator manifest must pin E2, separate approved menu/inventory JSON baseline hashes, the ordered recipe digest, the accountable owner/source/date, and the opening-stock decision/evidence ID. `validate-provenance.mjs` can return only `REVIEW_REQUIRED`; it cannot establish business truth.

## 6. Unresolved-item checklist and sign-off

- [ ] Independent pre-Phase-2A identity/name/unit source for each M/I row.
- [ ] Independent recipe quantity/unit source and decision for each 18-pair row.
- [ ] Any later edits, substitutions, or imports reconciled.
- [ ] Opening-stock source or supported zero decision; ledger/batch treatment.
- [ ] Private baseline files, hashes and owner-signed evidence manifest prepared outside the repository.
- [ ] Engineering reviewer checks deterministic insert order, FKs and no historical migration edits.

Data owner name/role: ______  Decision: ______ approve / ______ reject / ______ defer  Date: ______

Evidence reference(s) and signed manifest SHA-256: ______

Engineering reviewer name/role: ______  Review decision/date: ______

**Blank fields mean no approval.**
