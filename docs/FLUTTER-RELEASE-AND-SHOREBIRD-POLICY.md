# Flutter-first mobile release and Shorebird update policy

## Device Contacts privacy and native release gate — 2026-10-08

The owner now explicitly wants a familiar Contacts directory in Chats and optional consented **local device-phonebook** viewing/invitations, as specified by [Contacts contract](CONTACTS-AND-ADDRESS-BOOK-EXPERIENCE-20261008.md). Android Contacts permissions, native plugin additions and iOS Info.plist/entitlements are **native signed binary updates**, never Shorebird Dart OTA patches. Require security/privacy/store disclosures, permission-denial usability, account-change purge, real physical Android/iPhone evidence before exposing phonebook claims. Matching uploaded address books to Masanawa users is **not automatically approved** by UI choice. The corrected [U21–U30/F01–F18](ADDITIONAL-U21-U30-AND-FOUNDATION-F01-F18-20261008.md) and [full unfinished audit](UNFINISHED-SCOPE-RECONCILIATION-20261008.md) do not change existing release/signing/update safety.


## Owner-approved U01–U20 expansion — 2026-10-08

New U01–U20 work is source-only until independently integrated/qualified. Flutter-first Shorebird signing, exact version compatibility, QA patch/restart/rollback and native/asset/engine app-store release rules remain unchanged. CI/device/provider/finance/voice qualification still mandatory. U20 owns release evidence, not production patch keys or deployment authority. See [development plan](20-WINDOW-AI-CHAT-EXECUTION-20261008.md) and [acceptance](20-WINDOW-INTEGRATION-AND-ACCEPTANCE-20261008.md).


**Status: owner-approved policy / implementation NOT STARTED / verification NOT DONE.** Adopted 2026-10-08. This document is the canonical release/update policy for the **consumer Flutter app** at `apps/mobile`. It is not evidence that Shorebird has been initialized, that a patchable APK exists, or that a production release is safe. The separate Flutter admin app at `apps/admin_mobile` needs an independent release/patching qualification before inclusion. Web and desktop deployments follow their own pipelines.

## 1. Architectural decision and non-goals

- **Flutter remains the one supported consumer mobile codebase for Android and iOS.** The owner cancelled the parallel React Native initiative; draft PR #504 was closed without merge. Do not recreate RN source or use this policy to alter Flutter UI, native dependency versions, API composition, signing, Firebase, or production configuration.
- **Remote update tiers (strict):**
  1. **Gateway/server-owned configuration and data**: authorized agent roster, pricing and eligibility, server-managed skill catalog, feature exposure, versioned shell-document and supported action payloads. No app rebuild when the installed client already supports and safely validates the contract. Never deploy arbitrary executable remote widgets/scripts or trust remote config as authority for money, identity or permissions.
  2. **Shorebird code push**: eligible Dart changes tied to an exact, already-released **Shorebird-enabled** Flutter binary. Patch download occurs on app launch and takes effect on a subsequent launch/restart; not guaranteed instant. Existing ordinary `flutter build` APKs **cannot** receive a Shorebird patch until replaced/upgraded by a Shorebird-built, correctly signed base binary.
  3. **New signed app release** through Google Play / App Store (or an explicitly managed, signature-compatible Android distribution): any Android/iOS native code, plugin/native library, permissions/manifest, entitlements, app identifier, Flutter engine/SDK, asset-bundle/font/image additions or changes, and any change outside proven Shorebird patch compatibility. Do not bypass patch native/asset-diff warnings.
- Neither tier 1 nor tier 2 bypasses Google/Apple policy: review the app's externally supplied functionality and rules for downloaded code with every materially changed feature. In particular, iOS App Review Guideline 2.5.2 restricts downloaded code that introduces or changes app features/functionality; do not assume a new product capability is suitable for iOS OTA merely because Shorebird can technically patch Dart. Use a normal reviewed binary for changes whose policy classification is uncertain.
- OTA is an **availability and fix-delivery tool, not feature completion or an alternative to security, CI, device, provider or financial acceptance**.

## 2. Hard entry conditions before enabling Shorebird in a production build

