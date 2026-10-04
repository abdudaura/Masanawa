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
