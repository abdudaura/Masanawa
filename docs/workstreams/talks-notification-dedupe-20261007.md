# Talk push dedupe persistence — 2026-10-07

- **Owner/window:** current ChatGPT transformation window
- **Branch:** `work/talks-notification-dedupe-20261007`
- **Base SHA:** `52e1f04b11a4a2c96239e93c9acb0ea5c9537ea1`
- **Lane:** durable dedupe claims for Talk push delivery
- **Lease:** released with implementation handoff

## Owned

- `packages/talks/migrations/0010_talk_push_dedupe.sql`
- `services/gateway/src/talk_notifications/postgres_dedupe.ts`
- `services/gateway/src/talk_notifications/postgres_dedupe.test.ts`
- this handoff

## Implemented

- Durable `talks.push_dedupe` identity store.
- Atomic `INSERT ... ON CONFLICT DO NOTHING` claim semantics across workers/processes.
- Dedupe identity is exact tenant + recipient + deterministic event key.
- No notification title/body, money amount, Talk content or provider payload is persisted.
- Default 30-day retention; configurable 1–365 days.
- Explicit bounded `purgeExpired` maintenance operation.
- Duplicate claim returns `false` so delivery coordinator skips FCM.
- Retention timestamps are derived from canonical event time and normalized to ISO.

## Tests

- first claim returns true;
- duplicate claim returns false;
- SQL conflict identity is exact;
- retention expiry calculation;
- bounded purge;
- malformed ids/timestamps/retention/cleanup limits rejected.

## Handoff

- Compose this repository into the already-merged `createTalkPushDelivery` coordinator.
- Schedule bounded `purgeExpired` as low-priority maintenance.
- Producers must reuse committed event identity on retries; never generate a new event id just to resend.
- Push remains best-effort delivery; Activity/domain records remain the source of truth.

No shared Gateway app/main composition, FCM sender, event producer, mobile UI or deployment change was made.

**Status:** durable Talk push dedupe is complete.
