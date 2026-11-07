# Restore drill — 2026-10-14

**Result: PASS for a narrow synthetic local drill; broader disaster recovery BLOCKED.** The source `RRJ-Recovery-20261014-Source` and target `RRJ-Recovery-20261014-Target` are new, separately named, unlinked Supabase stacks on loopback ports 65321/65322 and 64321/64322. Existing local stacks and hosted project `zhzluhqvysvsadwuugpa` were untouched. The private synthetic bundle is outside the repository at `C:\Users\Janmari\Downloads\RRJ-Recovery-20261014-Synthetic-Bundle`.

## Execution and measurements

`node scripts/recovery/local-synthetic-drill.mjs` created one synthetic Auth identity, one `public.recovery_probe` row with a live foreign key to `auth.users`, one private `payment-proofs` bucket, and one tiny synthetic object. It exported PostgreSQL table schema and selected Auth/application data, downloaded the actual object bytes, wrote SHA-256 evidence, restored into the distinct target, and verified password sign-in and private read denial to an anonymous request. This script is intentionally fixed to these local stack names and refuses an unexpected API URL.

| Check | Source | Target | Result |
| --- | ---: | ---: | --- |
| `auth.users` | 1 | 1 | PASS |
| `auth.identities` | 1 | 1 | PASS |
| linked application rows | 1 | 1 | PASS, zero orphan FK |
| `storage.objects` | 1 | 1 | PASS |
| object bytes SHA-256 | `1e5a04135a746730eb3c5e3b847715bb260034730fc6c060b8c44d68595e822d` | same | PASS |
| password sign-in | succeeded | succeeded | PASS |
| anonymous private read | — | denied | PASS |

Measured backup phase: **8,929 ms**; restore and comparison phase: **1,640 ms**; total: **10,569 ms**. The completed drill recorded **zero failed steps**. Setup attempts first failed on a copied config parse and then an invalid port above 65535; a minimal config and valid target port resolved both before the measured drill. These setup issues are documented rather than erased.

The follow-on `node scripts/recovery/complete-local-storage-drill.mjs` completed in **7,125 ms**. It added one synthetic object each to `delivery-proofs` and `rider-documents` on the same source and target stacks. Both new object hashes matched after download and restore, anonymous reads were denied, and source/target metadata counts matched **1/1 in each of all three private buckets**. This extends byte and privacy coverage to the three bucket types; it does not turn the three synthetic objects into proof for the 30 hosted objects.

The drill used three synthetic objects and selected Auth/application tables. It did not restore a full restaurant database, 30 hosted private files, actual OAuth provider settings, every RLS policy, trigger, RPC, extension, or the 46-row hosted migration history. Those checks are **NOT TESTED in this drill**. The bundle remains local and is not encrypted because it contains synthetic data only. It is not an off-device hosted backup.

## Recovery acceptance still required

For a real recovery set, run `node scripts/recovery/verify-bundle.mjs <private-manifest.json>` against the extracted **off-device** archive. The manifest must identify roles, schema, data, managed Auth/Storage metadata, catalog supplement, migration ledger, all three private buckets, and every object byte. Then restore from that copy to another new stack and compare source/target counts, relationships, hashes, Auth sign-in, private access, grants, RLS, triggers, extensions, and migration history. `node scripts/recovery/self-test.mjs` passed a valid synthetic manifest and rejected corrupted bytes and path traversal, but it does not certify any hosted bundle.

Rollback: the drill made no hosted change. Retain the synthetic bundle and both local volumes while evidence is reviewed; deleting only these newly named resources is a later retention decision. Never reset the preserved `isolated-stack` or business volumes as drill cleanup.
