param([ValidateSet(1,2,3)][int]$Slot = 1)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$suffix = if ($Slot -eq 1) { '' } else { "-r$Slot" }
$runtime = Join-Path $repo ".tmp\defense-demo-20261014$suffix"
$name = "supabase_db_rrj_defense_demo_20261014$(if ($Slot -eq 1) { '' } else { "_r$Slot" })"
$prefix = @{ 1 = '613'; 2 = '623'; 3 = '633' }[$Slot]
$expected = "http://127.0.0.1:${prefix}21"
$webPort = 58439 + $Slot
$statusText = (& npx.cmd --yes supabase@2.120.0 status --workdir $runtime -o json 2>$null) -join "`n"
if ($LASTEXITCODE -ne 0) { throw 'Demo stack unavailable.' }
$status = $statusText | ConvertFrom-Json
if ($status.API_URL -ne $expected -or (docker inspect --format '{{.State.Running}}' $name) -ne 'true') {
  throw 'Refusing a non-demo backend.'
}
$env:RRJ_DEFENSE_DEMO = '1'
$env:VITE_DEMO_MODE = 'true'
$env:VITE_SUPABASE_URL = $expected
$env:VITE_SUPABASE_PUBLISHABLE_KEY = $status.PUBLISHABLE_KEY
Write-Output "Opening isolated defense website at http://127.0.0.1:$webPort/auth"
Push-Location $repo
try { & node .\node_modules\vite\bin\vite.js --host 127.0.0.1 --port $webPort --strictPort } finally { Pop-Location }
