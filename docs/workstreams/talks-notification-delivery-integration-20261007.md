# Talk notification delivery integration — 2026-10-07

- **Owner:** current ChatGPT Talks implementation window
- **Branch:** `work/talks-notification-delivery-integration-20261007`
- **Base:** `52e1f04b11a4a2c96239e93c9acb0ea5c9537ea1`
- **Lane:** durable Talk push dedupe + production Gateway composition using existing push sender
- **Owned paths:**
  - `services/gateway/src/talk_notifications/**`
  - `packages/talks/migrations/0010_talk_notifications.sql`
  - isolated Talk-notification composition in `services/gateway/src/main.ts`
  - focused notification integration tests
  - this workstream
- **Reuses:** merged Talk notification policy/delivery coordinator and existing MobilePushSender.
- **Not owned:** Firebase credentials, mobile notification settings UI, unrelated producers, Billing/Crypto/Twin/channel code.
- **Rules:** no push before committed domain events; durable dedupe precedes send; absence of push credentials remains explicit fail-soft.
- **Status:** active.
