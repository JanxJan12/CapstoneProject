# RRJ’S FOOD-HOUSE database stabilization and recovery validation

Date: 2026-10-13 (Asia/Manila)  
Hosted project: `zhzluhqvysvsadwuugpa` (`RRJS-Foodhouse-Final`)  
Decision: **NO-GO for production change or release until the approvals and gates below are met.**

## Scope and safety

This audit used the canonical Capstone repo, standalone Rider repo, existing private backup, a read-only connection to the hosted Supabase project, and disposable local Docker databases. The hosted database received **no writes, migrations, or QA data**. The pre-existing dirty worktree and original backups were preserved. The ChatGPT project mirror under `.codex\.chatgpt-projects\...\sources` was not modified. The user confirmed a password rotation after an earlier disclosure, then shared a password in chat again. **Treat that disclosed value as compromised and rotate it privately before hosted work.** The value is not recorded in this report or local test material.

Private recovery files remain under `%LOCALAPPDATA%\RRJ-Private-Backups`. This report contains no Auth payload, Storage object contents, passwords, API keys, or private object paths.

## Confirmed hosted findings

| Priority | Finding and evidence | Disposition |
| --- | --- | --- |
| P0 | A database password was disclosed in chat again after the previously confirmed rotation. | Rotate it to a new private value before any hosted maintenance; do not share the replacement in chat. |
| P1 | PostgreSQL 17 catalog grants `authenticated` **MAINTAIN** on `public.cashier_shifts`, `public.cashier_transactions`, and `public.riders` (`authenticated=rm/postgres`). These are broader than application read access. | Prepared narrow `REVOKE MAINTAIN` migration; proved locally that it removes all three MAINTAIN grants while preserving three SELECT grants. Hosted application requires approval. |
| P1 | The backup's public schema/data plus managed Auth/Storage data do not themselves capture the hosted `auth.users` profile trigger, eight Storage object policies, or effective public ACLs. A fresh Supabase stack has different defaults. | Captured definitions read-only into the private rehearsal supplement and restored them **locally**. Extend the protected recovery set before relying on it for a disaster restore. |
| P2 | Supabase Auth advisor reports leaked-password protection disabled. | Review and approve enabling the hosted Auth setting; this is a separate production change. |
| P2 | Remote migration version `20261012181744` and local source filename `20261011120154` differed even though the SQL body matched exactly (MD5 `497300ed776f4a0631ec4024cc7fa7cf`, excluding terminal newline). | Renamed the local untracked file to the remote version. Local and remote histories now align through the 46 applied migrations; one new ACL migration is intentionally pending. |

The current hosted integrity audit found **no row-level corruption** in the checked business relationships: 34 public tables all have RLS enabled; 8 Auth users and 30 Storage object metadata rows exist; 45 orders, 27 payments, 26 cashier transactions, 14 delivery assignments, 43 inventory transactions, and one posted Receiving report were present. Checked orphan relationships across Auth/profile, orders/payment/cashier/delivery, request/receipt/items/batches/allocations; negative item/batch stock; receipt batch quantities; ledger arithmetic; and cashier payment/order links. All returned zero discrepancies. One unvalidated constraint belongs to managed `realtime.messages` (`messages_payload_exclusive`); it is not evidence of an application data failure.

The security advisor also reported 24 RLS-enabled tables without policies, four anon-executable security-definer functions, and 71 authenticated-executable security-definer functions. Many workflows deliberately use RPC authority; these counts alone do not prove exposure. Performance advisor counts were 22 unindexed foreign keys, 13 `auth_rls_initplan` warnings, 17 unused indexes, and five multiple-permissive-policy warnings. These remain review items, not asserted integrity defects.

## Recovery validation

