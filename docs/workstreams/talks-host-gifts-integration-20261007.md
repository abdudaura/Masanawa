# Talk Host gifts integration — 2026-10-07

Owner/window: current ChatGPT implementation window
Branch: `work/talks-host-gifts-integration-20261007`
Base: `1ec7c6d74380f83a636f67d76c89641baa9372cf`

## Reclaim source

PR #360 / `work/talks-host-gifts-20261007` is complete but stale under the
five-minute lease and is 92 commits behind current `main`. This lane preserves its
validated implementation while rebasing it semantically onto current `main`.

## Scope

Integrate launch-priority **Talk gifts/tips** end to end without introducing a second
wallet or client-selected recipient.

Owned paths:
- new `services/gateway/src/talk_gifts/**`
- new `services/gateway/src/talk_gift_routes.ts`
- new mobile Talk-gift contract/transport/state/sheet files
- focused Talk gift tests
- minimal semantic additions to current `services/gateway/src/app.ts`,
  `services/gateway/src/main.ts`, `services/gateway/src/twin_production_runtime.ts`
- minimal Talk Gift integration in current mobile `talk_screen.dart` + focused test
- this handoff

Not owned:
- AI Seat settlement
- Talk safety
- Direct Twin
- replay publication/egress
- library/search/social profile domains
- production deployment

## Invariants

- POST `/talks/:talkId/gifts` accepts only `requestId` + integer Credits.
- Recipient is always resolved server-side from canonical Talk Host ownership.
- Client cannot nominate a recipient or recipient account.
- Self-gifts are rejected.
- Live/reconnecting Talks are giftable; ended Talks only when replay is finalized+published.
- Reuse canonical Credit balance/ledger/idempotency/guard rails.
- Talk gifts are voluntary gifts, not acquisition commission and not a second currency.
- Retried request IDs must not double debit or duplicate Activity.
- Completed ledger movement remains success even if rebuildable Activity projection fails.
- Mobile shows explicit amount selection + final Send gift action and friendly failures.
- Wallet projection refreshes after success.

Status: active.
