# Database reproducibility and recovery — 2026-10-14

**Decision: NO-GO.** Hosted project `zhzluhqvysvsadwuugpa` was queried read only. No hosted migration, data write, Storage upload, or export occurred. The canonical 51 SQL files and all existing business data were preserved. This report covers recovery engineering; it does not repeat the P0–P3 architecture review.

## Migration reconciliation

The live Supabase `list_migrations` response returned **46** versions, from `20260825183637` through `20261012181744`. Comparing every version and name with the sorted repository files found no missing or extra version within those 46. This confirms ledger identity, **not** byte equality of all historical SQL bodies. The previously reconciled `20261012181744` body is documented in `RECOVERY-STABILIZATION-20261013.md`. Five repository files remain local only:

| Version and file | Repository SHA-256 | Hosted ledger |
| --- | --- | --- |
| `20261013000302_revoke_authenticated_maintain_privileges.sql` | `CBC8B54349E724EEB75796984014B33DF9F8B3EF46415647FE33F7FA02A27828` | absent |
| `20261013053159_production_delivery_policy.sql` | `EBE0B2C02F3035602D5544B5EC024FE5FCFB2F58FA4CDAB2C9784305CCA058EE` | absent |
| `20261013071937_remove_duplicate_timestamp_triggers.sql` | `5C7C4376908980F4CA5D6F88478BD45F297A7DC069940B5E374900C98A5DAE67` | absent |
| `20261013105400_customer_modifier_completion.sql` | `62FDA49A4C2D432BC8574B3B1D08F1EEFEB528772DCC1BEC8A59AB98CF8DBA46` | absent |
| `20261013162631_kds_queue_modifier_channel_v2.sql` | `0ED9253C4DE11DE4D204E18F5D056FD5331A0AC16EB9E138DE50442FC19BC9FB` | absent |

## Read-only hosted recovery inventory

On October 14, the catalog showed 34 public tables with RLS enabled on all 34, 19 public policies, 100 public functions including 83 security-definer functions, and 37 non-internal public triggers. `auth.users` has 8 rows, 11 foreign keys point to it, the remaining Auth insertion trigger is `on_auth_user_created`, and there were zero orphaned `public.profiles` rows. Installed extensions: `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`, `uuid-ossp`. Function bodies, effective grants, and every policy predicate were **not** re-audited here; a count is not permission proof.

The three Storage buckets are private: `payment-proofs` (16 metadata objects), `delivery-proofs` (11), and `rider-documents` (3). Eight `storage.objects` policies exist. Read-only joins found zero missing metadata matches for populated `payments.proof_image_path`, `delivery_assignments.proof_of_delivery_path`, and `riders.or_cr_document_path`. These joins cannot prove that the **30 actual objects' bytes** still exist or match metadata. No private path or file content is copied into this report.

The new `scripts/recovery/catalog-fingerprint.sql` ran read only on hosted. It returned 27 combined public/Storage policies and 38 public/Auth non-internal triggers, with policy MD5 `a82ed16042f006e392b203a02b01f37d`, function MD5 `5a31782c6a675ccc6850267c0cf47324`, and trigger MD5 `88040d9c5e43939ec6ebd27eb1af52cb`. These compact digests support later source/restore comparison; they are not a substitute for the encrypted full-definition supplement or a SHA-256 backup manifest.

## Implementation and test evidence

New files under `scripts/recovery/`:

- `validate-provenance.mjs`: fail-closed 51-file, Phase 2A, owner approval, baseline hash, required ID, recipe digest, and opening-stock decision gate. It never loads data or writes SQL.
- `verify-bundle.mjs`: validates required PostgreSQL/Auth/Storage/catalog/ledger components, all object byte hashes and sizes, bucket privacy, uniqueness, completeness, and safe relative paths.
- `self-test.mjs`: synthetic positive bundle plus corruption and path traversal rejection.
- `local-synthetic-drill.mjs`: fixed loopback source and target stacks; PostgreSQL dump/restore, Auth sign-in, a foreign-key-linked row, private Storage byte upload/download, and anonymous denial.
- `complete-local-storage-drill.mjs`: extends the same isolated source/target to all three private buckets, comparing actual bytes, metadata counts, and anonymous read denial.
- `catalog-fingerprint.sql`: read-only source/restore comparison of table RLS coverage, policy/function/trigger definitions, extensions, Auth foreign keys, and private bucket counts.

Commands/results: `node scripts/recovery/self-test.mjs` **PASS**; `node scripts/recovery/validate-provenance.mjs` **BLOCKED** as designed; `node scripts/check-clean-migration-prerequisites.mjs` **BLOCKED** as designed (18 recipe tuples, 10 absent menu and 12 absent inventory IDs, no seed, two later unqualified enum fields); `npm.cmd run typecheck` **PASS**; `npm.cmd run verify:quality` **PASS** (11 checks); `npm.cmd run build` **PASS**. Both dedicated drill steps **PASS** with detailed evidence in `RESTORE-DRILL-20261014.md`. None of these turns the historical blocker into a clean replay PASS.

## Secure recovery procedure and limits

Use a restricted, encrypted, client-owned destination **outside this checkout**. Capture roles, public schema/data, managed Auth and Storage metadata, migration ledger, Auth triggers, RLS policies, grants, extensions, bucket configuration, and each private Storage object byte. The Supabase CLI's ordinary roles/schema/data export is useful but filters managed internals; it cannot by itself prove a complete Auth/Storage recovery. Obtain a separately authorized managed-data export and catalog supplement. Enumerate object identities from `storage.objects` into the private destination, download every byte through an authorized read route, compare count and SHA-256 against a manifest, and fail if any path, hash, or policy is missing. Never print credentials or private paths in logs.

Archive the complete set with authenticated encryption, retain an owner-held recovery key, copy to an independent off-device location, verify archive and file hashes **from that copy**, extract in a restricted location, and restore into a separately named unlinked environment. Compare counts, foreign keys, policy/grant definitions, Auth sign-in, private access denials, object hashes, and migration ledger. Record duration and failed steps. A same-drive encrypted archive or the prior local rehearsal is insufficient for the off-device gate. [Supabase's current restore guide](https://supabase.com/docs/guides/self-hosting/restore-from-platform) explicitly treats Storage bytes and Auth provider settings as separate recovery work.

For an authorized future hosted export, use privately entered credentials and exact project identity. Do not run it against the hosted project until the destination, encryption, access, retention, and object-byte route have been reviewed. The linked connector provides read-only catalog queries, not a complete private-file backup channel. The prior local archive and local restore documented on October 13 remain prior evidence; no verified off-device copy was created today.

## Rollback and preservation

The four new scripts and reports are local files only; remove only these named files if the change is rejected. The synthetic bundle and two named drill volumes can be retained for review, or removed only after a separate retention decision. No hosted rollback exists because hosted state did not change. Never reset, clean, or replay the dirty canonical checkout to roll back these additions.