1. Complete ongoing main/PR consolidation (Work draft #497; `CONTINUE-HERE.md` freeze) and fix or explicitly fail release readiness gates; freeze and five-minute ownership rules still apply. This policy does not claim the Work window itself can be controlled from this chat.
2. Confirm the **actual signed distribution path** and baseline app ID/version/build number, Flutter stable version supported by the installed Shorebird CLI (`shorebird doctor`), Android min/target SDK, Play upload/App Signing ownership, Apple bundle/team/cert/profile, Firebase Android/iOS configs, LiveKit/microphone/camera/media permissions, and backup custody of signing keys. Existing Flutter `version: 1.0.1+2` is source metadata, **not verified store release state**.
3. Qualify a full real production-like Flutter **base binary** for both platforms first. R01–R19/C01–C08, 11 J journeys, Gateway authentication, LiveKit/Gemini audio, human chats, wallet/billing/crypto integrity, privacy, FCM/APNs, and two-device/restart/network recovery require actual evidence; never promote a build merely because `shorebird release` succeeds.
4. Introduce Shorebird in a narrow, separately reviewed implementation PR; run `shorebird init` from `apps/mobile` only once after account/environment ownership is agreed, store generated `shorebird.yaml` and app identifier in source, and retain normal Flutter debug/development commands. No production Shorebird account is assumed to exist yet.
5. Require **organization-controlled Shorebird access** and **customer-owned patch signing** from first production Shorebird release. Public key embedded at release via `--public-key-path`; private signing material injected only by local protected signing workstation or restricted CI/KMS, **never** in Git, logs, binary assets or Dart defines. Restore/key rotation and two-person publishing authorization must be documented before production enablement.
6. Make a **real dry-run and two-launch patch test** on a staging Shorebird build; verify invalid-signature rejection, failure-to-download fallback, restart handling, disconnected/low-memory Android, iOS test build, and successful rollback. Do not enable stable track until that is proven.

## 3. Release identities and immutable provenance

Maintain a release manifest (operator-side, containing **no secrets**) for each **platform × app identity/flavor × `pubspec.yaml` version+build × Shorebird release**. It must record: exact Git SHA and clean tree, locked Flutter/Shorebird/Dart tool versions, `pubspec.lock` checksum, compiler target/platform architectures, build flags and **names/hashed fingerprints only** of values in `--dart-define-from-file`, native Firebase config fingerprints (do not print credential values), signing certificate/team fingerprints, Play/TestFlight artifact identifier and SHA-256, Shorebird app/release ID, stable and staging patch numbers, approved approvers, acceptance evidence URLs, backend compatibility floor/ceiling and emergency contact.

- Use **unique monotonically increasing** Android versionCode / iOS build numbers for store releases. A Shorebird patch retains the base binary's store version; never confuse it with a new store binary.
- Pin the **same Flutter engine and compatible Dart/native/asset baseline** for the patch as for the original release. For multi-flavor or alternate entrypoints, record explicit `--flavor`/`--target`/`--dart-define*` settings. Avoid implicit `latest` patch targets; specify `--release-version`.
- **Android signatures:** store upload/app signing and sideloaded APK certificates must be tracked separately. A differently signed APK does not guarantee in-place upgrade; never tell existing sideload users to install an incompatible signature over their app. Plan data-preserving signed migration/reinstall guidance if the existing test APK is debug-signed.
- **iOS:** Mac/Xcode/provisioning, APNs entitlement, release signing, TestFlight and App Review are separate verification gates; do not claim completed iOS readiness from Android.
- Store original signed AAB/IPA/APK (where applicable), unpatched binary, symbol/mapping files and evidence privately with integrity checks. Never put signing keys or full Firebase values in Git.

## 4. Compatibility and emergency invariants

- Gateway and app must negotiate capabilities and a **minimum supported client version** separately from server feature rollout. Every mobile API/action/realtime event/shell document is versioned and fail-closed on unknown fields/actions. An old patch/base must remain usable during backend rollout; never let an older client silently perform an unauthorized transfer or repeat a webhook.
- Financial operations remain **server-authoritative**, authenticated, idempotent and receipted. A patch is not allowed to mutate financial ledger contracts/migrations without an independently rollback-safe server deployment and end-to-end reconciliation. Use **expand → migrate → contract** migrations and delay destructive contract until all supported app versions have moved. Shorebird rollback does not rollback server/database state.
- Remote config/flags may **disable** affected client entrypoints or feature exposure on incident. They must not grant permissions, reveal unauthorised chat, change amount/payee/terms outside signed server quote, or bypass finance checks. Never rely on a client-only kill switch for server authorization.
- Preserve login/session refresh, account-switch isolation, push registration, wallet transaction recovery, LiveKit realtime reconnection, and offline caches across patch upgrades/downgrades; account-specific data must never leak after signout.
- Observe startup/crash metrics, patch applied/rejected/rollback signals, voice audio, payment double-execution/idempotency, push and login health per **platform + binary + patch**; rollback trigger thresholds and named responders must be set using measured baseline before public exposure.
- Shorebird server unavailability must never make app startup depend on OTA connectivity. The embedded signed release remains viable. Do not put startup-critical secrets or dynamic downloadable code in remote presentation contracts.
- **Patches are not guaranteed instantly installed or globally retractable instantly.** Failing clients/offline devices may still run bad code until update check/restart. An incident must also use Gateway fail-closed feature controls and, if necessary, an emergency signed store release.

## 5. Controlled promotion and rollback

Only authorized release managers may publish. For every change: immutable branch/PR and approved diff → choose tier (config/OTA/store) → compatibility audit → static/test/security gates → build patch **with `--dry-run`** → signed **staging** patch tied to explicit base version → `shorebird preview` on real QA devices → two launch cycles + golden journeys + regression metrics → recorded approval → promotion to **stable** → monitor cohorts and document outcome.

**Important:** publishing to Shorebird's `staging` track does **not** automatically restrict distribution by Play/TestFlight user groups; ordinary customers follow `stable`. QA uses `shorebird preview --track staging` or an explicitly implemented, authenticated `shorebird_code_push` channel subscription. Publishing a patch directly to stable targets all eligible stable devices of the given binary version. **Percentage-based OTA rollouts are NOT built in by default**; they require reviewed cohort-selection/update logic and secure server flags before claims of 5/20/50/100 staging can be made. If that mechanism is not built and verified, use a private staging patch followed by an explicit stable promotion with incident readiness, never claim canary percentages.

On regression: invoke server-side disable/stop affected action (where needed), **roll back the exact platform/release/patch** in Shorebird console or `shorebird patches rollback --release-version <version> --patch-number <n>` from the appropriate app context, verify fallbacks on at least one affected device at subsequent restart, monitor auth/ledger/media/push and retain the incident/trace evidence. Check whether lower-numbered patches also need rollback. `rollforward` is a new authorized decision; never automatically reenable money actions after rollback.

## 6. Verification gate and explicit handoff

Operational checklist, sample CLI sequence and acceptance matrix: [`../apps/mobile/docs/SHOREBIRD-QUALIFICATION-RUNBOOK.md`](../apps/mobile/docs/SHOREBIRD-QUALIFICATION-RUNBOOK.md). Existing mobile build procedures: [`../apps/mobile/docs/BUILDS.md`](../apps/mobile/docs/BUILDS.md). Product evidence: [`MOBILE-READINESS-PLAN.md`](MOBILE-READINESS-PLAN.md), [`REQUIREMENTS-RELEASE-GATE-CHECKLIST-20261008.md`](REQUIREMENTS-RELEASE-GATE-CHECKLIST-20261008.md), and [`WHOLE-PRODUCT-ACCEPTANCE-JOURNEYS.md`](WHOLE-PRODUCT-ACCEPTANCE-JOURNEYS.md). Unresolved Firebase values/device acceptance live in Work PR #497 (`docs/FIREBASE-LOCAL-COMPILATION-HANDOFF.md` on that branch), not on main.

**Current verified state at policy creation:** main `226d0c58632b243661ab24904cca75700ed474d4`; freeze active, Work #497 draft/unmerged, hosted Actions issue #457 unresolved, provider and device verification absent. **No Shorebird command, build, signing, patch or deployment was executed by this documentation change.** Do not turn this policy into a `DONE` lane without live evidence.

## Official operating sources (review for CLI changes before execution)

- https://docs.shorebird.dev/code-push/ — what code push does and when updates load
- https://docs.shorebird.dev/code-push/release/ — release signing/build artifact baseline
- https://docs.shorebird.dev/code-push/patch/ — native/asset compatibility, dry-run, tracks, exact versions
- https://docs.shorebird.dev/code-push/guides/patch-signing/ — public-key embedding and private-key signing
- https://docs.shorebird.dev/code-push/tracks/ — staging/QA subscription semantics
- https://docs.shorebird.dev/code-push/rollback/ — rollback semantics
- https://developer.apple.com/app-store/review/guidelines/ — App Review rule 2.5.2
