# RRJ’S FOOD-HOUSE — clean database reproducibility engineering

**Date:** 2026-10-13 (Asia/Manila)  
**Decision:** **NO-GO.** The untouched 48-file migration chain still fails on an empty database. The local code and test fixes below passed on a separate, explicitly synthetic diagnostic stack; its 49 recorded versions do not establish a canonical clean replay.

## Provenance and clean replay

- New unlinked local stack: `C:\Users\Janmari\Downloads\RRJ-RC-Clean-20261013-1`, port 62321/62322. Its 48 copied SQL files matched canonical source, including the historical enum file. **FAIL** at `20260904000000_inventory_phase_2a_recipe_deduction.sql`, statement 0, because the recipe insert references historical menu and inventory UUIDs absent from the preceding migrations. The CLI stopped that failed startup; no volume for this new failed stack remained in the final volume listing. No manual cleanup was run.
- `supabase/seed.sql` does not exist. No source-controlled, business-approved master-data baseline was found. The recipe migration embeds 18 mappings over 10 menu identities; `20260923000000_inventory_po_semantics_foundation.sql` requires exactly one `Chicken` item with unit `kg`. Neither the identities, recipes, nor opening stock can be inferred from the hosted row counts or a synthetic fixture.
- The two unqualified `cashier_shift_status` return fields in `20260914000000_harden_numeric_inputs.sql` are a later independent blocker. A function's `SET search_path` does not qualify types in its `RETURNS TABLE` signature. Canonical historical SQL remained unchanged (SHA-256 `2032B4799A197E95292179F264AF47726B758F82453A08AEB2F0464D2B4200FC`). The copy-only qualification has SHA-256 `B6974B357403D63555DD96FD1A5F5D3441E3DC0A54856C4ECE6B0C4B39D4B83F`. This is a **diagnostic compatibility edit**, not an approved rewrite of an applied migration.
- Prior October 13 read-only evidence recorded 46 hosted versions ending `20261012181744`; `20261013000302` and `20261013053159` were pending. No hosted query or change was made in this run, so their present hosted state is **NOT REVERIFIED**. The encrypted recovery archive was present locally (2,739,138 bytes); its independent off-device copy and restore from that copy remain **UNVERIFIED**. No backup bytes, credentials, or proprietary business formulas were copied into source.

## Local changes

| File | Change and reason |
| --- | --- |
| `supabase/config.toml` | Declares `payment-proofs` and `delivery-proofs` as private local Storage buckets with 5 MiB image limits. Existing `storage.objects` role/ownership policies still control access. |
| `supabase/tests/verify_source_neutral_receiving_posting.sql` | Adds Manager emergency provenance to each new unlinked Production fixture. Direct-supplier and historical checks remain. |
| `supabase/tests/verify_manager_receiving_draft_authoring.sql` | Creates the Production draft through the Manager emergency RPC before exercising draft edits, posting, and denial cases. |
| This report | Records the clean blocker, copied-stack variants, tests, and release limits. |

No canonical migration body, Rider source, hosted environment, pre-existing volume, Auth/Storage backup, or business opening balance was edited. The pre-existing dirty checkout was preserved.

## Diagnostic replay and executed checks

The second new unlinked stack is `C:\Users\Janmari\Downloads\RRJ-RC-Repro-20261013-1`, port 61321/61322. It copied all 48 canonical migrations, inserted the **synthetic diagnostic only** `20260903180000_phase8_test_historical_master_data.sql` from the prior local experiment (SHA-256 `57D22174104C0DA33DF06E51CDE404BA9BF881500D83A95F5CF6AAEEA75F257D`), and qualified two enum fields only in its copied migration. It recorded **49 versions**, through `20261013053159`. The copied final policy and canonical source share SHA-256 `EBE0B2C02F3035602D5544B5EC024FE5FCFB2F58FA4CDAB2C9784305CCA058EE`; the installed guard contains `new.emergency_authorized_at := now()`. This proves versioned installation and server-clock source identity on the diagnostic stack, not an untouched clean replay.

After testing, only this new diagnostic stack was stopped without `--no-backup`. Its config, database, and Storage Docker volumes remained present. Earlier local stacks and volumes were not stopped or cleaned.

