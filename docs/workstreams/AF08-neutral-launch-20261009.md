# AF08 — Neutral Android/Flutter launch continuity

## Ownership and immutable source

- Window: `MASANAWA-01 / AF08-launch`. Base fresh `main@f381f077c485c04261459b77a42c215d3ce3a14b`.
- Branch: `work/af08-neutral-launch-20261009-masanawa01-b`.
- Exact-path CAS registry claim: `factory/claims:.factory/leases.json@821e5f991168d3367a11a3361ffbaddc7e2bd699` (readback successful before changes), claim ID `masanawa-01-af08-neutral-launch-20261009-b`.
- Source checkpoint: `ac7409bfbe28ad0a389b4577d82fa8a16e9df4f2`. Final handoff commit/PR head recorded on PR metadata after this document update.
- Authority: latest audio-first product 2026-10-09, UI-01 and UX-A01/A03; AF08 owns launch. AF00 owns root router/semantic five-tab integration, AF09 owns published-audio feed. No shared native manifest, auth, global theme, DB or money edits.

## Changed source and behavior

1. `apps/mobile/android/app/src/main/res/values/colors.xml`: native `masanawa_launch_background` now neutral white (`#FFFFFF`), leaving unrelated brand/icon tokens intact.
2. `apps/mobile/android/app/src/main/res/drawable{,-v21,-night,-night-v21}/launch_background.xml`: use a standard color drawable instead of old full-window colored bitmap; preserve the existing centered brand splash bitmap. Existing Android 12+ light/night launch styles already reference the same neutral color and blue logo icon.
3. `apps/mobile/lib/src/screens/splash/splash_screen.dart`: solid, token-based white neutral surface instead of blue/green full-screen gradient, accessible on-surface tagline, non-white-logo styling, and normal signed-in `/home` entry instead of `/chats` legacy redirect to private voice. Preserve the 1.2-second brand delay, 6.2-second bounded restore wait, signed-out/name/OTP routing and session listeners.
4. `apps/mobile/test/audio_first/af08/neutral_launch_test.dart`: Flutter widget cases for both light/dark active themes, neutral surface, absence of splash gradient, visible logo/text variant and signed-out OTP-free fallback after delay.

## Evidence

- Exact GitHub source/readback and 11 static guards PASSED at source checkpoint `bee39b0e874124ab79e58865453ef5fdb55db534`; final native XML revision `ac7409bfbe28ad0a389b4577d82fa8a16e9df4f2` changes only equivalent layer-list color syntax. Follow-up static readback required for final head.
- Manually inspected actual existing `android12splash.png` low-density asset via source fetch; it is a blue mark (no all-white-on-white icon issue). This does not verify installed Android rendering.
- Flutter SDK, Gradle Android build, hardware emulator and Android physical device are unavailable in this execution container. **`flutter analyze`, `flutter test test/audio_first/af08/neutral_launch_test.dart`, `flutter build apk`, Android 12 dark/day physical splash timing and final APK comparison are NOT_RUN / BLOCKED**, not PASS.
- Owner's locally fixed source/APK unavailable. Do not replace local edits without AF00 source reconciliation.

## Remaining integration and release gates

- AF00 must merge/qualify canonical five-tab routing so `/home` launches the new **Talks published-audio feed**, not the legacy live-Talk Home currently on main; preserve incoming deep links, foreground active context and old route aliases. Root shell is not changed in this branch.
- Execute a real Flutter analyzer/widget test and Android pre-12/12+ day/night cold-start test; verify visual continuity to Flutter and signed-in/out timing, then build/sign an APK. Add source SHA and observed APK checksum. No native binary exists from this window.
- Audit GitHub and hosting auto-deploy before merging to `main`. If main triggers production deployment, integrate on non-deploying branch; require separate release/rollback approval.
- Status: **PARTIAL_IMPLEMENTATION**, source and tests authored, runtime/Gradle/device/deployment unverified. No provider, migration or production writes.
