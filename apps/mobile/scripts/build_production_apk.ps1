param(
  [switch]$SkipTests,
  [switch]$Debug,
  [switch]$AllowDifferentBranch
)

$ErrorActionPreference = "Stop"

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$MobileRoot = Resolve-Path (Join-Path $Here "..")
Set-Location $MobileRoot

$RepoRoot = Resolve-Path (Join-Path $MobileRoot "..\..")
$ExpectedBranch = "main"
$CurrentBranch = (& git -C $RepoRoot rev-parse --abbrev-ref HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw "Unable to determine Git branch." }
if (-not $AllowDifferentBranch -and $CurrentBranch -ne $ExpectedBranch) {
  throw "Refusing to build branch '$CurrentBranch'. Expected '$ExpectedBranch'."
}
$Dirty = (& git -C $RepoRoot status --porcelain -- apps/mobile).Trim()
if ($LASTEXITCODE -ne 0) { throw "Unable to inspect mobile working tree." }
if (-not [string]::IsNullOrWhiteSpace($Dirty)) {
  Write-Host $Dirty -ForegroundColor Red
  throw "Refusing to build: apps/mobile contains uncommitted or untracked changes. Revert the rejected local edits first."
}
$Head = (& git -C $RepoRoot rev-parse HEAD).Trim()

$Gateway = "https://masanawa-gateway-production-338f.up.railway.app"

Write-Host "== Masanawa Android build ==" -ForegroundColor Cyan
Write-Host "Project: $MobileRoot"
Write-Host "Gateway: $Gateway"
Write-Host "Branch: $CurrentBranch"
Write-Host "Commit: $Head"

if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) { throw "Flutter is not on PATH." }
if (-not (Get-Command dart -ErrorAction SilentlyContinue)) { throw "Dart is not on PATH." }

Write-Host "[1/8] Clean stale Flutter outputs" -ForegroundColor Cyan
flutter clean

Write-Host "[2/8] Dependencies" -ForegroundColor Cyan
flutter pub get

Write-Host "[3/8] Regenerate launcher icons from approved Masanawa logo" -ForegroundColor Cyan
dart run flutter_launcher_icons

Write-Host "[4/8] Regenerate native splash from approved Masanawa logo" -ForegroundColor Cyan
dart run flutter_native_splash:create

Write-Host "[5/8] Format check" -ForegroundColor Cyan
dart format --output=none --set-exit-if-changed lib test

Write-Host "[6/8] Analyze" -ForegroundColor Cyan
flutter analyze

if (-not $SkipTests) {
  Write-Host "[7/8] Tests" -ForegroundColor Cyan
  flutter test
} else {
  Write-Host "[7/8] Tests skipped by request" -ForegroundColor Yellow
}

Write-Host "[8/8] APK" -ForegroundColor Cyan
$Mode = if ($Debug) { "debug" } else { "release" }
$Args = @("build","apk","--$Mode","--dart-define=API_BASE_URL=$Gateway","--dart-define=AGENT_BASE_URL=$Gateway")
flutter @Args

$Apk = if ($Debug) { Join-Path $MobileRoot "build\app\outputs\flutter-apk\app-debug.apk" } else { Join-Path $MobileRoot "build\app\outputs\flutter-apk\app-release.apk" }
if (-not (Test-Path $Apk)) { throw "Build completed without the expected APK at $Apk" }
Write-Host "APK ready:" -ForegroundColor Green
Write-Host $Apk -ForegroundColor Green

Write-Host "Commit: $Head" -ForegroundColor Green