The existing backup `%LOCALAPPDATA%\RRJ-Private-Backups\Supabase-20261013-062110` has `roles.sql`, `schema.sql`, `data.sql`, the custom `managed-auth-storage-data-retry.dump`, and 30 original private Storage files. The existing manifest's 34 entries were verified: four database/managed backup files by direct SHA-256 and 30 Storage originals by SHA-256 multiset. The prior encrypted `RRJ-Recovery-20261013.7z` remains in place; it was previously tested with 7-Zip AES/password, **not retested in this run**. There is still **no independent off-device copy**.

A plain `supabase/postgres` container lacked the managed Auth/Storage schema shape needed by this backup, so that first non-networked experiment is only a partial recovery. The completed rehearsal used an isolated local Supabase stack at `127.0.0.1:56321`, with its own PostgreSQL 17 database and **no hosted project link**:

1. Bootstrapped the managed Auth/Storage services in the local stack.
2. Applied the backed-up public schema. Extracted only 34 public `COPY` blocks and sequence values from `data.sql`; the archive supplied managed data.
3. Restored 33 Auth/Storage table-data entries from the custom archive in one transaction with triggers disabled, excluding service-managed migration tables.
4. Loaded public data in one transaction with replica trigger mode to handle the four circular FK groups. This is a *rehearsal loading technique*, not a production migration.
5. Applied the hosted trigger, eight Storage policies, and effective function/table grants **to the local stack only**. These definitions are saved in `%LOCALAPPDATA%\RRJ-Private-Backups\rehearsal-20261013`, with `recovery-supplement-manifest.csv` recording file sizes and SHA-256 hashes.
6. Uploaded all 30 private objects to local Storage using their backed-up metadata. Read all 30 back through the local API and confirmed SHA-256 **30/30**. An authenticated local Manager also retrieved a policy-protected `payment-proofs` object with matching SHA-256.

Restored baseline row counts matched the hosted snapshot for Auth users (8), Storage objects (30), orders (45), payments (27), inventory transactions (43), and inventory requests (1). Local synthetic QA rows were added afterward. The rehearsal demonstrates recoverability of the sampled data and application API when missing cross-schema definitions are included; the original backup alone is not a complete one-command restore.

## Workflow and security tests

| Test | Result | Boundary |
| --- | --- | --- |
| Local Manager Auth sign-in, `get_inventory_request_register`, and Manager inventory read | PASS | Unified local Supabase Auth/RLS/PostgREST/database |
| Local Customer sign-in calling Manager request register | PASS: HTTP 403 / SQLSTATE 42501 | Unified local Auth/RLS/PostgREST/database |
| Authenticated request issue → Receiving draft → accepted-only post → stock/batch/movement/reconciliation read | PASS | `qa/recovery-auth-inventory-e2e-20261013.ps1`, isolated local stack only. Issue and draft left stock at zero; posting delivered 8/accepted 6/rejected 2 created exactly one +6 receiving transaction and batch, raised stock to 6, and set request to partially received. |
| SQL rollback-only current-workflow checks | PASS | Manager request security/documents, draft authoring, source-neutral posting, protected table ACL, Phase 7A cancellation, Phase 7B replenishment. |
| Local ACL migration reproduction | PASS | Reproduced three hosted MAINTAIN grants locally; pending migration removed three, preserved three SELECT grants. |
| Main app typecheck; Manager inventory UI completion verifier | PASS | Typecheck; 19/19 verifier checks. |
| Rider typecheck and unit tests | PASS | 8/8 Rider tests. No Android device or live dispatch proof. |
| Customer → Order → Payment → Cashier → KDS → Rider authenticated API E2E | **PASS locally** | `qa/recovery-auth-order-rider-e2e-20261013.mjs` used four freshly signed-in local roles and one KDS terminal against the same restored Supabase stack. It placed and replayed an online order, uploaded and submitted a payment proof, verified payment and recorded one cashier transaction/receipt, advanced KDS confirmed → preparing → ready, released/offered the delivery, accepted/picked up/went out for delivery, uploaded rider proof, and completed delivery. Final order/payment/cashier/assignment/history reconciliation passed. Customer cashier/rider action denial and invalid KDS credential denial passed. |
| Customer and Rider browser/device UI E2E | **NOT TESTED** | The API test does not prove rendered UI behavior, native Android installation, camera/photo capture, push/realtime notifications, or physical delivery. The local Android SDK `adb devices` check found no attached device or running emulator. |

