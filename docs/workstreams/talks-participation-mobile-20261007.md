# Talk participation mobile implementation — 2026-10-07

Owner/window: current ChatGPT implementation window
Branch: `work/talks-participation-mobile-20261007`
Base: `f9e1e493a9d31205c04ab7287d180f5cd54be574`

## Scope

Make current non-financial Talk participation controls functional without taking
Commerce, Talk persistence, live-audio or Host moderation ownership.

Owned:
- mobile Talk participation models/transport/provider;
- reaction picker and Raise Hand interaction;
- Talk screen wiring for those controls;
- focused mobile tests;
- this handoff.

Not owned:
- gifts/payment;
- AI Seat Commerce;
- Host moderation queue;
- live audio/WebRTC/Gemini turn runtime;
- shared Gateway persistence/migrations;
- production deployment.

## Rules

- Reactions are lightweight public engagement, not AI context.
- Raise Hand is free human participation.
- Raising a hand never auto-admits the listener.
- Host remains authoritative for accepting/declining human Speaker Seats.
- Repeated requests must be idempotent server-side.
- Raw network/provider failures must never appear to the user.

Status: active.
