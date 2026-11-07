# Hosted Supabase recovery verification — 2026-10-13 (Asia/Manila)

## Decision

**BLOCKED — recovery is not verified.** No database dump, Storage object-byte export, SHA-256 object manifest, or disposable local restore was created. The live Requests UI error remains. No hosted migration, SQL DDL, data mutation, Storage mutation, source edit, or Docker container operation was performed. This is not a deployment or migration GO.

## Exact source and read-only evidence

- Supabase project ID/reference: `zhzluhqvysvsadwuugpa`; connected name: `RRJS-Foodhouse-Final`; region: `ap-southeast-1`; status at inspection: `ACTIVE_HEALTHY`; PostgreSQL version: `17.6.1.147`. The canonical checkout's existing CLI project reference matches. The linked pooler address is a valid Supabase address but contains no database password.
- The connected account can run read-only SQL as the `postgres` session role through the Supabase connector. This establishes metadata inspection access, not an authenticated client connection usable by `pg_dump`, and the connector exposes no database or Storage object-byte export operation.
- At inspection on 2026-10-13 Manila time, read-only counts were 8 `auth.users`, 45 `public.orders`, 41 `public.inventory_transactions`, and 30 `storage.objects` across three buckets. Database size reported as 16 MB. Migration history still ended at `20261007082647`.
- The organization reports the Free plan. The preceding investigation's CLI backup listing found no listed physical backups and PITR disabled. These results do not establish a recoverable backup. The project's production/staging/development designation remains unknown; handle it as production-sensitive.
- The preceding investigation found `public.get_inventory_request_register()` and the request-document tables absent. The local additive request migration is still unapplied.

## Backup and restore status

| Required evidence | Result |
| --- | --- |
| Secure, client-owned destination outside the repository with confirmed encryption/access control and retention | **NOT PROVIDED** |
| Database connection authorized for logical export | **BLOCKED:** linked CLI address has no password; no database password or equivalent client authentication is available in this session |
| Custom-format or equivalent restorable database export, including public/Auth/Storage metadata, roles, RLS, functions, extensions and migration history as supported | **NOT RUN** |
| Actual bytes for all 30 Storage objects, with bucket/path inventory and SHA-256 manifest | **NOT RUN:** no authorized Storage download/export credential or verified export route established |
| New isolated local PostgreSQL restore and read-only functional checks | **NOT RUN:** there is no dump or object-byte backup to rehearse |

Supabase's [backup guidance](https://supabase.com/docs/guides/platform/backups) recommends off-site CLI exports for Free projects and states that database backups do not include Storage object bytes. The [CLI backup and restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) requires an authenticated database connection. Cached local PostgreSQL images and Docker are available, but starting a local restore without a real backup would provide no recovery evidence.

No backup artifact or manifest exists, so there are no artifact hashes, encryption claims, access-control claims, or retention/removal instructions to certify. The prior schema snapshot is catalog evidence only, not a data backup.

## Recovery and next decision

Obtain a secure client-owned destination outside the checkout, a database connection credential with `pg_dump` access for this exact project, and an authorized route to download all private Storage object bytes. Keep credentials out of reports and command output. Then export into the restricted destination, record hashes, rehearse a restore on a new loopback-only local instance, compare database and object counts/digests, and document gaps in hosted-only Auth/Storage configuration. Preserve the backup according to the owner's retention instructions; remove only newly created disposable local services after verifying artifacts.

Only after a verified backup and restore rehearsal should the owner review environment designation and separately authorize any targeted hosted migration. Staging and production remain **NO-GO**. A schema-cache refresh alone cannot resolve an absent function.
