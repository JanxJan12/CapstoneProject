$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runtime = Join-Path $repo '.tmp\defense-demo-20261014'
$rider = 'C:\Users\Janmari\Downloads\RRJ-Food-House-Rider'
$apk = Join-Path $rider 'android\app\build\outputs\apk\release\app-release.apk'
$saved = Join-Path $rider 'releases\rrj-rider-defense-demo-20261014-v4.apk'
$statusText = (& npx.cmd --yes supabase@2.120.0 status --workdir $runtime -o json 2>$null) -join "`n"
if ($LASTEXITCODE -ne 0) { throw 'Isolated demo Supabase status unavailable.' }
$status = $statusText | ConvertFrom-Json
if ($status.API_URL -ne 'http://127.0.0.1:61321' -or
  (docker inspect --format '{{.State.Running}}' supabase_db_rrj_defense_demo_20261014) -ne 'true') {
  throw 'Refusing to build Rider demo against another database.'
}
if (Test-Path $saved) { throw 'Named demo APK already exists; preserve it before another build.' }
if (Test-Path $apk) { Copy-Item $apk (Join-Path $runtime 'pre-defense-rider-app-release.apk') -ErrorAction Stop }
$env:ANDROID_HOME = 'C:\Users\Janmari\AppData\Local\Android\Sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot'
$env:EXPO_PUBLIC_DEFENSE_DEMO = 'true'
$env:EXPO_PUBLIC_SUPABASE_URL = 'http://10.0.2.2:61321'
$env:EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $status.PUBLISHABLE_KEY
$log = Join-Path $runtime 'rider-apk-build-private.log'
Push-Location (Join-Path $rider 'android')
try {
  & .\gradlew.bat :app:createBundleReleaseJsAndAssets :app:assembleRelease -PrrjDemoCleartext=true --rerun-tasks *> $log
  if ($LASTEXITCODE -ne 0) { throw "Android demo build failed; inspect private log at $log." }
} finally { Pop-Location }
if (-not (Test-Path $apk)) { throw 'Android release APK missing after build.' }
$aapt = Join-Path $env:ANDROID_HOME 'build-tools\36.0.0\aapt.exe'
$manifestTree = (& $aapt dump xmltree $apk AndroidManifest.xml) -join "`n"
if ($LASTEXITCODE -ne 0 -or $manifestTree -notmatch 'usesCleartextTraffic.*0xffffffff') {
  throw 'Demo APK manifest did not enable emulator-only local HTTP transport.'
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($apk)
try {
  $entry = $zip.Entries | Where-Object FullName -eq 'assets/index.android.bundle' | Select-Object -First 1
  if (-not $entry) { throw 'Android JS bundle missing from APK.' }
  $reader = [System.IO.StreamReader]::new($entry.Open())
  try { $bundle = $reader.ReadToEnd() } finally { $reader.Dispose() }
  if (-not $bundle.Contains('10.0.2.2:61321')) { throw 'APK lacks the isolated emulator URL.' }
  if ($bundle.Contains('zhzluhqvysvsadwuugpa')) { throw 'APK contains hosted Supabase project reference.' }
} finally { $zip.Dispose() }
New-Item -ItemType Directory -Path (Split-Path $saved) -Force | Out-Null
Copy-Item $apk $saved
$hash = (Get-FileHash $saved -Algorithm SHA256).Hash
Write-Output "PASS: isolated Rider demo APK built and checked. SHA-256 $hash"
Write-Output "Artifact: $saved"
