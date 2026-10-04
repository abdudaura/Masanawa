param(
  [string]$GatewayUrl = "http://127.0.0.1:3000",
  [string]$ApiUrl = $env:API_BASE_URL,
  [switch]$Install
)

$ErrorActionPreference = "Continue"

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

if ([string]::IsNullOrWhiteSpace($ApiUrl)) {
  $ApiUrl = "https://unigeria.up.railway.app"
}
$api = [Uri]$ApiUrl.TrimEnd('/')
if (-not $api.IsAbsoluteUri -or $api.UserInfo -or $api.Query -or $api.Fragment -or
    ($api.AbsolutePath -ne '/') -or $api.Scheme -ne 'https') {
  throw "Use an HTTPS platform API address."
}
$ApiUrl = $api.AbsoluteUri.TrimEnd('/')

try {
  $ready = Invoke-RestMethod -Uri "$GatewayUrl/readyz" -TimeoutSec 20 -ErrorAction Stop
  if ($ready.status -ne 'ready') { throw "Gateway is not ready." }
} catch {
  throw "Could not verify the selected Gateway. Start or deploy it first."
}

Push-Location (Join-Path $PSScriptRoot "..")
$definesPath = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())
try {
  & $flutterExe pub get
  if ($LASTEXITCODE -ne 0) { throw "Flutter dependency installation failed." }
  $defines = @{
    API_BASE_URL = $ApiUrl
    AGENT_RUNTIME_ENABLED = 'true'
    AGENT_BASE_URL = $GatewayUrl
  }
  [System.IO.File]::WriteAllText($definesPath, ($defines | ConvertTo-Json), [System.Text.UTF8Encoding]::new($false))
  & $flutterExe build apk --debug "--dart-define-from-file=$definesPath"
  if ($LASTEXITCODE -ne 0) { throw "Flutter build failed." }
  $apk = Join-Path (Get-Location) "build\app\outputs\flutter-apk\app-debug.apk"
  Write-Host "Debug APK:" $apk
  Write-Host "Gateway:" $GatewayUrl
  Write-Host "Platform API:" $ApiUrl
  Write-Host "Sign in normally with phone/email OTP; no developer token is required."
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
  }
} finally {
  Remove-Item $definesPath -Force -ErrorAction SilentlyContinue
  Pop-Location
}
