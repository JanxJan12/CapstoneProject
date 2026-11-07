param([switch]$Start, [ValidateSet(1,2,3)][int]$Slot = 1)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$diagnostic = 'C:\Users\Janmari\Downloads\RRJ-RC-Synthetic-Replay-20261013\supabase'
$suffix = if ($Slot -eq 1) { '' } else { "-r$Slot" }
$runtime = Join-Path $repo ".tmp\defense-demo-20261014$suffix"
$target = Join-Path $runtime 'supabase'
$migrations = Join-Path $target 'migrations'
$name = "rrj_defense_demo_20261014$(if ($Slot -eq 1) { '' } else { "_r$Slot" })"
$prefix = @{ 1 = '613'; 2 = '623'; 3 = '633' }[$Slot]
$apiUrl = "http://127.0.0.1:${prefix}21"
$fixture = '20260903180000_phase8_test_historical_master_data.sql'
$fixtureHash = '57D22174104C0DA33DF06E51CDE404BA9BF881500D83A95F5CF6AAEEA75F257D'

if (-not (Test-Path (Join-Path $diagnostic "migrations\$fixture"))) { throw 'The known diagnostic fixture is unavailable.' }
if ((Get-FileHash (Join-Path $diagnostic "migrations\$fixture") -Algorithm SHA256).Hash -ne $fixtureHash) { throw 'Diagnostic fixture digest changed.' }
if (Test-Path (Join-Path $runtime '.branches')) { throw 'A linked demo workspace is forbidden.' }
if (Test-Path (Join-Path $target '.temp\project-ref')) { throw 'A remotely linked demo workspace is forbidden.' }
if (Test-Path $migrations) {
  $existing = @(Get-ChildItem $migrations -Filter '*.sql')
  if ($existing.Count -ne 52) { throw 'Existing demo migration set is incomplete. Preserve it for inspection.' }
} else {
  New-Item -ItemType Directory -Path $migrations -Force | Out-Null
  $config = Get-Content (Join-Path $diagnostic 'config.toml') -Raw
  $config = $config.Replace('rrj_rc_synthetic_replay_20261013', $name).Replace('603', $prefix)
  $config = $config.Replace('[db.seed]'+[Environment]::NewLine+'# If enabled, seeds the database after migrations during a db reset.'+[Environment]::NewLine+'enabled = false', '[db.seed]'+[Environment]::NewLine+'# If enabled, seeds the database after migrations during a db reset.'+[Environment]::NewLine+'enabled = false')
  Set-Content (Join-Path $target 'config.toml') $config
  Copy-Item (Join-Path $diagnostic 'migrations\*.sql') $migrations
  $latest = @('20261013071937_remove_duplicate_timestamp_triggers.sql', '20261013105400_customer_modifier_completion.sql', '20261013162631_kds_queue_modifier_channel_v2.sql')
  foreach ($file in $latest) { Copy-Item (Join-Path $repo "supabase\migrations\$file") $migrations }
  $sourceFiles = @(Get-ChildItem (Join-Path $repo 'supabase\migrations') -Filter '*.sql')
  if ($sourceFiles.Count -ne 51) { throw 'Canonical migration count changed; inspect the private runtime before use.' }
  foreach ($file in $sourceFiles) {
    $copied = Join-Path $migrations $file.Name
    if (-not (Test-Path $copied)) { throw "Missing copied migration $($file.Name)" }
    if ($file.Name -ne '20260914000000_harden_numeric_inputs.sql' -and (Get-FileHash $file.FullName).Hash -ne (Get-FileHash $copied).Hash) {
      throw "Unexpected difference from canonical migration $($file.Name)"
    }
  }
  if (@(Get-ChildItem $migrations -Filter '*.sql').Count -ne 52) { throw 'Expected 51 source migrations plus one explicitly synthetic prerequisite.' }
}

if ($Start) {
  $existingContainer = docker inspect "supabase_db_$name" --format '{{.State.Running}}' 2>$null
  if ($LASTEXITCODE -eq 0 -and $existingContainer -eq 'true') {
    Write-Output "Demo stack already running at $apiUrl."
    exit 0
  }
  $log = Join-Path $runtime 'start-private.log'
  & npx.cmd --yes supabase@2.120.0 start --workdir $runtime --exclude realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor --yes *> $log
  if ($LASTEXITCODE -ne 0) { throw "Demo start failed; inspect the private log at $log." }
  $db = docker inspect "supabase_db_$name" --format '{{.State.Running}}'
  if ($db -ne 'true') { throw 'Expected demo database container is not running.' }
  $count = docker exec "supabase_db_$name" psql -U postgres -d postgres -Atc 'select count(*) from supabase_migrations.schema_migrations'
  if ($count -ne '52') { throw "Demo migration ledger has $count versions; inspect the private log." }
  Write-Output "Demo stack started at $apiUrl with 52 demo-only migration versions."
} else {
  Write-Output "Prepared unlinked demo runtime: $runtime"
}
