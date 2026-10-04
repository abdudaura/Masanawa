# Android shell recovery — 2026-10-04

## Recovered window

The remaining-features window is PR #104, work/integration-mobile-shell-completion-20261004, inspected at 6fa3d8dea1ada3131e8f1c5126002104b4944c0f. Main is 3906419669203844018b6687ad06ab2af48654eb and does not contain that integration. This continuation is stacked on #104 as PR #125; neither is release-qualified. PR #122 independently provides a workstation build validator and is not duplicated here.

## Gaps corrected

- Live audio recreated/flushed AudioTrack for each provider chunk. Native start now reuses the initialized same-rate playing track; blocking writes run on Flutter's serial background task queue, handle partial writes, and report failure.
- The live session's asynchronous socket callbacks could overlap. Incoming setup/audio/interruption events are serialized; connection/setup timeouts and provider error/end handling release custody.
- Mute chosen before setup was ignored. Persistent mute and microphone-start coordination prevent setup or a delayed recorder start from bypassing mute/closure.
- Phone-call interruptions, audio-device disconnects and app backgrounding had no session observer. They now end the live session and clean up recorder/socket/native audio/focus; explicit release restores the Android route.
- Cold-start notification links were emitted before subscription. Validated pending navigation survives startup/sign-in and consumes once; logout clears pending navigation.
- Foreground notifications navigated without a tap. They now display a notification only; navigation follows selection.
- Android had a URI intent filter without delivery to the Dart shell. Initial/warm intents now use a native channel independent of Firebase. Default Flutter URI handling is disabled to prevent competing navigation.
- Push registration existed but had no call site. Authorized conversation synchronization now registers the installation after system permission; token refresh and permission grant retry registration. Disabled preference is stored securely, and logout clears registration context before waiting on I/O.
- History/reconciliation/realtime callbacks did not guard connection generations. Stale connection results and scheduled reconnects are rejected; cursors/configuration reset when transport changes. History/reconciliation also reject cleared-thread results.

## Checks and limits

Added 11 Flutter regression cases across shell_deep_link_test.dart, live_pcm_audio_test.dart and live_voice_session_test.dart. These are not reported as passing: `flutter test test/shell_deep_link_test.dart` could not launch because Flutter is absent (exit 127). Dart/Kotlin/Android SDKs are absent too. A delimiter/conflict-marker scan passed for 11 changed source/test files and AndroidManifest.xml parsed successfully; those checks do not replace analysis, compilation or behavioral tests.

No Gateway, provider, migration, deployment or unrelated shared-file changes were made. Source is implemented and reviewable; actual push delivery, provider voice and physical-device acceptance remain unverified. Firebase build values/server credentials and #104 runtime deployment are external prerequisites, not established by this patch. Voice transcription remains excluded.

## Resume/build

Use the PR #125 branch for the combined #104 + continuation source; a pull of main alone does not include it. Run from apps/mobile:

```sh
flutter pub get
flutter analyze
flutter test
flutter build apk --debug --dart-define=AGENT_RUNTIME_ENABLED=true
```

Then verify on Android: muted-before-connect; uninterrupted audio over several chunks; incoming phone call/headset unplug/background ends live capture; end/restart and speaker route recovery; cold and warm `masanawa://chat/<authorized-character-id>` navigation; signed-out link waits for login; foreground notification does not navigate; tap does; permission enables authenticated registration; account/Gateway switch during history/reconnect cannot apply stale results. Keep #104 and #125 draft until actual checks pass, integrate without overwriting active branches, and preserve the provider/deployment claims.

