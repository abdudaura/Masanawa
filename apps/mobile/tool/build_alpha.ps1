param(
  [string]$GatewayUrl = "http://127.0.0.1:3000",
  [string]$AlphaToken = $env:ALPHA_DEV_ACCESS_TOKEN,
  [switch]$Install
)

# Native warnings may use stderr; failure is determined by exit status.
$ErrorActionPreference = "Continue"

# Resolve tool binaries without depending on a perfect PATH. Checks PATH
# first, then well-known install locations, and fails with guidance.
function Find-BuildTool([string]$name, [string[]]$fallbacks) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($fb in $fallbacks) { if (Test-Path $fb) { return $fb } }
  throw "$name not found. Install it and add it to PATH, then rerun."
}
$flutterExe = Find-BuildTool 'flutter' @('C:\flutter\bin\flutter.bat')
$gateway = [Uri]$GatewayUrl.TrimEnd('/')
$localGateway = $gateway.IsLoopback
if (-not $gateway.IsAbsoluteUri -or $gateway.UserInfo -or $gateway.Query -or $gateway.Fragment -or
    ($gateway.AbsolutePath -ne '/') -or
    ($gateway.Scheme -ne 'https' -and -not ($localGateway -and $gateway.Scheme -eq 'http'))) {
  throw "Use an HTTPS Gateway address, or localhost for USB testing."
}
$GatewayUrl = $gateway.AbsoluteUri.TrimEnd('/')
if ($AlphaToken -match '\s') { throw "Alpha token must not contain whitespace." }

# Check the selected server before compiling an unusable APK.
try {
  $ready = Invoke-RestMethod -Uri "$GatewayUrl/readyz" -TimeoutSec 20 -ErrorAction Stop
  if ($ready.status -ne 'ready') { throw "Gateway is not ready." }
  if (-not [string]::IsNullOrWhiteSpace($AlphaToken)) {
    $directory = Invoke-RestMethod -Uri "$GatewayUrl/v1/agent/directory" -TimeoutSec 20 `
      -Headers @{ Authorization = "Bearer $AlphaToken" } -ErrorAction Stop
    Write-Host "Gateway verified. Agents:" @($directory.agents).Count
  }
} catch {
  throw "Could not verify the selected Gateway. Start it first, and use its own Alpha token."
}

Push-Location (Join-Path $PSScriptRoot "..")
$definesPath = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())
try {
  & $flutterExe pub get
  if ($LASTEXITCODE -ne 0) { throw "Flutter dependency installation failed." }
  $defines = @{
    AGENT_RUNTIME_ENABLED = 'true'
    AGENT_BASE_URL = $GatewayUrl
    ALPHA_TTS_ENABLED = 'true'
  }
  if (-not [string]::IsNullOrWhiteSpace($AlphaToken)) { $defines.ALPHA_DEV_ACCESS_TOKEN = $AlphaToken }
  [System.IO.File]::WriteAllText($definesPath, ($defines | ConvertTo-Json), [System.Text.UTF8Encoding]::new($false))
  & $flutterExe build apk --debug "--dart-define-from-file=$definesPath"
  if ($LASTEXITCODE -ne 0) { throw "Flutter build failed." }
  $apk = Join-Path (Get-Location) "build\app\outputs\flutter-apk\app-debug.apk"
  Write-Host "Alpha APK:" $apk
  Write-Host "Gateway:" $GatewayUrl
  if ([string]::IsNullOrWhiteSpace($AlphaToken)) {
    Write-Host "After installing: test login, Settings > Developer > Connect test app. Enter this Gateway's Alpha token."
  }
  if ($Install) {
    $adbExe = Find-BuildTool 'adb' @(
      (Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe')
    )
    if ($localGateway) {
      $port = $gateway.Port
      & $adbExe reverse "tcp:$port" "tcp:$port"
      if ($LASTEXITCODE -ne 0) { throw "adb reverse failed." }
    }
    & $adbExe install -r $apk
    if ($LASTEXITCODE -ne 0) { throw "APK install failed." }
    Write-Host "Installed. Gateway:" $GatewayUrl
  }
} finally {
  Remove-Item $definesPath -Force -ErrorAction SilentlyContinue
  Pop-Location
}
