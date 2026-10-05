# Creator onboarding continuation

Owner: ChatGPT ordered customer-journey window, 2026-10-04 22:11 Lagos.
Branch: `work/creator-onboarding-20261004`
Base: main `3906419669203844018b6687ad06ab2af48654eb`.
Priority: 1 of the user-approved seven-item sequence. Task 072/creator-clone product integration; no roadmap gate closure implied.

Exact owned paths:
- packages/identity/src/clone-setup.ts
- packages/identity/src/clone-setup.test.ts
- packages/identity/src/index.ts (append-only clone-setup export)
- packages/identity/migrations/0003_clone_setup.sql
- adapters/storage/postgres/src/identity/clone_setup.ts
- adapters/storage/postgres/src/identity/index.ts (append-only clone_setup export)
- services/gateway/src/clone_onboarding.ts
- services/gateway/src/clone_onboarding_routes.ts
- services/gateway/src/clone_onboarding.test.ts
- services/gateway/src/clone_onboarding_routes.test.ts
- tests/integration/clone-setup.test.ts
- docs/CLONE-ONBOARDING.md
- docs/workstreams/creator-onboarding.md

No existing Gateway app/main, creator_clone.ts, mobile, Teaching, Commerce, provider,
channel, shared root exports/config/lockfile or foreign migrations will be edited.
#104 owns mobile/Gateway composition; request its registration of the new registrar
and generic shell projections. Read current support-agent directory/preferences;
never hardcode Character IDs or duplicate support selection authority.
Identity owns resumable profile drafts; canonical personal-clone provisioning owns
actual creation and its one-clone constraint. Confirmation pins an exact preview
revision before provisioning, with crash recovery and current authorization.

Additional exact owned paths for this continuation:
- services/gateway/src/clone_onboarding_shell.ts
- services/gateway/src/clone_onboarding_shell.test.ts

Implemented server slice: 0d65c552b9707e2fdf97e2b2f38511006aa130ba. Forty focused tests pass; architecture/compatibility checks and strict typechecks pass. Eight SQL cases pass on PGlite PostgreSQL 18.3; separate-session native PostgreSQL acceptance remains open. No deployment.
Implemented: nine shell bridge regressions pass; 49 focused and 70 including architecture tests pass; Gateway strict typecheck passes. Server-generated ShellDocument profile/review/recovery projections and authenticated action binding bridge, without editing #104/#125 mobile or shared composition. Existing dispatcher owns opaque-token custody; this bridge must require its verified binding. Database qualification is also being pursued. Later features remain open; independent useful work may proceed while integration dependencies are blocked.
Last update: 2026-10-04 22:41 Lagos.

## Independent economic-view continuation

Integration/customer-journey scope remains in this window. Onboarding remains first priority; its #104/#89 composition and qualified Core dependencies remain active. While those are blocked, implement item 4's read-only economic ShellDocument projection using the current authorized CreatorEconomyService, without changing money custody or the unsafe legacy allocation path.

Additional exact owned paths:
- services/gateway/src/creator_economy_shell.ts
- services/gateway/src/creator_economy_shell.test.ts
- docs/CREATOR-ECONOMY-VIEW.md

No Commerce model/repository, existing creator_economy.ts, mobile or shared app/main edits. #90 owns durable financial commands; #104 owns mobile/session dispatch. No write action is offered until those dependencies are explicitly composed. Read errors must not render fabricated zero balances.

## Current verified handoff

