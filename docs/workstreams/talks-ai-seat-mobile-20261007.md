# Talk AI Seat mobile implementation — 2026-10-07

Owner/window: current ChatGPT implementation window
Branch: `work/talks-ai-seat-mobile-20261007`
Base: `71a1eb92ffd0bc909dfaf46edbe27e191bfbb442`

## Scope

Implement the mobile **Add AI / Sponsor Seat** interaction without taking ownership of
shared Gateway persistence, Commerce ledgers, migrations, or production deployment.

Owned paths:
- `apps/mobile/lib/src/talks/*` additions needed for AI Seat presentation/transport;
- `apps/mobile/lib/src/screens/talks/*` Add AI / Sponsor Seat sheets and Talk wiring;
- `apps/mobile/lib/src/state/*` providers specific to AI Seat catalog/quotes;
- focused mobile widget/model/transport tests;
- this workstream handoff only.

## Locked product rules

- Human speaker Seats remain free.
- AI Experts/Twins use paid AI Seats.
- Audience users **Sponsor Seat**; payment never forces admission.
- Host users may **Add AI** directly, subject to capacity/policy.
- Maximum 6 active Seats / maximum 3 AI Seats at launch policy.
- Financial confirmation must use a fresh server-derived quote; catalog price text is not transaction authority.
- Audience sponsorship requires Host acceptance after payment authorization/hold.
- Declined/expired sponsorship must be safely released/refunded by backend Commerce policy.
- Keep the flow sheet-based and compact; do not create a new root screen.

## Backend boundary

This lane may define the mobile-facing request/response contract but does not implement
server money movement or persistence. Another active window may implement those endpoints
as long as it does not edit the mobile files owned here.

Status: active.


## Implementation checkpoint

Implemented:
- AI Seat catalog model with explicit Expert/Twin identity;
- audience vs Host mode (`sponsor` vs `host_add`);
- fail-soft candidate catalog loading while backend rolls out;
- fresh server quote model with total + expiry + Host-approval flag;
- explicit confirmation before consequential Seat action;
- Add AI / Sponsor Seat bottom sheet with **Experts** and **Twins** tabs;
- search by name/topic;
- one-column persona list with seat fee labels;
- audience copy makes Host acceptance explicit;
- created Talks enter the Talk route as Host;
- Talk projections preserve `viewerIsHost` when the server knows the viewer owns the Talk;
- Talk screen now opens the correct Add/Sponsor flow;
- focused model, sheet and Talk integration tests.

## Mobile-facing backend contract

A backend/Commerce lane can implement the following without touching this lane's mobile files:

- `GET /talks/:talkId/ai-seats`
  - returns an array of candidates:
    `personaId, displayName, kind(expert|twin), seatFeeLabel, subtitle?, avatarUrl?, topics[], isAvailable`
  - catalog price text is discovery only, never payment authority.

- `POST /talks/:talkId/ai-seat-quotes`
  - request: `{ personaId, mode: "host_add" | "sponsor" }`
  - response:
    `quoteId, personaId, displayName, kind, mode, totalLabel, expiresAt, requiresHostApproval`
  - quote must be server-derived, bounded and tied to authenticated viewer/Talk/persona.

- `POST /talks/:talkId/ai-seat-quotes/:quoteId/confirm`
  - response: `requestId, status, message`
  - supported status projection:
    `pending_host | admitted | declined | expired`
  - confirmation must be idempotent and use canonical Commerce authority.
  - sponsor confirmation must not bypass Host acceptance.
  - decline/expiry must release/refund authorization safely.

The backend remains authoritative for:
- capacity (6 total / max 3 AI policy);
- exact fee/currency/tax;
- wallet sufficiency;
- creator/Twin-owner/platform split;
- hold/refund/release;
- Host acceptance;
- idempotency and reconciliation.

Status: mobile implementation complete for this slice; awaiting independent backend lane.
