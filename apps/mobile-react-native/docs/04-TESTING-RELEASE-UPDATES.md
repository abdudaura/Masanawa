# RN test, device, release, update and rollback policy

Status: plan; no builds, Expo account, distribution project, APNs credential or release channel has yet been provisioned.

## 1. Layered verification requirements

- Static: pinned dependency/audit/license/secret scans, TypeScript strict and no unapproved deep imports, React Native codegen and schema snapshot drift, internationalization placeholders, accessibility lint, OTA/native boundary checks.
- Unit: normalization, auth state/refresh races, role gates, signed link expiry, money integer/decimal serialization, idempotency, event cursors, loading/retry/empty/denied mic, deep-link parsing, Gwani/Gwana attribution, user switch and storage purge.
- Gateway contract: snapshots from actual Fastify routes and packages/contracts; known error envelopes/status, route prefix exceptions, schema/event versions, test older Flutter client concurrently; admin/tenant and private/public authorization negatives, request replay and forged IDs.
- Integration: real disposable Postgres migrations + restored DB, live Gateway /readyz, authorized two-account OTP, persisted Talk/DM/agent history, ledger readbacks, no cross-client duplicate money operations, realtime reconnect/gap recovery, push registration/unregistration and signed file URL expiry. Never run Alpha seeds against production.
- Device E2E: at least two Android handsets including inexpensive/low-memory model, and at least one supported iPhone for iOS gating; actual second authenticated account. Test Android background/foreground/killed, network 2G-ish/throttled/airplane/reconnect, permission denied/revoked, Bluetooth/earpiece/speaker/headphones/call interruption, token expiry, clock skew, deep links, locale/RTL, Talk host leaves, payment uncertainty, account deletion and reinstall/update. Include tablet/orientation and desktop browser tests as their phases activate.
- Visual/UX: five correct root jobs, assistant center and safe area in 320/360dp text scaling, keyboard/screen-reader/voice and full silent operation, accessibility contrast and RTL, body language of live vs replay vs private chat. Screenshots do not substitute for API evidence.
- Cross-client golden journeys: J01-J11 and GJ-01-GJ-17 with A on Flutter / B on RN and vice versa when qualified; continue same server-authenticated conversations and receipts across devices. Extra negatives: no DM in public stage, no voice capture on tab entry, no repeated transaction after ambiguous 408/500, no loss of refresh token/account isolation, no private push previews.
- CI: keep RN jobs scoped to RN changes after code exists, but always run shared contract cross-client gates when core contracts change. CI issue #457 must be resolved/Work alternative executed before using green verification labels. Do not fabricate passing tests or release.

## 2. Versioning, signing, compatibility and distribution

Build outputs: Android APK for internal device testing, Android AAB for Play production, iOS IPA via signed TestFlight/App Store builds. Select final application IDs, signing keys, team provisioning, APNs/Firebase Android+iOS registrations and store listing ownership before distributing; don't reuse the Flutter identity or keys without an expressly approved in-place replacement. Never commit google-services.json with nonpublic environment assumptions, secrets, keystores, .p8 keys or private certificates. Firebase public client configuration alone isn't a server key, but still manage projects/environments deliberately. Use build-time public environment config and server-side vault/approved credentials only.

Track four independent axes: (1) native app version/build number and signed binary; (2) JS bundle/OTA runtimeVersion and update ID/channel; (3) Gateway API major + event/payload schemaVersion; (4) server-provided UX/capability configuration version. Build a tested minimum-supported-binary/compatibility matrix and tell users when mandatory store update is actually required. Do not hot-patch an incompatible native library or silently drop old Flutter API clients.

Use internal/dev, staging/preview, production update channels and separate backend/provider environments; exact backend alias and staged environment are not yet verified. Capture artifact SHA, Git commit, native runtime, config schema, release notes, signing certificate reference and rollback pointer. Release staging checks run on the exact candidate builds, not source-only.

## 3. Eligible changes without reinstalling the app

Approach A (preferred whenever possible): server-driven capability lists, approved visual tokens, Agent roster, localized content/translated messages, supported shell-document/action cards and feature availability from the existing authenticated Gateway contracts. No arbitrary client-code execution, auth bypass or unbounded dynamic forms; schema-version and operation authorization are server-owned.

Approach B (conditional): signed OTA JavaScript/assets via Expo Updates/EAS Update IF native compatibility spike selects Expo, or a separately approved equivalent RN OTA mechanism. Restrict updates to JS/assets within same native runtimeVersion. Updating native modules, microphone/background entitlements, OS permissions, AndroidManifest/Info.plist, Firebase native SDK, target SDK, JSI/Turbo modules or app identity/signing requires a new store binary and regular staged rollout. Native security-critical fixes should use store release where required. Respect platform review/program terms and keep offline embedded fallback.

Before an OTA publish: run unit/integration tests, proof on preview build with identical native runtimeVersion, check allowlisted update channel, version and signature, app startup and app-state recovery. Release one small staged cohort (for example 5%, 20%, 50%, 100% subject to incident-free telemetry), monitor crash-free starts/JS exceptions/auth failures/network/resource regressions. Maintain kill switch for unsafe feature and stable rollback update and embedded bundle. Never let a mere remote flag authorize a payment, change a ledger number or expose private data.

Rollback: for eligible JS/assets pin/republish last known good compatible update or embedded update; for incompatible native failure halt rollout and ship tested store patch, leaving existing Flutter client supported. For backend changes use API major backward-compatible dual support and reversible changes or forward-fix migrations with actual restore plan; never downgrade production schema blindly. For severe financial/privacy regressions fail closed at Gateway, suspend the specific feature for both clients, reconcile outstanding operations, notify affected users, preserve audit. Device session/history must survive safe OTA restart and crash recover.

## 4. Acceptance metrics and observable evidence

Require reviewable run logs and linked build IDs/SHAs for: install/launch/sign-in success, crash-free sessions, cold/warm startup, tab switching and chat-history resume latency, RN JS/native memory and network consumption on low-cost Android, Talk live audio two-device stability, DM send/ack/replay under loss, notification open success, payment quote-to-authoritative-receipt consistency, accessibility and localization, battery cost, rollback demonstration. Agree numerical SLO thresholds with product/runtime owners after measuring Flutter baseline; do not invent pass thresholds.

Support plan: RN opt-in beta cohort with separate installer and explicit early-adopter disclosure, bug/report/support contacts, remote disable for specific feature, fallback to Flutter without data migration where same backend records apply, logout/delete policy for local RN caches, no forced replacement. Prepare stores' privacy declarations, microphone/audio/background/notifications consent copy, data export and account deletion instructions, regional finance eligibility, incident and on-call runbooks.

## 5. Vendor documentation to revalidate during kickoff

Expo Updates compatibility/runtimeVersion: https://docs.expo.dev/eas-update/runtime-versions/
Expo EAS deployment and rollbacks: https://docs.expo.dev/eas-update/deployment/ ; https://docs.expo.dev/eas-update/rollbacks/
Expo update rollout controls: https://docs.expo.dev/eas-update/rollouts/
Expo web options: https://docs.expo.dev/workflow/web/
These are a technology OPTION, not proof that Expo is installed or suitable for this app. Recheck security, SDK versions and store terms before enabling OTA.