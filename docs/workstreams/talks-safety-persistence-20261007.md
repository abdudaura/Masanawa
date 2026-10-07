# Talk safety persistence + HTTP — 2026-10-07

- **Owner/window:** current ChatGPT transformation window
- **Branch:** `work/talks-safety-persistence-20261007`
- **Base SHA:** `157a8f7129a79aac9a2ff4c8449830f4412282ef`
- **Lane:** durable reports, viewer block/mute, platform enforcement + HTTP contracts
- **Lease:** released with implementation handoff

## Owned
- `packages/talks/migrations/0009_talk_safety.sql`
- `services/gateway/src/talk_safety/repository.ts`
- `services/gateway/src/talk_safety/repository.test.ts`
- `services/gateway/src/talk_safety/service.ts`
- `services/gateway/src/talk_safety/service.test.ts`
- `services/gateway/src/talk_safety_routes.ts`
- `services/gateway/src/talk_safety_routes.test.ts`
- this handoff

## Implemented
- Durable authenticated safety reports with reporter + client-request idempotency.
- Server-side profile handle -> subject user resolution for viewer block/mute.
- Durable viewer-local block/mute preferences.
- Durable revisioned platform enforcement.
- Distinct customer-session vs platform-safety authority.
- Customer auth cannot write global enforcement.
- HTTP contracts:
  - `POST /safety/reports`
  - `GET /safety/profiles/:handle/preference`
  - `PUT /safety/profiles/:handle/preference`
  - `GET /admin/talk-safety/:kind/:targetId`
  - `PUT /admin/talk-safety/:kind/:targetId`
- Migration creates `talks.safety_reports`, `talks.safety_preferences`, `talks.safety_enforcement`.
- Report target/reason bounds reuse the canonical safety policy.
- Enforcement CAS writes fail closed on stale revision.

## Tests
Focused tests cover:
- report idempotency;
- block/mute profile resolution;
- customer/admin authority separation;
- enforcement revision custody;
- HTTP report/admin validation;
- PostgreSQL report conflict semantics;
- PostgreSQL enforcement CAS.

## Integration handoff
- Register `registerTalkSafetyRoutes` in shared Gateway composition once the active Gift/shared route work clears.
- Compose repository from canonical PostgreSQL pool.
- Inject ordinary platform customer session authorizer for reports/preferences.
- Inject a distinct admin/platform safety authority for global enforcement.
- Search/Explore/profile/persona/replay projections must hard-filter restricted/blocked targets before ranking.
- Replay enforcement must additionally call the canonical replay `platform_block` transition.
- Admin UI can consume the admin routes without exposing them to customer auth.

No mobile/admin UI or production deployment was changed.

**Status:** durable safety backend complete except shared composition/UI wiring.
