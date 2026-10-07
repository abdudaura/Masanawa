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
