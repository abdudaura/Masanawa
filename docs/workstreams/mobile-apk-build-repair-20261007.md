# Mobile APK compilation repair — 2026-10-07

Owner: current Railway/APK repair window
Branch: `fix/mobile-apk-build-20261007`
Base: `bb3f6d204c2e53f21eaf2574311c7c0ef4cbf315`
Last update: 2026-10-07T16:37:00Z
Status: active.

## Exact owned paths

- apps/mobile/lib/src/screens/activity/activity_screen.dart
- apps/mobile/lib/src/screens/you/you_screen.dart
- apps/mobile/lib/src/screens/talks/create_talk_screen.dart
- apps/mobile/lib/src/talks/talk_replay_playback.dart
- apps/mobile/test/twin_home_shell_test.dart
- apps/mobile/pubspec.lock
- this claim

## Evidence

First real local test compilation found invalid const AppBar constructors, literal escaped newlines in replay playback Dart source, and stale fake transport interfaces. Fix these compile blockers without product redesign. Fresh dependency resolution includes previously missing LiveKit dependencies. Preserve other work and extend exact ownership only if further compiler evidence requires it. Mobile Build CI has no allocated runner. Flutter 3.47.6, Dart 3.13.5, Android 37.0, Java 17 and Gradle 9.1.0 are available locally. Use CI=true to prevent Flutter's cloud metadata environment probe.

Gateway startup repair already merged via PR #399 and verified deployed; this lane owns mobile compilation only.

## Additional compiler-owned paths (2026-10-07T16:37Z)

- apps/mobile/lib/src/screens/explore/explore_screen.dart
- apps/mobile/lib/src/screens/you/my_talks_screen.dart
- apps/mobile/lib/src/screens/you/saved_talks_screen.dart
- apps/mobile/lib/src/screens/talks/talk_screen.dart: wrong live role enum only
- apps/mobile/test/talk_screen_test.dart: same live role enum
- apps/mobile/test/agent_recovery_test.dart: onboarding fake data arguments
- apps/mobile/test/home/home_continuation_test.dart: retired Home continuation API

Analyzer confirms compile blockers in these exact paths. Product behavior and other active lanes remain preserved.
