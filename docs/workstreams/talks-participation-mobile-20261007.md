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


## Implementation checkpoint

Implemented:
- lightweight reaction picker with ❤️ 👏 😂 💯 🤔 🔥;
- reaction mutation wired from the existing Talk **React** control;
- current viewer reaction projected back into the Talk control;
- Raise Hand sheet explaining that human Speaker Seats are free and Host-controlled;
- raise / lower hand mutation wired from the existing control;
- distinct idle / raised / accepted / declined participation states;
- accepted state projects **Speaker** instead of pretending the user is still waiting;
- friendly action failures with no raw transport/provider exception text;
- existing custom callbacks remain supported for compatibility;
- focused interaction and model tests.

## Mobile-facing backend contract

`GET /talks/:talkId/participation`

Response:
- `handStatus: idle|raised|accepted|declined`
- optional `reaction`

`POST /talks/:talkId/reactions`
- request: `{ reaction }`
- response: current viewer participation projection.

`POST /talks/:talkId/raise-hand`
- request: `{ raised: boolean }`
- response: current viewer participation projection.

Backend invariants:
- human Raise Hand is free;
- raising a hand never grants a Speaker Seat by itself;
- Host acceptance remains authoritative;
- requests/mutations are authenticated and idempotent;
- reaction values are allowlisted/rate-limited;
- reactions and Raise Hand state are not silently injected into AI context.

A 404 on participation read fails soft to idle state during rollout; mutations do not
pretend success when the backend route is unavailable.

Status: mobile Talk participation slice implemented; backend participation mutation/projection remains independent work.
