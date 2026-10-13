# Measures Android process-to-first-frame and (on a profile/debug APK)
# Masanawa's actual Dart/Chats/cache milestones. Requires adb on PATH.
# Example: .\scripts\\mobile-startup-benchmark.ps1 -Runs 5
param(
  [ValidateRange(1,30)][int]$Runs = 5,
  [string]$Package = "ng.unigeria.unigeria"
)
$ErrorActionPreference = "Stop"
if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
  throw "ADB is missing. Install Android platform-tools and enable USB debugging."
}
$device = (& adb get-state 2>&1 | Out-String).Trim()
if ($device -ne "device") { throw "ADB device unavailable: $device" }

Write-Host "Measure an actual installed profile/release APK, not debug emulator timings."
Write-Host "Cold = force-stopped; Returning = process kept alive after Home."
Write-Host "ADB am start -W measures Android launch, not full Chats readiness."
foreach ($mode in @("cold", "returning")) {
  if ($mode -eq "returning") {
    & adb shell am start -W -n "$Package/.MainActivity" | Out-Null
    Start-Sleep -Seconds 2
    & adb shell input keyevent KEYCODE_HOME | Out-Null
  }
  for ($i=1; $i -le $Runs; $i++) {
    if ($mode -eq "cold") {
      & adb shell am force-stop $Package | Out-Null
    } else {
      & adb shell input keyevent KEYCODE_HOME | Out-Null
    }
    & adb logcat -c | Out-Null
    $launch = (& adb shell am start -W -n "$Package/.MainActivity" 2>&1 | Out-String)
    $total = [regex]::Match($launch, "(?m)^TotalTime:\s*(\d+)")
    $wait = [regex]::Match($launch, "(?m)^WaitTime:\s*(\d+)")
    if ($launch -match "(?m)^Error:") { throw "Launch failed: $launch" }
    Start-Sleep -Seconds 3
    $milestones = (& adb logcat -d 2>&1 | Select-String 'MASANAWA_STARTUP' | ForEach-Object { $_.Line }) -join " | "
    Write-Host "$mode run=$i AndroidTotalMs=$($total.Groups[1].Value) AndroidWaitMs=$($wait.Groups[1].Value)"
    if ($milestones) { Write-Host $milestones }
    if (-not $milestones) {
      Write-Host "No Dart milestones (normal for release APK; profile mode enables them)."
    }
  }
}
Write-Host "Compare median cold, returning, session_resolved, chats_first_frame and cached_* milestones."
Write-Host "If cached_* is missing, reproduce with conversations on device and valid signed-in account."
