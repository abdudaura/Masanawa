# Talk AI Seat Gateway + settlement integration — 2026-10-07

- **Owner/window:** current ChatGPT transformation window
- **Branch:** `work/talks-ai-seat-gateway-settlement-20261007`
- **Base SHA:** `ab4029e4d883990e9ceb88714f497413b7af5859`
- **Claim published:** 2026-10-07 10:04 UTC
- **Lane:** complete mobile AI Seat contract through durable Credits hold/capture/release and Host admission
- **Lease:** active; refresh through repository-visible commits

## Owned paths

- `services/gateway/src/talk_ai_seats/**`
- `services/gateway/src/talk_ai_seat_routes.ts`
- `services/gateway/src/talk_ai_seat_routes.test.ts`
- bounded AI-request delegation changes in `services/gateway/src/talk_moderation/service.ts`
- bounded composition changes in `services/gateway/src/app.ts` and `services/gateway/src/main.ts`
- `packages/commerce/migrations/0109_talk_ai_seat_runtime.sql`
- bounded PostgreSQL Commerce transaction helper export in `adapters/storage/postgres/src/commerce/repository.ts` + index export if required
- `docs/workstreams/talks-ai-seat-gateway-settlement-20261007.md`

## Reuses

- merged `@masanawa/commerce` Talk AI Seat state machine;
- merged Talk moderation / live canonical state;
- canonical Commerce Credits ledger;
- Talk Activity projection.

## Locked invariants

- candidate catalog price labels are display-only;
- quotes are server-derived and tenant/viewer/Talk/persona scoped;
- sponsor confirmation holds Credits and creates a Host request, never admission;
- Host-added confirmation is admitted/captured only if live capacity permits;
- Host accept captures the exact held amount and admits the exact quoted persona;
- Host decline / expiry releases the full hold;
- state revision, Host request, live Seat mutation and ledger settlement commit atomically;
- no earnings before capture;
- all write operations are idempotent by canonical request identity;
- Human Seats remain on the existing free moderation path.

## Status

Claim active; implementation in progress.
