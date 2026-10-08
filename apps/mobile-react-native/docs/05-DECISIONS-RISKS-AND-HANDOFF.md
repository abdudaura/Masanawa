# RN decisions, risks, handoff and adoption gates

Audit 2026-10-08 from main 226d0c58632b243661ab24904cca75700ed474d4.
Scope owner: future explicitly claimed RN initiative. Current state: PLANNING ONLY; no RN source, migration, build, tests or release.
This document is a SHA-specific planning handoff for the single Work integrator, not evidence of R/C implementation completion.

## 1. Decisions now settled by existing product/architecture

1. A SECOND consumer client stays in apps/mobile-react-native; Flutter apps/mobile and admin_mobile are preserved and maintained. No existing auth/Gateway/DB/commerce rewrite.
2. Final phone UX uses Talks | Chats | Assistant | Wallet | Agents (Assistant center), regardless of old Flutter four-tab code. Public Talks, consenting private human Chats, one private Gwani/Gwana Assistant, separate Wallet and Agents remain different privacy/role domains.
3. Server is the source for identity/roles, Agent/Twin roster, session/thread IDs, Talk/Seat permission, financial quote/ledger/status, realtime admission, media policy and push routing. No RN server-only secrets.
4. Desktop consumer currently targets apps/web/Next.js foundation. Responsive product and schema parity is required; sharing RN Web components and a separate installed desktop binary are NOT yet approved architectural decisions.
5. This is not a migration or Flutter deprecation approval. Each client must remain backwards compatible with the canonical API lifecycle.
6. Native-compatible content/config changes can be server-driven; JS/assets OTA can be evaluated only after the RN runtime is chosen. Not every app change is hot-updatable.

## 2. Unresolved decisions to close before P1

| Decision / evidence sought | Owner and required action |
| --- | --- |
| Expo dev client/prebuild vs bare RN, exact pinned versions | RN technical owner: run LiveKit/Gemini full-duplex, record/PCM, FCM/APNs, encryption, background and signed-media compatibility spike on Android+iOS; record ADR. |
| Native identities and store topology | Release owner: distinct package/bundle IDs for side-by-side beta; signing, ownership, privacy manifests, Firebase projects, entitlements and future replacement decision. |
| Contract generator for React Native | Gateway/contracts owner: reviewed JSON Schema/OpenAPI export with route exceptions, schemaVersion, error envelopes, numeric/precision fixtures, app minimum-version matrix. |
| Realtime private messaging | Work C02/C03/C04/C05 owners: reconcile conflicting PRs, agree stable cursor/outbox/upload/push/privacy semantics and recovery. |
| Gwani/Gwana Assistant | C07 owner: stable single workspace/thread/persona attribution, action card and accessible Live audio contract. |
| Qualified money | Finance R05/R06/R07/R08/C06 owners: provider readiness, custody, fiat/billing qualification, exact quote/consent, compliance and reversible rollout. |
| Crash reporting/analytics and SLO budgets | Security/ops owner: select privacy-safe observability, measurable low-end Android baselines, crash/latency thresholds and notification redaction. |
| Desktop sharing | Web owner: compare RN Web vs Next.js pure-module reuse on pilot with accessible keyboard/desktop media support; no premature web rewrite. |
| Current main vs deployed Gateway readiness | Work/infra owner: resolve Actions #457, reproduce tests on exact SHAs, verify /readyz, migrations, encrypted off-account restored backup and provider configuration. |

## 3. Risk register and controls

| Risk | Impact | Control / release stop |
| --- | --- | --- |
| Parallel development collisions while main is frozen | Duplicated API/schema, lost Flutter branch code | Isolated docs path only now; recheck main and PR files, five-minute claims and freeze status before code; integrate via designated Work owner. |
| Four-tab Flutter source vs five-tab target | Route leakage, wrong DM/Assistant semantics | One approved final UX contract; new RN five-tab from start; regression/deep-link mapping; coordinate #493/#497. |
| Unmerged C01-C07 branches and duplicate DM/cache migrations | Incompatible history/privacy/event contract | Wait for canonical merged APIs, avoid own migrations and invented shortcuts; contract fixtures and A/B two-device tests. |
| Expo/React Native native media incompatibility | Voice/live Talking unavailable or crash | No Expo Go-only claim; real native prototype before scaffold lock; keep bare RN option. |
| Two installed apps with same customer account | Token confusion, FCM duplicate push, inconsistent badge/unread or update collision | Distinct installation IDs; backend registration/admission/dedupe; per-app secure storage; tested logout and multi-device routing. |
| Financial/regional compliance/latency | Wrong/duplicate charge or misleading balances | Ledger-authoritative quotes/idempotency/settlement, feature gate, sandbox and production qualification, readback/reconciliation; fail closed. |
| PII/audio/user consent leak | Private message in public Talk or push | Distinct media grants, scope-aware signed URLs, safe notifications, explicit mic, permission-denied tests, encrypted caches and deletion. |
| Hidden version/OTA incompatibility | Crash/soft brick, forced reinstall | Native runtimeVersion, preview channel, eligible JS-only, staged rollout, embedded fallback and store rebuild for native changes. |
| Browser vs native portability | Fragile UI/tooling or duplicate business state | Share contracts/portable pure logic and UX jobs first, platform-specific implementation second. |
| Firebase present but unqualified | RN push not working after installation | Local-agent config handoff from #497, APNs + Android application per environment, actual physical device sender-token-delivery test. |
| Underpowered handsets + slow networks | Unusable chat/live audio and large install | Benchmarks on low-memory Android, selective cache/bundle, scroll virtualization, bitrate and offline fail-safes. |
| Unrestored production DB / stale deploy / exhausted CI | Feature seems done but data unsafe | No financial/mobile release until restore, schema /readyz and Work executed checks; no inferred test pass. |

