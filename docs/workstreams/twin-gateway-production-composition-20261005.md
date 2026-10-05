# Twin Gateway production composition — 2026-10-05

Owner/window: ChatGPT continuation after Twin mobile shell integration.
Branch: `work/twin-gateway-production-composition-20261005`
Base: `15fc17695068a1f21ff58074028463c4bb6911b1`

Tasks:
- TWIN-010 / TWIN-020 / TWIN-080 / TWIN-081 / TWIN-082 / TWIN-084

Owned paths:
- `packages/identity/migrations/0004_twin_public_profiles.sql`
- `packages/identity/src/index.ts`
- `adapters/storage/postgres/src/identity/twin_profile.ts`
- `adapters/storage/postgres/src/identity/index.ts`
- `adapters/storage/postgres/src/index.ts`
- `services/gateway/src/twin_customer_authorizers.ts`
- `services/gateway/src/app.ts`
- `services/gateway/src/main.ts`
- focused new tests under `services/gateway/src/*twin*production*.test.ts`
- this claim file only

Scope:
- add an append-only identity migration for canonical public Twin profiles without modifying prior checksums;
- backfill existing ready personal clones into private-by-default public-profile records;
- add the PostgreSQL TwinProfileRepository adapter;
- compose My Twin and Explore into the production Gateway using real customer sessions;
- register existing Twin route modules through createGatewayApp;
- no Commerce mutation, paid voice, owner access, crypto/billing or chat runtime changes in this slice.

Privacy rule:
- migrated existing clones are discoverable=false; owners must explicitly publish them.

Status: active.
