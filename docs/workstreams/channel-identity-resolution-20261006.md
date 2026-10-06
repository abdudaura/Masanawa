# Proof-backed channel identity resolution — 2026-10-06

Status: active reclaimed Identity/channel slice
Owner/window: ChatGPT continuation window
Branch: `work/channel-identity-resolution-20261006`
Base: stale PR #231 head `6acb897b02f4928a5ea67d2053b2368c8d3bc80c`

## Exact owned paths
- `packages/identity/src/channel-identity-resolution.ts` (new)
- `packages/identity/src/channel-identity-resolution.test.ts` (new)
- `packages/identity/src/index.ts` (single export only)
- `docs/CHANNEL-IDENTITY-RESOLUTION.md` (new)
- `docs/workstreams/channel-identity-resolution-20261006.md`

## Goal

Resolve authenticated WhatsApp/Telegram transport subjects to canonical Masanawa Users
only through an active proof-backed `UserChannelBinding` and active matching
`ChannelAccount`. Pending, revoked, cross-tenant, cross-account, cross-channel and
changed-subject states fail closed.

## Boundaries

No Gateway, messaging adapter, persistence implementation, migrations, mobile, Commerce
or deployment changes. This consumes the existing `ChannelBindingRepository` port and
does not create a second identity store.
