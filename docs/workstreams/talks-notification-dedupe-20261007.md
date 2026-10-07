# Talk push dedupe persistence — 2026-10-07

- **Owner/window:** current ChatGPT transformation window
- **Branch:** `work/talks-notification-dedupe-20261007`
- **Base SHA:** `52e1f04b11a4a2c96239e93c9acb0ea5c9537ea1`
- **Lane:** durable dedupe claims for Talk push delivery
- **Lease:** active

Owned:
- `packages/talks/migrations/0010_talk_push_dedupe.sql`
- `services/gateway/src/talk_notifications/postgres_dedupe.ts`
- `services/gateway/src/talk_notifications/postgres_dedupe.test.ts`
- compatibility tests under `talk_notifications/**`
- this handoff

Not owned:
- shared Gateway app/main composition
- FCM sender
- Activity persistence
- event producers owned by Gift/AI Seat/replay/moderation lanes
- mobile UI
- deployment

Rules:
- claim is atomic across workers/processes;
- dedupe identity is tenant + recipient + deterministic event key;
- duplicate claim returns false without sending;
- push remains best-effort, Activity/domain state remains durable truth;
- retention cleanup is explicit and cannot delete recent claims;
- no payload content is persisted in dedupe rows.

Status: implementing.
