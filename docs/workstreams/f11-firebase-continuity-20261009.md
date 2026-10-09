# F11 — Firebase integration continuity qualification (isolated verification recovery)

**Workstream:** F11 nonconflicting source qualification adjacent to F10/R14; not a takeover of Firebase #461, Work #497, F11 audit #518, CI #457 or any runtime owner.

## Claim, exact paths, SHAs

- Claim published **2026-10-09T02:06:40.168Z**, before source edits, at commit `363fb3852fd43751f35a19264740b81b25487152`. Owner: `chatgpt-f11-firebase-continuity-20261009`.
- Initial inspected `main`: `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Dedicated draft branch: `work/f11-firebase-continuity-guard-20261009`; implementation/docs checkpoint before this handoff: `51c7077998daf0eb38e6eb1ee232f7a9b090f2c0`.
- Scoped exclusive new paths: `tools/firebase-continuity/check.mjs`, `tools/firebase-continuity/check.test.mjs`, `tools/firebase-continuity/README.md` and this handoff. **No main, native, Firebase config, Flutter, Gateway, database, auth, CI, provider, financial, production or signing paths edited.**
- Source blob: `6387399fa05a139aeeeae5a761d2ff9ba074b964`; test blob: `19d77ea495427b935c14bcbf640bebba90a358ab`; both remote blob SHA values matched Node-executed local mirror's `git hash-object` exactly.
- Claim heartbeat/handoff recorded **2026-10-09T02:11:05.808Z**. Release of this bounded claim occurs with the draft PR handoff; no other ownership assumed.

## Code and scope

New no-dependency read-only Node CLI checks seven required files: Android/iOS project identity and notification/backup safety, `com.masanawa.app` package consistency, Android Google Services Gradle registration, Flutter Firebase library declarations and the external Firebase defines-file qualification path. It rejects missing/malformed native config, mismatched Android/iOS project or sender IDs, absent key fields, wrong Android/iOS bundle names, and client-side service-account/private-key material. Error diagnostics are **only fixed error codes and filenames**; config values are not printed. It does not overwrite or reconfigure Firebase. `--json`, `--root` and explicit exit codes enable future review at a specified composed SHA.

The legacy `main` currently lacks the native Firebase files supplied in unmerged #461/#497. **A failure on current main is expected and is not evidence the merged target or provider fails.** Do not make this a hard CI gate before Work combines the native source. Earlier #461 provides a native identity test; this tool is an additive **cross-platform and secret-boundary static guard**, not a substitute.

## Executed checks

- **PASS: 24/24** actual Node 22.16.0 tests from the local mirror matching the published Git blob SHAs. Run: `node --test tools/firebase-continuity/check.test.mjs`.
- **PASS:** `node --check` on each matching `.mjs` source file.
- Tests cover valid synthetic Android+iOS config, absent native files, corrupt JSON/plist, wrong application ID, registered client, wrong project/sender/bundle, missing public API field, dropped Gradle/Firebase dependencies/build defines/Android permission/private backup, service-account private keys in client configs, output redaction, CLI success/failure/usage codes.
- Tests use generated temporary directories and synthetic public identifiers; **this is PASS_SIMULATED (structural only)**, not live Firebase or actual Android/iOS build.
- **NOT RUN:** executing this checker over a full checked-out integration branch because private GitHub clone DNS is unavailable in local container; the GitHub connector allowed blob readback and branch commits, not native build execution. Flutter/Dart toolchain, Android/iOS devices, Gradle/Xcode, Gateway TypeScript/Vitest, live FCM, APNs, authentication, two-account token revocation, post-merge CI and delivery/notification tapping remain unverified. Existing Actions #457 capacity remains external to this PR.

## Work/F10 final integrator sequence (do not merge directly to production)

1. Preserve Firebase #461, Work #497 native/client/API configs and owner-controlled private Firebase defines; reconcile native package identity and `scripts/qualify-first10-android.ps1` safely. Do not commit provider secrets or local signing values.
2. At the **composed integration SHA**, run `node --test tools/firebase-continuity/check.test.mjs` and `node tools/firebase-continuity/check.mjs --root=. --json`; resolve real source contradictions without fabricating configs.
3. Run Android signing/Gradle/Flutter and iOS Xcode/APNs checks with authorized provider configuration. Execute device sign-in, token register/remove/switch, quiet hours, disabled permission, foreground/background/terminated message delivery and auth-protected deep links.
4. Record deployed SHA and provider/device evidence. Do not mark F10/F11 or R14 complete based solely on this source checker; no merge/deployment is authorized here.

**Status:** verification helper source implemented + locally tested, **F11/F10 release acceptance still PARTIAL_IMPLEMENTATION / UNVERIFIED E2E**, **DRAFT/UNMERGED**.