Four older inventory foundation SQL scripts contain assertions that conflict with the current restored baseline; they were not used as evidence of a current production defect: `verify_inventory_po_foundation.sql`, `verify_inventory_master_data_foundation.sql`, `verify_controlled_foodhouse_inventory_menu_configuration.sql`, and `verify_receiving_batch_foundation.sql`. Their failures need a separate historical-fixture refresh if retained as release gates.

## Local changes made

- `supabase/migrations/20261012181744_manager_inventory_request_documents.sql`: version-aligned rename of the untracked local migration; SQL contents unchanged (SHA-256 `FEC604AA63AC3B2B55703118DFAC8858E921BC7AB1673872D15CBC4F446DE969`).
- `supabase/migrations/20261013000302_revoke_authenticated_maintain_privileges.sql`: new, reviewed pending production migration. It only revokes MAINTAIN on the three named tables from `authenticated`.
- `qa/manager-authenticated-browser-20261012/setup.mjs`: updated the executable migration filename reference.
- `supabase/tests/verify_manager_receiving_draft_authoring.sql` and `supabase/tests/verify_source_neutral_receiving_posting.sql`: corrected synthetic fixture assumptions against the current restored baseline; both pass in rollback-only runs.
- `qa/recovery-auth-inventory-e2e-20261013.ps1`: guarded loopback-only authenticated test. It creates synthetic local users and business rows in the isolated stack.
- `qa/recovery-auth-order-rider-e2e-20261013.mjs`: guarded loopback-only authenticated order-to-delivery test. It generates local-only accounts and tiny synthetic proof images in memory; it never uses a hosted password or private backup object as a fixture.

Pre-edit copies of the touched untracked files are preserved in `%LOCALAPPDATA%\RRJ-Private-Backups\rehearsal-20261013\pre-fix`. No pre-existing tracked modifications were reverted or cleaned. The local rehearsal stack was restarted for order-to-delivery validation and contains synthetic rows from iterative test runs, including two completed deliveries and some earlier incomplete synthetic attempts. Baseline counts above were checked before these writes. A follow-up local integrity check found zero negative item/batch quantities, payment/order or assignment/order orphans, or delivered assignments without proof. The local containers were **stopped without deletion** after final testing; their Docker volumes and private supplement remain available for review.

## Production decision and exact proposed actions

**NO-GO** for a production migration or release today. The newly disclosed database password must be rotated privately first. Data integrity checks were clean, and the local recovery, Inventory path, and order-to-rider authenticated API path passed. Browser/device proof and an independent off-device recovery copy remain open. The three MAINTAIN grants are a confirmed least-privilege defect.

After explicit approval for the named hosted project, apply only `20261013000302_revoke_authenticated_maintain_privileges.sql`. Then run a **read-only** verification that `authenticated` lacks MAINTAIN on the three tables, retains intended SELECT/RLS behavior, and the remote migration history records that version. Enabling leaked-password protection requires its own explicit approval because it changes hosted Auth behavior. Do not run synthetic QA writes against production.

Before claiming disaster-recovery readiness, protect an encrypted independent off-device copy of the original and supplemental recovery material, verify its checksum and restore password privately, and perform a second rehearsal from that copy. Before claiming application release readiness, validate the Customer and Rider browser/device UI on a safe environment that uses one database; the authenticated API path is already verified locally.

References: [Supabase restore to self-hosted](https://supabase.com/docs/guides/self-hosting/restore-from-platform), [database linter](https://supabase.com/docs/guides/database/database-linter), [Auth password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
