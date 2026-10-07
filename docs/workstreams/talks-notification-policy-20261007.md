# Talk notification policy — 2026-10-07

- **Owner/window:** current ChatGPT transformation window
- **Branch:** `work/talks-notification-policy-20261007`
- **Base SHA:** `7344a0d5de7134c7360b0137487285c1ecc0a873`
- **Lane:** committed Talk events -> privacy-safe push intents + dedupe
- **Lease:** released with implementation handoff

## Owned
- `services/gateway/src/talk_notifications/policy.ts`
- `services/gateway/src/talk_notifications/policy.test.ts`
- `services/gateway/src/talk_notifications/delivery.ts`
- `services/gateway/src/talk_notifications/delivery.test.ts`
- this handoff

## Implemented
- Typed Talk push events for invitations, Raise Hand outcomes, AI Seat sponsorship/decisions,
  followed-Host-live, replay ready, gifts, earnings and platform notices.
- Deterministic recipient + event dedupe keys.
- Safe lockscreen copy with no balances, exact gift/earning amounts, transaction ids,
  private Gwani content or provider internals.
- Talk deep-link metadata limited to event kind/id and optional Talk id.
- High-priority classification for time-sensitive live/participation decisions.
- Push-enabled and quiet-hours policy.
- Delivery coordinator that evaluates policy, claims dedupe and calls the existing
  `MobilePushSender`.
- Activity remains the durable in-app history and push remains best-effort delivery.
- Focused policy and delivery tests.

## Integration handoff
- Producers must create Talk notification events only after their domain transaction commits.
- Use committed Activity/domain event identity as `eventId`; do not invent a new id on retries.
- Persist dedupe claims in a small unique-key store before delivery.
- Followed-Host-live should originate from committed Talk-live start plus canonical follow projection.
- AI Seat accepted/declined should originate from committed capture/release/Host decision.
- Replay-ready should originate only after canonical replay publication.
- Gift/earning pushes remain generic even though authenticated Activity may show amount labels.
- Shared Gateway composition can inject the existing FCM sender once competing integration lanes clear.

No FCM implementation, shared Gateway composition, Activity persistence, mobile UI or production deployment was changed.

**Status:** Talk notification policy + delivery coordinator complete.
