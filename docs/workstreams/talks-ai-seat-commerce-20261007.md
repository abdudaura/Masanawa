# Talk AI Seat / sponsored Seat commerce core — 2026-10-07

- **Owner/window:** current ChatGPT AI Seat commerce window
- **Branch:** `work/talks-ai-seat-commerce-20261007`
- **Base SHA:** `8a4b4a472f64a5ffbd6e4b03854f3e4f12d21144`
- **PR:** #352 — Add safe AI Seat and sponsored Seat commerce lifecycle
- **Last repository-visible update:** 2026-10-07 09:57 UTC
- **Lane:** quote / authorization-hold / Host decision / capture-or-release lifecycle for paid AI Seats
- **Lease:** released with implementation handoff

## Owned paths

- `packages/commerce/src/talk-ai-seat.ts`
- `packages/commerce/src/talk-ai-seat.test.ts`
- one export-only addition to `packages/commerce/src/index.ts`
- `docs/workstreams/talks-ai-seat-commerce-20261007.md`

## Explicitly not owned

- `apps/mobile/**`
- `services/gateway/**`
- `packages/talks/**` persistence/migrations
- live audio/media runtime
- participation/Host moderation backend
- replay runtime/storage
- wallet/ledger repository adapters and production settlement
- Billing/Crypto/channel/Twin identity foundations
- shared lockfile/config/deployment

## Implemented rules

- Human Seats are never represented by this paid AI Seat commerce runtime.
- AI Seat catalog price is display-only; consequential confirmation uses a fresh server quote.
- `host_add` payer must be the Talk Host.
- `sponsor` payer must be an audience user and payment never grants admission.
- Confirmation moves money to a hold instruction only; it does not capture revenue or create earnings.
- Sponsored confirmation enters `pending_host`.
- Host-added confirmation enters internal `pending_admission`.
- Only the real Talk Host can admit or decline after funds are held.
- Admission emits capture only while the authorization is still fresh.
- Decline emits full release only while the authorization is still fresh.
- Deadline expiry emits full release for held requests and no money movement for never-confirmed quotes.
- Twin Seat economics may split Host / Twin owner / Masanawa.
- Expert Seat economics may split Host / Masanawa only and cannot allocate a Twin-owner share.
- Every server-supplied split must sum exactly to the quote price.
- All state transitions require expected revision custody.
- Hold/capture/release use deterministic quote-scoped idempotency keys.
- State revision + returned settlement instruction must be committed atomically by the owning wallet/ledger adapter.

## Implementation

`packages/commerce/src/talk-ai-seat.ts` provides:
- normalized server-authoritative quote creation;
- persona/mode/economic invariants;
- `quoted -> pending_host|pending_admission -> admitted|declined` lifecycle;
- independent expiry to `expired`;
- Host/payer authority checks;
- hold/capture/release settlement instructions;
- deterministic economic allocation and idempotency keys;
- terminal-state and stale-revision guards.

`packages/commerce/src/talk-ai-seat.test.ts` covers:
- fresh Expert quote construction;
- invalid role/economic combinations;
- sponsor hold without admission/earnings;
- payment non-bypass of Host authority;
- Expert and Twin capture allocation;
- decline release;
- unheld vs held expiry;
- deadline-forced release instead of late Host decision;
- Host-added direct admission path;
- wrong payer, expired confirmation, stale revision and terminal replay rejection.

## Verification

- PR #352 is reported **mergeable** by GitHub.
- At handoff time no Foundation CI run had yet been attached to head `36aa88b2d68288004fc19967e259f37e12c9f0c5`.
- Before PR creation the branch was **0 behind / 6 ahead** of canonical `main`.
- Diff is isolated to the four claimed paths.
- No production settlement, wallet mutation, migration or deployment was performed.

## Integration handoff

The Gateway/ledger owner should implement the already-merged mobile contract without inventing new economic states:

1. Build candidate catalog from canonical Expert/Twin public projections; catalog price remains display-only.
2. Create `TalkAiSeatQuote` from current server price/split policy and current authenticated payer/Host identities.
3. On mobile quote confirmation, call `transitionTalkAiSeatQuote(... confirm ...)` and atomically execute the returned `hold`.
4. For `sponsor`, expose `pending_host` to Host moderation. Payment alone must never create an AI Seat.
5. On canonical Host acceptance and live-capacity admission, call `admit`; atomically execute `capture`, then pass the admitted commercial authorization evidence to the Talk live runtime.
6. On Host decline call `decline`; atomically execute `release`.
7. On deadline call `expire`; release any held amount.
8. Never persist a commerce transition while dropping its non-null settlement instruction.
9. Ledger persistence must replay by request/idempotency identity instead of double-holding, double-capturing or double-releasing.
10. Activity/creator-earnings producers should be emitted from committed capture/release results, not from UI confirmation.

**Implementation status:** complete for the claimed AI Seat commerce-core slice.