| Test | Result | Boundary |
| --- | --- | --- |
| Local bucket provisioning | **PASS** | Both buckets created with `public=false`, 5,242,880-byte limits and expected image MIME lists. The existing five relevant object policies remained. A synthetic payment object was unavailable on the public route and to an anonymous private read. |
| Updated source-neutral and draft-authoring SQL verifiers | **PASS** | Both executed in trusted local PostgreSQL transactions and rolled back. Production receipts now carried Manager emergency evidence; direct-supplier behavior remained covered. |
| Policy, Phase 7B legacy, and Manager request security SQL verifiers | **PASS** | Policy verifier covered normal/Cashier denial, Manager emergency, accepted-only posting, duplicate retry, direct-supplier posting, and source labels. Legacy verifier passed in rollback-only mode. Security verifier reported 8 anonymous RPC denials, 4 RLS table checks, and 12 role/RPC denials. |
| Authenticated Manager request and split Receiving | **PASS** | GoTrue/PostgREST: two partial reports, accepted 6 then 2, cumulative overage rollback, serial and concurrent duplicate denial, shortfall closure, separate full reconciliation, and accepted-only batch/ledger stock. |
| Manager emergency and role denials | **PASS** | Signed-in Manager exception/evidence succeeded; Cashier emergency and evidence, normal unlinked draft, and authenticated legacy creation were denied. |
| Customer → payment → Cashier → KDS → Rider | **PASS local API/Storage** | Same diagnostic database, synthetic identities and proof bytes. Order/payment replay, private upload, Cashier verification, KDS transitions, Rider proof/delivery, and final joins passed. A zero-stock first attempt and a copied harness's invalid anonymous JWT caused test setup failures; local-only opening stock via `initialize_inventory_opening_balance` and `ANON_KEY` corrected the diagnostic harness. Those failed attempts left synthetic rows in the preserved local volume. |
| Sampled integrity | **PASS** | Zero negative item/batch stock, zero accepted posted lines without a batch, zero delivered assignments missing a proof path. |
| Web typecheck/build; Rider typecheck/tests | **PASS** | Web TypeScript and Vite build passed; Rider TypeScript and 8/8 unit tests passed. |
| Rendered browser, Google OAuth, authenticated Android device | **NOT TESTED** | This run exercised API/Storage only. Prior browser and APK evidence remains prior evidence. |
| Untouched canonical 48-file replay | **FAIL** | The historical recipe FK remains the first failure. The diagnostic success must not be called a clean canonical pass. |

## Approved-baseline gate and migration-history-safe path

1. Obtain client approval for a separately controlled historical master-data baseline that supplies the exact menu and inventory UUIDs referenced by the recipe migration and exactly one `Chicken`/`kg` item before `20260904000000`. Reconcile the existing 18 recipe quantities against approved business formulas. Record source, approver, date, and checksums. Do not source this from hosted business rows merely because they exist. Opening stock must be zero or separately supported by a physical, approved opening record; the diagnostic opening RPC quantity is not that record.
2. Keep the 46 already-applied migration bodies immutable. Review and approve a deployment-specific bootstrap/compatibility plan for new empty environments, including where the approved baseline is loaded and an explicit two-field enum qualification. Record the variant SQL hashes and resulting migration history. The current copied variant is diagnostic only. Avoid claiming that an added post-September migration can repair an earlier failed function signature.
3. On a newly named unlinked stack, replay the approved plan from an empty database, inspect all recorded versions and source hashes, then repeat the SQL and authenticated API/Storage tests. Keep the approval and fixture manifest outside this repository if it contains business master data. Only this later run can support an approved clean deployment claim.
4. Before any hosted proposal, verify an independent encrypted off-device database **and private Storage-byte** recovery set, user-held decryption access, and isolated restore; privately verify rotation of the disclosed PostgreSQL password. Reconcile hosted migration/ACL state read-only. Obtain separate explicit approval for each named hosted change. Browser, Android, OAuth, operational approval, and dispatch/acknowledgement evidence remain release gates.

## Rollback and preservation

The local source change is reversible by restoring only the three files in the change table to their reviewed prior contents; do not reset or clean the dirty checkout. The new local buckets contain diagnostic private objects, so preserve their Docker volumes and bytes while evidence is needed. No hosted rollback is applicable. A future hosted policy or Storage reversal requires a separately reviewed additive change and retention decision; do not delete historical proof or emergency audit data.

## October 13 continuation: complete 50-file replay

**FAIL at the first historical blocker.** A further separate disposable stack at `C:\Users\Janmari\Downloads\RRJ-Migration-Replay-20261013-50` copied the then-current **50** canonical migration SQL files. SHA-256 comparison confirmed all copied SQL matched source. Its own config alone used ports `63321`/`63322` and related nonconflicting ports. Supabase CLI 2.120.0 `start` failed at `20260904000000_inventory_phase_2a_recipe_deduction.sql`, statement 0, SQLSTATE `23503`: `menu_ingredients_inventory_item_id_fkey` references missing inventory item UUID `b467aeba-d158-4c6d-b43b-1b71a60910c4`. The CLI stopped only this new stack. The preserved local database at `127.0.0.1:56321` was not reset, and no hosted Supabase operation occurred. Later pending migrations, including `20261013105400_customer_modifier_completion.sql`, are **NOT TESTED by a complete untouched replay** because execution stopped at the first failure. Historical migration bodies were not rewritten.
