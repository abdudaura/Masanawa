# Talk notification delivery integration — 2026-10-07

- **Owner:** current ChatGPT Talks implementation window
- **Branch:** `work/talks-notification-delivery-integration-20261007`
- **Original base:** `52e1f04b11a4a2c96239e93c9acb0ea5c9537ea1`

## Outcome

While this lane was in progress, newer `main` landed a stronger durable dedupe implementation in:
- `packages/talks/migrations/0010_talk_push_dedupe.sql`
- `services/gateway/src/talk_notifications/postgres_dedupe.ts`

That mainline implementation adds validation, configurable retention, and bounded purge maintenance. It supersedes this branch's duplicate dedupe/migration files.

No duplicate PR should be opened from this branch.

A fresh integration lane should reuse mainline `createPostgresTalkPushDedupeRepository` and implement only:
- Gateway composition with existing FCM sender;
- runtime exposure for committed-domain producers;
- bounded purge scheduling/lifecycle cleanup.

**Status:** superseded in part by newer mainline dedupe; claim released.
