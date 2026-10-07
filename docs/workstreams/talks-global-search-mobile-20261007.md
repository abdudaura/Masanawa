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


## Implementation checkpoint

Implemented:
- one global search route from the Home search action;
- compact **All · Talks · People · Experts · Twins** filters;
- debounced search after two characters;
- mixed vertical results without grids or horizontal result rails;
- Talk result rows with live/replay identity;
- human result rows with handle/live state;
- Expert/Twin result rows with explicit persona kind, availability and Seat fee;
- canonical navigation to Talk, human profile and persona profile routes;
- 404 fail-soft rollout while backend search lands;
- friendly network failure/empty states with no raw transport exceptions;
- focused model, screen and Home-entry tests.

## Mobile-facing backend contract

This lane expects:

`GET /search?q=<query>&type=all|talks|people|experts|twins&limit=30`

Response object:

`{ talks: [], people: [], personas: [] }`

Talk entries reuse the existing Talk discovery projection.

People entries:
- `handle`
- `displayName`
- optional `bio`
- optional `avatarUrl`
- `isLive`
- optional `liveTalkId`

Persona entries:
- `publicId`
- `displayName`
- `kind: expert|twin`
- `seatFeeLabel`
- `isAvailable`
- optional `role`
- optional `avatarUrl`
- optional `isVerified`

The backend remains authoritative for visibility, ranking, safety filtering, profile
availability, persona availability and Seat-price projection. Search results must never
leak private profiles/Twins or internal model/provider/Skill data.

Status: mobile global search slice implemented; backend search projection remains an independent lane.
