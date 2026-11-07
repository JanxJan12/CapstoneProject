param(
  [Parameter(Mandatory = $true)][string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$migrationPath = Join-Path $repo 'supabase\migrations\20261026144235_track_b_restrict_rider_assignment_proof_reads.sql'
$expectedHash = '3940049EDB24E149E6551F523B5F4513A79561DFD1E59C97A2F3C7D29F100A27'
$actualHash = (Get-FileHash -LiteralPath $migrationPath -Algorithm SHA256).Hash
if ($actualHash -ne $expectedHash) { throw "Migration hash mismatch: $actualHash" }
if (Test-Path -LiteralPath $OutputDirectory) { throw 'Use a new, empty output directory.' }

$migration = [System.IO.File]::ReadAllText($migrationPath)
$sqlLiteral = "'" + $migration.Replace("'", "''") + "'"
$applyBefore = @'
\set ON_ERROR_STOP on
begin;
set local search_path = "$user", public, extensions;
set local standard_conforming_strings = on;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $guard$
begin
  if exists (select 1 from supabase_migrations.schema_migrations
             where version = '20261026144235') then
    raise exception 'Track B version already recorded';
  end if;
  if (select count(*) from pg_policies
      where schemaname='public' and tablename='delivery_assignments'
        and policyname='rider_select_own_assignments'
        and cmd='SELECT' and roles='{authenticated}'
        and md5(qual)='226224fad5f07bbdb74d1e8a20cc0df8') <> 1 then
    raise exception 'Assignment policy drift';
  end if;
  if (select count(*) from pg_policies
      where schemaname='storage' and tablename='objects'
        and policyname='rider_read_own_delivery_proof'
        and cmd='SELECT' and roles='{authenticated}'
        and md5(qual)='b5088a344d716a67ad83e91573184d64') <> 1 then
    raise exception 'Proof read policy drift';
  end if;
  if (select count(*) from pg_policies
      where schemaname='storage' and tablename='objects'
        and policyname='rider_upload_own_delivery_proof'
        and cmd='INSERT' and roles='{authenticated}'
        and md5(with_check)='3ff4c84d3acd1447af24954329c19777') <> 1 then
    raise exception 'Proof upload policy drift';
  end if;
  if not exists (select 1 from storage.buckets
                 where id='delivery-proofs' and public=false)
     or not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
                    where n.nspname='public' and c.relname='delivery_assignments'
                      and c.relrowsecurity)
     or not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
                    where n.nspname='storage' and c.relname='objects'
                      and c.relrowsecurity) then
    raise exception 'Bucket or RLS drift';
  end if;
end
$guard$;
'@
$applyAfter = @'
insert into supabase_migrations.schema_migrations (version, statements, name)
values ('20261026144235', array[__MIGRATION_LITERAL__]::text[],
        'track_b_restrict_rider_assignment_proof_reads');
do $guard$
begin
  if (select count(*) from supabase_migrations.schema_migrations
      where version='20261026144235'
        and name='track_b_restrict_rider_assignment_proof_reads'
        and array_length(statements,1)=1) <> 1 then
    raise exception 'Target ledger row missing';
  end if;
  if (select count(*) from pg_policies
      where schemaname='public' and tablename='delivery_assignments'
        and policyname='rider_select_own_assignments'
        and cmd='SELECT' and roles='{authenticated}'
        and position('approval_status' in qual)>0
        and position('is_active' in qual)>0) <> 1 then
    raise exception 'New assignment policy missing';
  end if;
  if (select count(*) from pg_policies
      where schemaname='storage' and tablename='objects'
        and policyname='rider_read_own_delivery_proof'
        and cmd='SELECT' and roles='{authenticated}'
        and position('approval_status' in qual)>0
        and position('is_active' in qual)>0) <> 1 then
    raise exception 'New proof policy missing';
  end if;
  if (select count(*) from pg_policies
      where schemaname='storage' and tablename='objects'
        and policyname='rider_upload_own_delivery_proof'
        and md5(with_check)='3ff4c84d3acd1447af24954329c19777') <> 1 then
    raise exception 'Upload policy changed';
  end if;
end
$guard$;
commit;
'@

$rollback = @'
\set ON_ERROR_STOP on
begin;
set local search_path = "$user", public, extensions;
set local standard_conforming_strings = on;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $guard$
begin
  if (select count(*) from supabase_migrations.schema_migrations
      where version='20261026144235'
        and name='track_b_restrict_rider_assignment_proof_reads') <> 1 then
    raise exception 'Target ledger row drift';
  end if;
  if (select count(*) from pg_policies
      where schemaname='public' and tablename='delivery_assignments'
        and policyname='rider_select_own_assignments'
        and cmd='SELECT' and roles='{authenticated}'
        and position('approval_status' in qual)>0) <> 1
     or (select count(*) from pg_policies
      where schemaname='storage' and tablename='objects'
        and policyname='rider_read_own_delivery_proof'
        and cmd='SELECT' and roles='{authenticated}'
        and position('approval_status' in qual)>0) <> 1 then
    raise exception 'New policy drift; review before rollback';
  end if;
end
$guard$;
drop policy rider_select_own_assignments on public.delivery_assignments;
create policy rider_select_own_assignments on public.delivery_assignments
  for select to authenticated using ((rider_id = auth.uid()));
drop policy rider_read_own_delivery_proof on storage.objects;
create policy rider_read_own_delivery_proof on storage.objects
  for select to authenticated using (
    (bucket_id = 'delivery-proofs'::text)
    and (split_part(name, '/'::text, 1) = (auth.uid())::text)
    and exists (select 1 from public.delivery_assignments da
                where da.id::text = split_part(storage.objects.name, '/'::text, 2)
                  and da.rider_id = auth.uid())
  );
delete from supabase_migrations.schema_migrations
where version='20261026144235'
  and name='track_b_restrict_rider_assignment_proof_reads';
do $guard$
begin
  if exists (select 1 from supabase_migrations.schema_migrations
             where version='20261026144235')
     or (select count(*) from pg_policies
         where schemaname='public' and tablename='delivery_assignments'
           and policyname='rider_select_own_assignments'
           and md5(qual)='226224fad5f07bbdb74d1e8a20cc0df8') <> 1
     or (select count(*) from pg_policies
         where schemaname='storage' and tablename='objects'
           and policyname='rider_read_own_delivery_proof'
           and md5(qual)='b5088a344d716a67ad83e91573184d64') <> 1 then
    raise exception 'Rollback verification failed';
  end if;
end
$guard$;
commit;
'@

[System.IO.Directory]::CreateDirectory($OutputDirectory) | Out-Null
$applySql = $applyBefore + [Environment]::NewLine + $migration + [Environment]::NewLine + $applyAfter.Replace('__MIGRATION_LITERAL__', $sqlLiteral)
[System.IO.File]::WriteAllText((Join-Path $OutputDirectory 'track-b-apply.sql'), $applySql, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText((Join-Path $OutputDirectory 'track-b-rollback.sql'), $rollback, [System.Text.UTF8Encoding]::new($false))
Write-Output "Generated apply and rollback SQL for migration SHA-256 $actualHash in $OutputDirectory"
