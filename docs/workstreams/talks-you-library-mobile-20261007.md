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


## Implementation checkpoint

Implemented:
- compact You hub now wires **My Talks** and **Saved Talks**;
- `/my-talks` route;
- `/saved-talks` route;
- My Talks projection with **Live** and **Replays**;
- **Drafts** chip appears only when durable drafts are actually returned;
- owned Talk cards remain single-column vertical and preserve Host projection;
- Saved Talks is a simple vertical listening list;
- raw transport failures remain hidden behind friendly refreshable states;
- Wallet & earnings, Bills, Crypto, My Twin and Settings remain in the compact You hub;
- focused model, screen and You-entry tests.

## Mobile-facing backend contract

`GET /me/talks`

Response:
`{ live: TalkDiscoveryItem[], replays: TalkDiscoveryItem[], drafts?: TalkDraftPreview[] }`

Owned live/replay Talk projections should set `viewerIsHost: true` for the authenticated
Host so entering the Talk restores Host controls.

Optional draft projection:
- `id`
- `topic`
- optional `title`
- `updatedAt`

The mobile app only shows the Drafts filter when drafts are present. Draft editing is not
invented locally; a durable draft-edit contract should be added before making draft rows
actionable.

`GET /me/saved-talks`

Response: `TalkDiscoveryItem[]`.

The server remains authoritative for ownership, replay publication, saved state, visibility
and Tenant/user isolation. A 404 fails soft to an empty library while backend projections
land independently.

Status: You/library mobile slice implemented; backend library projections remain independent work.
