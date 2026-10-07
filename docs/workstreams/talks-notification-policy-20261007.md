# Talk notification policy — 2026-10-07

- **Owner/window:** current ChatGPT transformation window
- **Branch:** `work/talks-notification-policy-20261007`
- **Base SHA:** `7344a0d5de7134c7360b0137487285c1ecc0a873`
- **Lane:** committed Talk events -> privacy-safe push intents + dedupe
- **Lease:** active

Owned:
- `services/gateway/src/talk_notifications/**`
- focused tests
- this handoff

Not owned:
- shared Gateway composition
- FCM sender implementation
- Talk Activity persistence
- mobile UI
- gifts/replay/AI Seat/moderation owners
- migrations/deployment

Rules:
- Push only from committed domain outcomes, never optimistic UI events.
- Push dedupe is recipient + event identity.
- Lockscreen payloads contain no balances, exact earnings/gift amounts, transaction ids, private Gwani content, or provider internals.
- Declined/refunded AI sponsorship may notify the payer but cannot expose ledger internals.
- Followed-Host-live/replay-ready/hand outcome invitations may deep-link to Talk.
- Activity remains the durable in-app history; push is best-effort delivery, not system of record.

Status: implementing.
