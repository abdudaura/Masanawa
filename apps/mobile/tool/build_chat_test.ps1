param(
  [string]$GatewayUrl = "https://nurainworker-production.up.railway.app",
  [string]$AlphaToken = $env:ALPHA_DEV_ACCESS_TOKEN,
  [switch]$Install,
  [switch]$RequireSupportAgents
)
$ErrorActionPreference = "Stop"
$flutterCommand = Get-Command flutter -ErrorAction Stop
$uri = [Uri]$GatewayUrl
if (-not $uri.IsAbsoluteUri -or $uri.Scheme -ne "https" -or $uri.UserInfo -or
    $uri.Query -or $uri.Fragment -or $uri.AbsolutePath -ne "/") {
  throw "Use the hosted HTTPS Gateway origin."
}
$GatewayUrl = $uri.AbsoluteUri.TrimEnd("/")
if ($AlphaToken -match '\s') { throw "Alpha token must not contain whitespace." }
$ready = Invoke-RestMethod -Uri "$GatewayUrl/readyz" -TimeoutSec 20
if ($ready.status -ne "ready") { throw "Gateway is not ready." }
if (-not [string]::IsNullOrWhiteSpace($AlphaToken)) {
  $directory = Invoke-RestMethod -Uri "$GatewayUrl/v1/agent/directory" -TimeoutSec 20 -Headers @{Authorization = "Bearer $AlphaToken"}
  $names = @($directory.agents | ForEach-Object { $_.displayName })
  $missing = @("Gwani", "Gwana") | Where-Object { $_ -notin $names }
  Write-Host "Authorized visible agents:" ($names -join ", ")
  if ($RequireSupportAgents -and @($missing).Count -gt 0) {
    throw "Support agents not admitted by this Gateway: $($missing -join ', '). Provision them server-side; do not rerun alpha bootstrap on an existing production database."
  }
} elseif ($RequireSupportAgents) {
  throw "Set ALPHA_DEV_ACCESS_TOKEN privately to verify Gwani and Gwana."
} else {
  Write-Host "Agent roster is unverified. Connect with the hosted token in Settings > Developer after installing."
}
Push-Location (Join-Path $PSScriptRoot "..")
$definesPath = Join-Path ([IO.Path]::GetTempPath()) ([IO.Path]::GetRandomFileName())
try {
  & $flutterCommand.Source pub get
  if ($LASTEXITCODE -ne 0) { throw "Flutter dependencies failed." }
  & $flutterCommand.Source analyze --no-fatal-infos --no-fatal-warnings
  if ($LASTEXITCODE -ne 0) { throw "Flutter analysis found errors." }
  & $flutterCommand.Source test
  if ($LASTEXITCODE -ne 0) { throw "Flutter tests failed." }
  $defines = @{ AGENT_RUNTIME_ENABLED = "true"; AGENT_BASE_URL = $GatewayUrl }
  if (-not [string]::IsNullOrWhiteSpace($AlphaToken)) { $defines.ALPHA_DEV_ACCESS_TOKEN = $AlphaToken }
  [IO.File]::WriteAllText($definesPath, ($defines | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
  & $flutterCommand.Source build apk --debug "--dart-define-from-file=$definesPath"
  if ($LASTEXITCODE -ne 0) { throw "APK build failed." }
  $apk = Join-Path (Get-Location) "build\app\outputs\flutter-apk\app-debug.apk"
  Write-Host "APK:" $apk
  if ($Install) {
    $adb = Get-Command adb -ErrorAction Stop
    & $adb.Source install -r $apk
    if ($LASTEXITCODE -ne 0) { throw "APK install failed." }
  }
} finally {
  Remove-Item $definesPath -Force -ErrorAction SilentlyContinue
  Pop-Location
}