Implemented: profile/support/recovery ShellDocuments and verified-binding action bridge; read-only economic ShellDocument and fresh private/no-store read route. Onboarding response caching is disabled on success and failure. Eight SQL engine cases pass, including direct NULL-preview and malformed RequestId rejection. No native PostgreSQL concurrency or physical app pass.
Validation: 55 focused Identity/Gateway/HTTP/shell/economic tests; 21 package/adapter boundary tests; nine existing Gateway/directory/Identity compatibility tests: total 85 in 11 files, all pass. Identity, Gateway and Postgres strict typechecks and diff whitespace checks pass. PGlite 0.5.8 reports PostgreSQL 18.3; all eight SQL cases pass via a temporary serializing pool harness, not separate pg sessions.
Remaining: shared Gateway/mobile registration and current session/action custody (#89/#104/#125); actual qualified Core/support configuration; the later feature dependencies recorded in docs/CREATOR-ECONOMY-VIEW.md. Retain exact claims until explicit coordinated transfer/merge. No deployment, merge or full seven-feature completion claimed.

## Current-main and mobile continuation — 2026-10-05

Main is now a97df254ff04c717e940a7c86f4b5824dea7629d. PRs #104/#125/#127/#131/#132 have merged. Reconcile only this branch's owned changes with current main, preserving canonical PlatformSession authentication and every newer shared export. The old wildcard mobile-shell claims no longer imply ownership of new unrelated UI. Active #128/#129/#130/#126 exact claims were inspected; none owns the clone setup screen or these new clone-onboarding-specific files.

Additional exact owned paths:
- apps/mobile/lib/src/agents/clone_onboarding.dart
- apps/mobile/lib/src/agents/clone_onboarding_transport.dart
- apps/mobile/lib/src/state/clone_onboarding_controller.dart
- apps/mobile/lib/src/screens/settings/clone_setup_screen.dart
- apps/mobile/test/clone_onboarding_test.dart
- apps/mobile/test/clone_onboarding_transport_test.dart

Replace direct one-shot clone creation with saved draft/review/exact-confirm/resume/open flow. Use the existing normal ApiClient session/interceptor and RequestId helper. Do not edit shared providers, session state, router, masanawa_transport.dart, Gateway app/main, crypto finance, billing or admin files. Required service registration still belongs to shared composition; keep the registrar/appFactory seam usable and publish precise integration dependency.


## Implemented mobile continuation

Implemented the six claimed mobile files: authenticated saved draft, editable profile, server preview, explicit exact confirmation, interrupted-confirmation recovery, canonical clone opening and account-scoped disposal. No shared session/provider/router/composition source changed. Current-main focused backend checks: 49 tests pass. Standalone Dart source checks cover confirmation and transport behavior; Flutter/device and native separate-session PostgreSQL acceptance remain open. Full current-main typecheck is blocked by existing missing runtime files and unresolved shared auth types; do not describe the current branch as production-ready or all seven priorities complete.


Latest implementation: 3698974204d565a6c6e0fc26505d8d92b4099e26. Additional mobile regressions cover changed-preview identity, cancellation and strict ready-result custody; 13 Dart tests and analysis pass. Remote PR audit contains exactly 24 owned paths. Latest active-owner inspection confirms live Teaching composition is still in #89/#96, billing in #126, Float commands in #90, messaging in #92, crypto backend/mobile in #124/#130 and shared mobile auth in #128. Under docs/MULTI-WINDOW-WORK.md, these are coordination dependencies rather than authorization to overwrite active claims. Current shared Gateway registration/runtime files must be supplied by their owning windows before live completion; no seven-feature completion or deployment is asserted.

## User-authorized onboarding integration takeover — 2026-10-05

The user explicitly instructed this window to take over and complete its work. Ownership extends narrowly to services/gateway/src/app.ts and services/gateway/src/main.ts for onboarding options/routes/repository/Core/service wiring, plus services/gateway/src/clone_onboarding_startup.test.ts. Preserve every current unrelated auth, billing, crypto, shell and runtime change. This transfer does not authorize a wholesale replacement of other workstreams. Runtime dependency restoration, if necessary for verification, must use exact inspected upstream source with a separate explicit claim and must not fabricate certification or provider readiness. Complete default startup wiring rather than leave an appFactory-only handoff.

### Minimal build dependency reconciliation

Exact additional paths for the authorized integration takeover:
- packages/agents/src/inference.ts
- packages/agents/src/context.ts
- packages/agents/src/selection.ts
- packages/agents/src/inference_limits.ts
- adapters/storage/postgres/src/agents/context.ts
- adapters/storage/postgres/src/agents/selection.ts
- services/gateway/src/native_audio.ts
- packages/skills/src/selection.ts
- packages/skills/src/index.ts
- adapters/storage/postgres/src/skills/selection.ts
- adapters/storage/postgres/src/memory/context.ts
- adapters/storage/postgres/src/identity/repository.ts
- adapters/storage/postgres/src/agents/sessions.ts
- adapters/storage/postgres/src/agents/runs.ts
- adapters/storage/postgres/src/world/repository.ts
- adapters/storage/postgres/src/agents/mobile-shell.ts
- services/gateway/src/agent_conversation.ts
- services/gateway/src/agent_shell.ts
- services/gateway/src/agent_shell.test.ts
- services/gateway/src/alpha_executor.ts
- services/gateway/src/customer_auth.ts
- services/gateway/src/live_voice_token.ts
- services/gateway/src/mobile_push.ts
Restore only missing imported runtime dependency files from inspected #89 head 98b293b2020668b2123e4e7b9d6baae0ebfc1b88; append the required transaction-local reader functions without dropping current ownership APIs. Add missing contextual types to current merged methods and fix unresolved PlatformFinancialAuthorizer/invalid error-category/test-fixture signatures. No replacement of current auth or runtime behavior with an old branch. These are necessary to compile and verify normal Gateway startup; no unfinished branch is merged wholesale.

Required transitive owner read ports (append-only reconciliation):
- packages/identity/src/repository.ts
- packages/memory/src/context.ts
- packages/world/src/context.ts
- packages/world/src/index.ts

Build-gate reconciliation paths:
- packages/agents/package.json
- pnpm-lock.yaml
- config/production-env.json
- test/architecture/environment-contracts.test.ts
Add exact workspace dependencies/importer links required by restored Agents imports. Register already-used Gateway auth/model/mobile configuration names, classifying key/token/pepper/credential JSON values as secrets. Preserve all current lockfile importers and runtime settings; no dependency version upgrade. Extend the environment naming assertion only for the two already-used owner-specific RESEND_API_KEY and NEXT_PUBLIC_OPS_API_BASE_URL names.

- services/gateway/src/customer_auth.test.ts — assert typed canonical session 401 and database-outage 503 behavior; retain financial adapter's existing unauthorized contract.

## Completed takeover implementation

Normal Gateway startup now composes the draft repository/Core/onboarding service and normal app registers the six routes. Missing runtime import closure, exact owner read ports, contextual type failures, session-refresh/outage semantics, manifest/lock links and environment registry are repaired. Verification: 238 tests in 37 files; Gateway/Postgres/Agents/Skills strict typechecks; 15-package Gateway production dependency build; compiled production import; real loopback HTTP draft/confirm/interruption/resume/replay and authority tests. No provider deployment, fabricated Skill certification or full seven-feature completion asserted. Live Core/support configuration and user-owned device acceptance remain qualification gates rather than missing source wiring.

