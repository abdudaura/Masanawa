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
