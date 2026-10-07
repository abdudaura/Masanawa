# Global Talk search mobile implementation — 2026-10-07

Owner/window: current ChatGPT implementation window
Branch: `work/talks-global-search-mobile-20261007`
Base: `55373e6298a9b8ba605619da30e403644c93b07a`

## Scope

Implement S12 global search across the new Talk network without touching PR #337's
Talk persistence/runtime ownership.

Owned paths:
- new mobile search models/transport/provider/screen;
- `/search` router entry;
- Home search-button wiring;
- focused mobile tests;
- this handoff.

Not owned:
- Gateway/search persistence;
- ranking indexes;
- Talk persistence/migrations;
- Commerce;
- production deployment.

## Product rules

One search surface only, with compact filters:
- All
- Talks
- People
- Experts
- Twins

Results open the canonical Talk / human profile / persona profile routes.
Talk results remain vertical; do not add horizontal result rails or grids.
No model/provider/Skill internals may appear.

Status: active.
