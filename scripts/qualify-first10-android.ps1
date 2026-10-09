param(
  [string]$ApiBaseUrl = "https://masanawa-gateway-production.up.railway.app",
  [switch]$Install,
  [switch]$AllowDifferentBranch
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
  )
  Write-Host ""
  Write-Host "==> $Command $($Arguments -join ' ')" -ForegroundColor Cyan
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Command failed with exit code $LASTEXITCODE"
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$mobileDir = Join-Path $repoRoot "apps\mobile"
$expectedBranch = "main"
$packageName = "com.masanawa.app"

Push-Location $repoRoot
try {
  $currentBranch = (& git rev-parse --abbrev-ref HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($currentBranch)) {
    throw "Unable to determine current Git branch."
  }
  Write-Host "Current branch: $currentBranch"

  if (-not $AllowDifferentBranch -and $currentBranch -ne $expectedBranch) {
    throw "Expected branch '$expectedBranch' but found '$currentBranch'. Pull/switch to the launch branch or pass -AllowDifferentBranch intentionally."
  }

  $head = (& git rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0) { throw "Unable to determine Git HEAD." }
  Write-Host "HEAD: $head"

  $dirty = (& git status --porcelain -- apps/mobile).Trim()
  if ($LASTEXITCODE -ne 0) { throw "Unable to inspect mobile working tree." }
  if (-not [string]::IsNullOrWhiteSpace($dirty)) {
    Write-Host $dirty -ForegroundColor Red
    throw "Refusing to build: apps/mobile contains uncommitted or untracked changes. Clean/revert the rejected local edits first."
  }

  Invoke-Checked flutter --version

  Push-Location $mobileDir
  try {
    Invoke-Checked flutter clean
    Invoke-Checked flutter pub get
    Invoke-Checked flutter analyze
    Invoke-Checked flutter test
    Invoke-Checked flutter build apk --release "--dart-define=API_BASE_URL=$ApiBaseUrl" "--dart-define=AGENT_BASE_URL=$ApiBaseUrl"

    $apk = Join-Path $mobileDir "build\app\outputs\flutter-apk\app-release.apk"
    if (-not (Test-Path $apk)) {
      throw "Release APK was not produced at $apk"
    }

    $item = Get-Item $apk
    $hash = Get-FileHash -Algorithm SHA256 $apk

    Write-Host ""
    Write-Host "APK qualification build complete." -ForegroundColor Green
    Write-Host "Path: $apk"
    Write-Host "Size: $($item.Length) bytes"
    Write-Host "SHA256: $($hash.Hash)"
    Write-Host "Branch: $currentBranch"
    Write-Host "Commit: $head"

    if ($Install) {
      if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
        throw "adb is not available on PATH."
      }

      Invoke-Checked adb start-server
      $deviceLines = & adb devices
      if ($LASTEXITCODE -ne 0) { throw "adb devices failed." }
      $ready = @(
        $deviceLines |
          Select-Object -Skip 1 |
          Where-Object { $_ -match "\tdevice$" }
      )
      if ($ready.Count -lt 1) {
        throw "No authorized Android device is connected. Check USB debugging and the authorization prompt."
      }

      Invoke-Checked adb install -r $apk
      Invoke-Checked adb shell monkey -p $packageName -c android.intent.category.LAUNCHER 1

      Write-Host ""
      Write-Host "Installed and launched $packageName." -ForegroundColor Green
      Write-Host "Device acceptance still requires manually exercising:"
      Write-Host "  1. sign-in/auth"
      Write-Host "  2. Home / Explore / Activity / Wallet"
      Write-Host "  3. text chat"
      Write-Host "  4. realtime voice and call mode"
      Write-Host "  5. camera/photo and document attachments"
      Write-Host "  6. Twin creation: gender + age + photo + Gwani interview"
      Write-Host "  7. public Twin share/deep link and free text"
      Write-Host "  8. Internet Cafe billing intents and wallet refresh"
      Write-Host "  9. Crypto conversational entry"
      Write-Host " 10. restart/reconnect and low-memory/background recovery"
      Write-Host " 11. paid/trial Twin voice admission and settlement"
    }
  }
  finally {
    Pop-Location
  }
}
finally {
  Pop-Location
}
