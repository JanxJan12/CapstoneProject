param([Parameter(Mandatory)][ValidateSet(2,3)][int]$Slot)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$target = Join-Path $repo ".tmp\defense-demo-20261014-r$Slot"
if (Test-Path (Join-Path $target 'role-accounts.private.json')) {
  throw 'That demo slot has already been provisioned. Choose a fresh slot; existing data is preserved.'
}
& (Join-Path $PSScriptRoot 'prepare-defense-demo.ps1') -Start -Slot $Slot
if ($LASTEXITCODE -ne 0) { throw 'Demo stack creation failed.' }
$env:RRJ_DEMO_SLOT = "$Slot"
Push-Location $repo
try { & node .\scripts\demo\provision-defense-demo.mjs } finally { Pop-Location }
if ($LASTEXITCODE -ne 0) { throw 'Demo provisioning failed; preserve private runtime for inspection.' }
Write-Output "Fresh demo run $Slot is ready. Start web with scripts/demo/start-defense-web.ps1 -Slot $Slot. Prior slots are intact."
