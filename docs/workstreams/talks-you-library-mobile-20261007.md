# You / Talk library mobile implementation — 2026-10-07

Owner/window: current ChatGPT implementation window
Branch: `work/talks-you-library-mobile-20261007`
Base: `e62033a0b10a40ed256f4a4adbc456251edc727a`

## Scope

Complete the consumer **You** ownership/library slice without overlapping active Talk,
Activity, Search or backend persistence lanes.

Owned paths:
- new mobile My Talks / Saved Talks models, transport and providers;
- My Talks screen;
- Saved Talks screen;
- You hub wiring to those routes;
- focused mobile tests;
- this handoff.

Not owned:
- Talk persistence/migrations;
- replay generation/storage;
- Activity backend;
- Search backend;
- Commerce/Wallet internals;
- production deployment.

## Product rules

- You stays a compact row-based hub, not a dashboard.
- My Talks shows owned live/replay content; Drafts appear only when the backend actually returns drafts.
- Saved Talks is a simple vertical listening list.
- Talk cards remain single-column vertical.
- Wallet/Earnings, Bills and Crypto remain reachable from You.
- No Rooms, Skills, Agent directories or old Twin-first history should return.

Status: active.
