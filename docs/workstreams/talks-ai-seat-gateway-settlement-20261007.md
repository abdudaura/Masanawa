# Talk AI Seat Gateway + settlement integration — 2026-10-07

- **Owner/window:** current ChatGPT transformation window
- **Branch:** `work/talks-ai-seat-gateway-settlement-main-20261007`
- **Canonical base:** `c81a225bcc09e567f35fe1321fc5e3e8d1d3fa44`
- **Original claim branch:** `work/talks-ai-seat-gateway-settlement-20261007`
- **Resynchronized:** after global Talk search backend merged into main
- **Lane:** mobile AI Seat contract → durable Credit hold → Host decision → canonical live AI Seat → capture/release → Activity/earnings
- **Lease:** active through this commit

## Implemented

- Exact mobile endpoints:
  - `GET /talks/:talkId/ai-seats`
  - `POST /talks/:talkId/ai-seat-quotes`
  - `POST /talks/:talkId/ai-seat-quotes/:quoteId/confirm`
- Authenticated tenant/viewer scoping for catalog, quote and confirmation.
- Server-authoritative Expert/Twin pricing and split policy with bounded environment configuration.
- Durable `commerce.talk_ai_seat_quotes` state with canonical quote/request identity.
- Canonical Commerce Credits ledger integration:
  - confirmation hold: customer Credit → platform float;
  - admission capture: platform float → Host pending earnings / Twin-owner pending earnings / platform revenue;
  - decline/expiry: platform float → customer Credit refund.
- Sponsored confirmation creates a Host request only after the hold succeeds.
- Payment never bypasses Host acceptance.
- Host-added AI confirms, admits and captures atomically with live capacity checks.
- Sponsored Host acceptance atomically:
  - validates the commercial authorization;
  - validates the exact human Host;
  - transitions the canonical live Talk via `ai_seat_admitted`;
  - writes the active AI Seat;
  - captures the held Credits;
  - writes Host/Twin-owner earnings;
  - resolves the Host request.
- Sponsored decline/expiry atomically releases the full held amount.
- Expired sponsored holds are swept before Host controls are shown.
- Existing free Human Speaker moderation path is preserved.
- Talk Activity records are emitted from committed sponsorship/capture/release outcomes.
- Commerce PostgreSQL helpers are exposed at the transaction-client level so AI Seat state and money movement share one transaction.
- Production Gateway composition includes pricing policy and the AI Seat moderation bridge.
- Global Talk search changes already on canonical main are preserved.

## Configuration defaults

- Expert AI Seat: 100 Credits
- Twin AI Seat: 120 Credits
- Host share: 20%
- Twin owner share: 50% on Twin Seats
- Remaining amount: Masanawa platform revenue
- Quote lifetime: 120 seconds

Environment overrides:
- `MASANAWA_TALK_EXPERT_SEAT_PRICE_CREDITS`
- `MASANAWA_TALK_TWIN_SEAT_PRICE_CREDITS`
- `MASANAWA_TALK_AI_SEAT_HOST_SHARE_BPS`
- `MASANAWA_TALK_TWIN_OWNER_SHARE_BPS`
- `MASANAWA_TALK_AI_SEAT_QUOTE_TTL_SECONDS`

## Tests

Focused tests cover:
- mobile candidate and quote projections;
- sponsor vs Host-add approval semantics;
- authenticated confirmation response;
- customer-session requirement;
- AI commerce handling of sponsored Host decisions;
- non-bypass of the existing Human Speaker request path;
- expiry sweeping before Host moderation.

The repository layer additionally enforces transaction-level capacity, identity, state-revision and settlement invariants.

## Boundaries

This lane does not implement the AI speech worker itself. An admitted AI Seat is now commercially and canonically present in the Talk; the media/agent worker must consume that admitted Seat and obey the existing Host-presence/AI-turn guards.

No mobile UI, Billing, Crypto or channel behavior was replaced.

## Status

Implementation complete for AI Seat Gateway + settlement integration. Ready for merge verification.