## 4. RN supplement vs replacement decision gates

**Supplement as optional separate app** once: native IDs/signing correct, no existing Flutter files changed, real signed iOS+Android builds, OTP/logout/token rotation, five-root route semantics, core source-backed read flows, security/privacy, basic voice/quiet paths, network recovery and supported-device accessibility verified; correct rollout/rollback telemetry and support channel exists. Clearly label unavailable gated features. Flutter support continues.

**Target a user cohort/platform as default RN** only when: that cohort's J01-J11/GJ journeys and relevant R/C features pass end-to-end against real backend/providers, localized accessibility and low-end performance not worse than measured Flutter comparator, consistent server ledger/conversation histories, no critical security/privacy/regression bugs, no unsupported region/device, app-store rollout and rollback drill proven, support and incident ownership assigned, owner approval documented. Gaps must be explicitly disclosed and not silently degraded.

**Replace Flutter for a defined supported cohort** only after sustained real-world RN telemetry and side-by-side parity, explicit consumer migration decision, data/session recovery strategy, feasible store identity and upgrade constraints, signed app verification and a reversible transition with support window. Never delete/discontinue Flutter solely because RN source exists or a beta performs well. Android-only qualification never implies iOS or desktop readiness. Desktop can supplement native with apps/web independently and is not a prerequisite for a phone release.

Measure candidate readiness per feature rather than a global YES flag: SOURCE_PRESENT, CONTRACT_TESTED, INTEGRATION_TESTED, 2_DEVICE_VERIFIED, PROVIDER_QUALIFIED where relevant, RELEASE_ELIGIBLE, DEPLOYED_VERIFIED, each with evidence SHA, device/OS/build and date. A required missing layer means NOT READY.

## 5. Exact planning handoff and no-overlap envelope

Base main SHA: 226d0c58632b243661ab24904cca75700ed474d4.
Branch: plan/react-native-parallel-20261008.
Owned paths: apps/mobile-react-native/** only.
Requirements/journeys: approved R01-R19/C01-C08 plus J01-J11 and GJ-01-GJ-17, P/N/T/M/A/W/Q as applicable; no new competing task IDs.
Changed layers: docs/directory only. DB, backend, API, auth, Flutter, Web, Gateway config, deployment, tests, package manager: NO CHANGES.
Verification ACTUALLY EXECUTED: GitHub main tree/representative source/docs/PR read; branch/commit and draft PR link to be recorded in PR; no local build or executable test was run in this planning activity.
Verification NOT EXECUTED: pnpm check, pnpm test:contracts, Flutter pub get/analyze/test/build, real disposable Postgres, LiveKit/Gemini, Firebase APNs/FCM, Play/TestFlight, RN dependencies/binaries/physical devices; new RN code does not yet exist and established #457/shared provider/device blockers apply.
Critical dependencies: consolidation Work PR #497 and associated #461/#468/#472/#475/#473/#483/#478/#474/#476/#480/#493; check current state first. Current CI #457, backed-up/restored DB proof, staging Gateway and /readyz are outstanding.
Security/data impact: NONE from this planning commit; future RN controls defined in other documents. No provider request or financial transaction executed.
Expected review status: DRAFT / UNMERGED during consolidation freeze; planning accepted does NOT close R/C lanes.
Release gate state: SOURCE_WRITTEN=NO (RN app), LOCAL_TESTED=NO, CI_EXECUTED=NO, DB_INTEGRATED=NO, APP_INTEGRATED=NO, DEVICE_VERIFIED=NO, PROVIDER_QUALIFIED=NO, DEPLOYED=NO, MERGED=NO.
Rollback of planning: revert only new apps/mobile-react-native/** tree; Flutter, Web and Gateway unaffected.

## 6. Actions for final Work integrator / kickoff owner

1. Re-fetch newest main and all active drafts and ownership claims, including #497; preserve contributors' actual work and verify freeze end before implementation claim.
2. Review this planning-only PR as additive and confirm no changes outside apps/mobile-react-native. Merge only if approved without bypassing consolidation policy.
3. Produce current merged API/error/event/role/financial contract inventory with actual test fixtures and baseline Flutter device regressions; resolve C02/C05 duplicate branches at source.
4. Approve native architecture/media spike (Expo development builds vs bare RN), native IDs and chosen release/update channels with real iOS/Android tooling.
5. Claim P1 scope per five-minute ownership protocol and implement actual RN source, typed backend integration, security tests, real-device harness and signed preview build, then follow the phased proof gates.
6. Maintain Flutter continuously; do not convert existing users, close Flutter release work or repurpose apps/web without explicit reviewed decision.

This planning-only initiative is independent of ongoing R/C feature completion; it is not an exception to their verification and production release rules.