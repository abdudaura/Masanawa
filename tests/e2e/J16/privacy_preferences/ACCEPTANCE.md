# C06 / J16 — account privacy & optional notification delivery

**Source-only until integration and devices/providers are qualified.** Dedicated
fan session, shared C08 inbox, canonical events.outbox and J11 fan-memory controls
are reused; no second message journal, provider or identity principal.

## Actual journey
1. Sign in as fan A, open Home avatar → C05 Account → C06 Settings/privacy.
2. Language, theme, memory review, device security and notification inbox use
   app-owned destination callbacks; unavailable destinations are disabled, never fake.
3. C06 GET /v1/notification-preferences via the existing authenticated Dio.
   Absent rows default every *optional push* category to false.
4. Enable "Room answers"; PUT /v1/notification-preferences/room_answer
   with exactly {enabled:true}; reflect state only after verified server reply.
5. Trigger a trusted Room-answer event. C08 inbox event must remain durable and
   account-private whether optional push is ON or OFF. Worker MAY send an
   eligible external push only with verified opt-in. No alternate FCM sender.
6. Go offline, change a switch; show error/retry, no optimistic false success.
7. Switch to fan B while GET/PUT is pending: neither A's data nor late reply
   may render in B's settings; no tenant/user IDs are sent from Flutter.
8. Sign out and retry; 401 or missing owner key cannot mutate preferences.
9. In an outage, feature switch OFF returns 503 without account/DB work and
   optional push fails closed. C08 persisted inbox remains reachable separately.

## Checks due at integrated SHA
- Vitest: repo and route negative tests (tenant/user spoof, invalid body,
  account exclusion, idempotent persisted readback); worker push-off failure.
- PostgreSQL 18: fresh + upgrade migration 0002, duplicate/concurrent PUT,
  per-fan isolation, lossless C08 inbox preservation, restore/checksum.
- Flutter: repository parsing/auth epoch and 4 C06 widget tests; analyzer.
- Android: Tecno-class low-end scrolling, network transitions, account switch,
  accessibility labels, actual FCM consent permission and provider behavior.
- AF00: inject canonical session/pool + default-OFF flag, append migration
  root, optional push policy before the existing push sender, navigate C05→C06,
  wire memory (J11) and current language/theme UI. No unreviewed main deploy.
