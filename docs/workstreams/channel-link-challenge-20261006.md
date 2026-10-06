# Channel possession linking challenge — 2026-10-06

Status: active reclaimed Identity/channel slice
Owner/window: ChatGPT continuation window
Branch: `work/channel-link-challenge-20261006`
Base: stale PR #231 head `6acb897b02f4928a5ea67d2053b2368c8d3bc80c`

## Reclaimed context

PR #231 is stale under the repository five-minute lease rule. Its ChannelAccount and
UserChannelBinding lifecycle is preserved unchanged. This slice continues the missing
proof mechanism for the existing `channel-possession-challenge` proof method.

## Exact owned paths

- `packages/identity/src/channel-link-challenge.ts` (new)
- `packages/identity/src/channel-link-challenge.test.ts` (new)
- `packages/identity/src/index.ts` (single export only)
- `docs/CHANNEL-LINK-CHALLENGE.md` (new)
- `docs/workstreams/channel-link-challenge-20261006.md`

## Boundaries

- no Gateway/channel adapter/storage/migration/mobile/Commerce/deployment edits;
- raw challenge secrets are returned only at issuance and never stored in challenge state;
- the challenge is bound to Tenant + ChannelAccount + channel + canonical User;
- incoming transport evidence must still be authenticated by the channel adapter;
- successful proof produces only a canonical `ChannelBindingProof` for the existing
  lifecycle; activation still happens through `activateChannelBinding()`;
- durable compare-and-set and rate limiting remain repository/Gateway responsibilities.

## Goal

Implement a bounded, replay-safe possession challenge with:
- high-entropy opaque secret validation;
- SHA-256 secret custody;
- expiry and maximum-attempt enforcement;
- revisioned immutable state transitions;
- exact channel/account scope checks;
- one-time successful proof;
- redacted failure semantics suitable for WhatsApp/Telegram linking.
