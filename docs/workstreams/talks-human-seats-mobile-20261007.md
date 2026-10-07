# Human Seats and Host controls mobile — 2026-10-07

Owner/window: current ChatGPT implementation window
Branch: `work/talks-human-seats-mobile-20261007`
Base: `55373e6298a9b8ba605619da30e403644c93b07a`

## Scope

Implement free human Seat request/admission and compact Host participant controls on mobile.

Owned:
- mobile human-Seat models/transport/providers;
- Talk Raise Hand state;
- Host speaker-request queue sheet;
- compact Host participant removal controls;
- focused mobile tests;
- this handoff.

Not owned:
- live audio transport/media server;
- Gateway persistence/routes;
- migrations;
- AI Seat Commerce;
- production deployment.

## Locked rules

- Human participation is free. No price, wallet check or payment appears in this flow.
- Listener raises hand -> Host accepts/declines -> listener becomes Speaker.
- Host retains authority over the table.
- Host can remove a human Speaker.
- Maximum total Seat policy remains server-authoritative.
- No payment can bypass Host admission.
- Keep controls sheet-based; no new root screen.

Status: active.
