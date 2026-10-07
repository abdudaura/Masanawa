# Talk Host gifts — 2026-10-07

Owner/window: current ChatGPT implementation window
Branch: `work/talks-host-gifts-20261007`
Base: `db68cdc450de891bfa5db7ce9217584870a04190`

## Scope

Make the ordinary listener **Gift** control on a Talk real by routing voluntary Credit
gifts to the Talk's real human Host through the existing canonical Credit ledger.

Owned:
- new `services/gateway/src/talk_gifts/**`
- new `services/gateway/src/talk_gift_routes.ts`
- minimal direct-user gift adapter in `twin_production_runtime.ts` reusing the existing
  canonical Credit move/idempotency/abuse guard
- minimal fresh-read Gateway composition
- Talk money Activity append for successful non-replayed gifts
- new mobile Talk gift model/transport/provider
- Talk-screen Gift sheet wiring
- focused Gateway/mobile tests
- this handoff

Not owned:
- AI Seat charging/revenue split
- Twin-specific gifts
- wallet ledger schema/migrations
- Billing/Crypto
- replay/live audio/moderation
- production deployment

## Rules

- recipient is resolved server-side from `talkId -> host_user_id`;
- client cannot nominate a recipient;
- Host cannot gift their own Talk;
- exact integer Credits only;
- existing Credit balance, rate-limit, circular-value and idempotency protections apply;
- Talk gift records use the existing `gift` Credit-operation kind with
  `characterId = null`;
- no acquisition commission is minted;
- retry with the same requestId+fingerprint is replay-safe;
- only a new completed gift appends recipient Talk Activity;
- Gift is available for live/reconnecting Talks and published replays, not hidden ended recordings.

Status: active.


## Implementation checkpoint

Implemented end to end:
- server resolves `talkId -> host_user_id`; clients never submit a recipient;
- giftable Talk visibility is live/reconnecting or a finalized + published replay;
- `POST /talks/:talkId/gifts` accepts only `requestId` and integer
  `amountCredits`;
- Host self-gifts are rejected;
- canonical direct Credit gift adapter reuses the existing:
  - customer-credit ledger transfer;
  - stable ledger plan;
  - credit-operation idempotency fingerprint;
  - balance authority;
  - rate/amount guard;
  - circular-value detection;
- Talk gifts persist through the existing Gift wallet-history operation with
  `characterId = null`; no parallel wallet/currency was created;
- a newly completed gift appends a recipient Money Activity receipt; replayed retries do
  not duplicate Activity;
- Activity is explicitly non-authoritative: failure to append a feed item cannot turn a
  completed ledger transfer into an API failure;
- mobile Talk gift transport keeps the same request id across ambiguous network retry and
  creates a fresh request id only after success;
- compact **Gift <Host>** bottom sheet offers 50 / 100 / 500 / 1000 Credit amounts;
- successful Gift refreshes Wallet state and confirms the recipient in a snackbar;
- failure remains in the sheet with a friendly balance/retry message and never exposes raw
  transport exceptions;
- focused Gateway route, PostgreSQL visibility/recipient, mobile transport-idempotency and
  Talk widget tests were added.

## Authority boundaries

- financial truth remains the canonical Commerce/Credit ledger and durable credit-operation
  receipt;
- Talk Activity is a derived/rebuildable projection only;
- Talk identity is the only gift-recipient resolver;
- AI Seat revenue and Twin-specific gifting remain separate existing authorities;
- no acquisition commission is created by a voluntary Talk Host gift.

Status: implementation complete; ready for integration qualification/merge.


## Qualification evidence

GitHub Actions on the completed Gift branch:
- Mobile Build run `37609809954`: failed before any job step (`steps = null`);
- Foundation CI run `37609809966`: failed before any job step (`steps = null`).

This matches the repository-wide runner/service-startup failure pattern. No Flutter,
TypeScript, test, or build step ran, so the result is not evidence of an application
failure and no successful CI execution is claimed.

Current main advanced with Talk safety, discovery/notification policy and real replay
Egress/private playback. Conflict review found:
- replay Egress touched `services/gateway/src/main.ts` but not Talk Gift/mobile/Twin
  runtime files;
- GitHub reports the Gift branch mergeable against current main;
- Gift composition is additive and preserves current replay/Egress authorities.

Status: implementation complete; merge-ready with CI infrastructure limitation recorded.
