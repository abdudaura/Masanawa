param(
  [string]$GatewayUrl = "http://127.0.0.1:3000",
  [string]$AlphaToken = $env:ALPHA_DEV_ACCESS_TOKEN,
  [switch]$Install
)

# "Continue" on purpose: flutter/adb write routine warnings to stderr, which
# PowerShell would otherwise turn into terminating errors. Every native call
# below is still gated by an explicit $LASTEXITCODE check.
$ErrorActionPreference = "Continue"

if ([string]::IsNullOrWhiteSpace($AlphaToken)) {
  throw "Set ALPHA_DEV_ACCESS_TOKEN or pass -AlphaToken."
}

Push-Location (Join-Path $PSScriptRoot "..")
try {
  flutter pub get

  $flutterArgs = @(
    "build", "apk", "--debug",
    "--dart-define=AGENT_RUNTIME_ENABLED=true",
    "--dart-define=AGENT_BASE_URL=$GatewayUrl",
    "--dart-define=ALPHA_DEV_ACCESS_TOKEN=$AlphaToken",
    "--dart-define=ALPHA_TTS_ENABLED=true"
  )
  & flutter @flutterArgs
  if ($LASTEXITCODE -ne 0) { throw "Flutter build failed." }

  $apk = Join-Path (Get-Location) "build\app\outputs\flutter-apk\app-debug.apk"
  Write-Host ""
  Write-Host "Alpha APK:" $apk

  if ($Install) {
    adb reverse tcp:3000 tcp:3000
    if ($LASTEXITCODE -ne 0) { throw "adb reverse failed." }
    adb install -r $apk
    if ($LASTEXITCODE -ne 0) { throw "APK install failed." }
    Write-Host ""
    Write-Host "Installed. The debug app can reach the laptop Gateway at http://127.0.0.1:3000"
  }
} finally {
  Pop-Location
}
