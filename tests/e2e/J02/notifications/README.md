# C08 notification journey — source verification boundary

1. Server receives a trusted, claimed event from the **existing** `events.outbox` destination only.
2. `projectInboxEvent` validates the allowlisted kind and target, writes a generic safe preview, and propagates failures for canonical outbox retry.
3. `notifications.fan_inbox` deduplicates by `(tenant_id, fan_user_id, source_event_id)`; no money or push side effects.
4. An authenticated fan reads `GET /v1/notifications` (keyset cursor), opens a Room/post/case/wallet using the AF00 route handoff, and acknowledges `POST /v1/notifications/:id/read`.
5. A guest, cross-tenant fan, switch-account stale request, invalid cursor or unauthorised target never exposes another fan's event.
6. Offline cached view is read-only until a verified refresh; server remains authoritative on read status.
7. **Not E2E qualified:** AF00 must register forward-only SQL, authenticated principal resolver, canonical outbox destination and notification bell route; PG18 fresh/upgrade, real Flutter and Android still need checks at a unified SHA.

No extra broker, HTTP public insertion, user-created activity, WhatsApp automation or old Talks notifications are activated.
