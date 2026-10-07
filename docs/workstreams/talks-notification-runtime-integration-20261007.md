# Talk notification runtime integration — 2026-10-07

- **Owner:** current ChatGPT Talks implementation window
- **Branch:** `work/talks-notification-runtime-integration-20261007`
- **Base:** `25ef7be2cef9047c25696a30f5d918634a1e2f52`
- **Lane:** compose mainline Talk push dedupe + existing FCM sender, expose runtime seam, schedule bounded retention cleanup
- **Owned paths:**
  - `services/gateway/src/talk_notifications/runtime.ts`
  - focused runtime/composition tests
  - isolated additions to `services/gateway/src/main.ts`
  - this workstream
- **Reuses:** mainline `createPostgresTalkPushDedupeRepository`, merged Talk notification policy/delivery, existing `MobilePushSender`.
- **Not owned:** dedupe migration/repository, Firebase credentials, mobile settings UI, unrelated domain producers.
- **Rules:** no push before committed event; dedupe before send; no Firebase config means delivery runtime remains unavailable; cleanup is bounded/best-effort and never crashes Gateway.
- **Status:** active.
