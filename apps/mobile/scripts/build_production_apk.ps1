param(
  [switch]$SkipTests,
  [switch]$Debug
)

$ErrorActionPreference = "Stop"

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$MobileRoot = Resolve-Path (Join-Path $Here "..")
Set-Location $MobileRoot

$Gateway = "https://masanawa-gateway-production.up.railway.app"

Write-Host "== Masanawa Android build ==" -ForegroundColor Cyan
Write-Host "Project: $MobileRoot"
Write-Host "Gateway: $Gateway"

if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) { throw "Flutter is not on PATH." }
if (-not (Get-Command dart -ErrorAction SilentlyContinue)) { throw "Dart is not on PATH." }

Write-Host "[1/7] Dependencies" -ForegroundColor Cyan
flutter pub get

Write-Host "[2/7] Regenerate launcher icons from approved Masanawa logo" -ForegroundColor Cyan
dart run flutter_launcher_icons

Write-Host "[3/7] Regenerate native splash from approved Masanawa logo" -ForegroundColor Cyan
dart run flutter_native_splash:create

Write-Host "[4/7] Format check" -ForegroundColor Cyan
dart format --output=none --set-exit-if-changed lib test

Write-Host "[5/7] Analyze" -ForegroundColor Cyan
flutter analyze

if (-not $SkipTests) {
  Write-Host "[6/7] Tests" -ForegroundColor Cyan
  flutter test
} else {
  Write-Host "[6/7] Tests skipped by request" -ForegroundColor Yellow
}

Write-Host "[7/7] APK" -ForegroundColor Cyan
$Mode = if ($Debug) { "debug" } else { "release" }
$Args = @("build","apk","--$Mode","--dart-define=API_BASE_URL=$Gateway","--dart-define=AGENT_BASE_URL=$Gateway")
flutter @Args

$Apk = if ($Debug) { Join-Path $MobileRoot "build\app\outputs\flutter-apk\app-debug.apk" } else { Join-Path $MobileRoot "build\app\outputs\flutter-apk\app-release.apk" }
if (-not (Test-Path $Apk)) { throw "Build completed without the expected APK at $Apk" }
Write-Host "APK ready:" -ForegroundColor Green
Write-Host $Apk -ForegroundColor Green
