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

Status: claim before implementation. Tests pending. No deployment.
