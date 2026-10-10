# F17 — Private human voice-note recorder lifecycle recovery

**2026-10-09 · STATUS: PARTIAL_IMPLEMENTATION · DRAFT #478 · UNMERGED · NOT DEPLOYED · NOT DEVICE VERIFIED.**

## Ownership / source selection

- **Claim recorded first** in this document on existing `work/c04-private-voice-notes-20261008`, original claim commit `90f063a21c2ec014b2e00cb48e80899ff0b8f40b`, at 2026-10-09 00:48 Africa/Lagos (2026-10-08T23:48Z).
- At claim: PR #478 last updated 2026-10-08T14:02:02Z, beyond five-minute ownership expiry. `work/f*` search showed only F11, no other F17 owner. Fresh 71-open-PR audit identified all U21–U30 claimed; F14 had resumed #468. Inspected current `CONTINUE-HERE.md`, U/F recovery matrix, C04 media contract and PR #478, Work #497 and U21 #508 changed paths.
- This deliberately **continues** existing C04/F17 PR #478; does not duplicate its `0018` SQL, media Gateway API, S3 service, Flutter voice controller or tests on a competing branch from `main`. Work #497 touches `services/gateway/src/human_media/**` but **not** this controller. Source work constrained to two Flutter paths and this handoff, with no shared composer/root-router/migration or native Firebase edits.

## Actual code changes

**Latest source/test checkpoint:** `7a2852169d6cae77568c2a2679117c4cebebc6c2` (original lifecycle commits `ade2ef9`, `854efd0`, `ee17443`, `6b7082d`; discard admission `23f9070` and seventh test `82faaba`; null native stop result safety `3c140f0` and eighth test `7a28521`).

1. `apps/mobile/lib/src/human_media/human_voice_controller.dart`
   - Exclusive `begin()` admission while a mic permission prompt, native recorder start, or native stop remains pending. Prevents duplicate taps from racing two recorders.
   - Cancellation generation fences and explicitly stops a native recorder whose `start()` returns **after** account logout, a conversation dismissal or discard. Deletes the late original/output private file. Handles exception after attempted native start by attempting stop and cleanup.
   - `stop()` tracks pending native stop, invalidates output after session cancellation and erases any alternate output path. A native `stop()` that returns null correctly retains the original private output path for review; otherwise deleting this file would silently break preview/send. Existing size and text fallback checks preserved.
   - `discard()` becomes a tracked cancellation operation; `shutdown()` joins in-progress discard/start/stop **before** native recorder dispose. New recording, preview and sending are refused while discard is still awaiting native stop. Recording/temp media state is erased; no new automatic microphone capture or unsupported codec assertions.
2. New `apps/mobile/test/human_media_recorder_lifecycle_test.dart`: **eight authored regression cases** using delayed permissions/recorder operations and a temporary real local file. Covers late start after logout, duplicate begin, discard during start, pending stop during shutdown, shutdown during discard, new start rejected during pending discard, preservation of the preview when native stop gives no path, and shutdown during OS permission dialog. Tests verify recorder stop/dispose count and file erasure, not microphone OS efficacy.

## Verification — precise truth

- GitHub source writes succeeded and the branch contains the two Flutter source/test paths plus this handoff. Source present does **not** mean executable tests passed.
- **NOT EXECUTED:** Flutter analyzer/tests/widget/APK because this available container has **no `dart` or `flutter` executable**; no local authorized clone of private repository (container GitHub hostname DNS inaccessible). Cannot substitute a Node copy of logic for Dart unit tests.
- **NOT EXECUTED:** GitHub Actions because shared issue #457 identifies exhausted runner quota; do not treat queued/zero-step runs as tests. No new CI spend or retries.
- **NOT EXECUTED:** running backend/PG18, migrated 0016/0017/0018, private S3 provider, exact authenticated C01/C02 membership, live Android microphone/opuses, two-account E2E, audio-focus/LiveKit/Gemini or background/restart proof.
- The pre-existing #478 C04 Gateway/Flutter component and backend tests remain authored, unverified; no claim of C04/F17 acceptance or all attachments implemented.

Reproduction **after** C04 source and dependencies are available in a verified checkout:

```sh
cd apps/mobile
flutter pub get
flutter analyze lib/src/human_media/human_voice_controller.dart test/human_media_recorder_lifecycle_test.dart
flutter test test/human_media_recorder_lifecycle_test.dart test/human_media_controls_test.dart test/human_media_playback_stop_test.dart
flutter build apk --debug
# In integrated repository root after 0016 C01, 0017 C02, 0018 C04
corepack pnpm --filter @masanawa/gateway-service typecheck
corepack pnpm exec vitest run services/gateway/src/human_media
```

Then run a disposable PG18 test including rollback/object-erasure trigger, a genuinely private AES256 S3 bucket and two separate human accounts. On the Android test device: deny microphone, hold permission while leaving account, start/stop rapidly, background/kill during recording, switch accounts during native start and stop, play while blocking/deleting, verify **no mic indicator after cancellation** and no residual temp audio. Repeat on slow devices; IOS Ogg capability remains to qualify separately. Verify no person audio is injected into public Talk/Gemini tracks.

## Integration dependencies and release gates

- **F14/C01 #468** contact consent, bilateral block and profile authority; **F15/C02 #472 vs #475** one durable DM schema; **F16/C03/C05** account-scoped persistent pending audio outbox; **R12** storage erasure before account deletion.
- **F12/R17/C08 #493 and Work #497** are the only shared Flutter five-tab/router owners. A verified C02 thread must embed the existing C04 panel; this recovery does not create a new tab or counterfeit server route.
- **Gateway/S3 composer** must mount the existing auth+S3 C04 runtime only after real C01/C02/migration, and F11 must execute isolated schema/app tests; no financial route, production secrets or native Firebase config is touched.
- Before merging #478, the integrator must reconcile this Flutter patch with any current Work branch, run all commands above, test real device and accounts, retain all backend authorization and audio erasure policies, and record immutable verified SHA plus results. Until then leave #478 **draft and unmerged**.

**Release status:** source commit/push yes; executable Dart tests no; backend/DB/device/provider QA no; composed app no; production no; merged no.
