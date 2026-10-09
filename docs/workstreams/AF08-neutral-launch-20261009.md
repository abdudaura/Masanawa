# AF08 — Neutral launch continuity (scope claim)

- Owner/window: MASANAWA-01 / AF08-launch.
- Claimed UTC: 2026-10-09T22:01:50.710Z; five-minute lease on `factory/claims:.factory/leases.json`, commit `821e5f991168d3367a11a3361ffbaddc7e2bd699`.
- Branch: `work/af08-neutral-launch-20261009-masanawa01-b`; fresh main base: `f381f077c485c04261459b77a42c215d3ce3a14b`.
- Active product contract: audio-first v1; UI-01 / UX-A01/A03; AF08 native/Flutter launch scope.
- Dependencies: AF00 integrates five-tab app router, AF09 publishes audio Talks; no shared router or auth authority edits here.
- Latest concrete work: inspected main native drawable launch layers (green bitmap), v31 launch color (#25D366), Flutter gradient and `/chats` redirect to legacy private Talk.
- Owned paths: `apps/mobile/android/app/src/main/res/{drawable,drawable-v21,drawable-night,drawable-night-v21}/launch_background.xml`; `apps/mobile/android/app/src/main/res/values/colors.xml`; `apps/mobile/lib/src/screens/splash/splash_screen.dart`; `apps/mobile/test/audio_first/af08/neutral_launch_test.dart`; this file.
- Next: replace blue/green-flashing native startup backgrounds with neutral color, align Flutter splash to same color, direct signed-in splash to ordinary feed root, add focused tests. Preserve existing Android-12 splash logo/icon, session restoration guard and auth fallback. Do not touch globally shared theme, auth backend or routes.
- Initial state: PARTIAL_IMPLEMENTATION / NOT_RUN. No local APK or owner working tree available; no device/Gradle/provider qualification.
