# Talk AI Seat / sponsored Seat commerce core — 2026-10-07

- **Owner/window:** current ChatGPT AI Seat commerce window
- **Branch:** `work/talks-ai-seat-commerce-20261007`
- **Base SHA:** `8a4b4a472f64a5ffbd6e4b03854f3e4f12d21144`
- **Claim published:** 2026-10-07 09:55 UTC
- **Lane:** quote / authorization-hold / Host decision / capture-or-release lifecycle for paid AI Seats
- **Lease:** 5 minutes from latest repository-visible work

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
- active participation/Host moderation backend
- replay runtime/storage
- wallet/ledger repository adapters and production settlement
- Billing/Crypto/channel/Twin identity foundations
- shared lockfile/config/deployment

## Locked rules

- Human Seats are never represented by this paid AI Seat commerce runtime.
- AI Seat catalog price is display-only; consequential confirmation requires a fresh bounded server quote.
- `host_add` payer must be the Talk Host and does not require a second Host-approval step.
- `sponsor` payer is an audience user and must never force admission.
- Confirming a quote authorizes/holds funds; it does not create earnings or capture revenue.
- Sponsored Seat remains `pending_host` until the real Talk Host accepts or declines it.
- Capture/revenue allocation occurs only when the AI Seat is actually admitted.
- Decline/expiry releases the held authorization in full.
- Twin Seat capture can split Host / Twin owner / Masanawa; Expert Seat capture can split Host / Masanawa.
- All splits and prices are server-supplied quote facts and must sum exactly.
- State transitions are revision-guarded and produce deterministic settlement instructions for an owning wallet/ledger adapter.
- No route handler may later bypass Host decision by treating payment authorization as admission.

## Status

Claim active. Implementing commerce lifecycle and focused tests.
