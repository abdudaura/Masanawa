# Talk participation + Host moderation backend — 2026-10-07

Owner/window: current ChatGPT implementation window
Branch: `work/talks-participation-host-backend-20261007`
Base: `8a4b4a472f64a5ffbd6e4b03854f3e4f12d21144`

## Scope

Implement the durable authenticated backend required by the already-merged mobile
**React / Raise Hand / Host Requests / Manage / End Talk** surfaces.

Owned paths:
- `packages/talks/migrations/0005_talk_participation_moderation.sql`
- new `services/gateway/src/talk_participation/**`
- new `services/gateway/src/talk_participation_routes.ts`
- focused participation/moderation tests
- minimal fresh-read composition edits in `services/gateway/src/app.ts` and
  `services/gateway/src/main.ts`
- this handoff

Not owned:
- replay recording/runtime PR #349
- LiveKit presence/media implementation already merged
- AI Seat Commerce charging/settlement
- search/library backend
- mobile files
- production deployment

## Mobile contracts to satisfy

Viewer:
- GET `/talks/:talkId/participation`
- POST `/talks/:talkId/reactions` with `{reaction}`
- POST `/talks/:talkId/raise-hand` with `{raised:boolean}`

Host:
- GET `/talks/:talkId/host-controls`
- POST `/talks/:talkId/host-requests/:requestId` with
  `{action:"accept"|"decline"}`
- POST `/talks/:talkId/host-participants/:participantId` with
  `{action:"mute"|"unmute"|"remove"}`
- POST `/talks/:talkId/end`

## Invariants

- authenticated + tenant-scoped throughout;
- only the real Talk Host can use Host routes;
- human Raise Hand is free and never self-admits;
- Host accepts/declines human Speaker requests;
- sponsored AI requests may be represented but this lane must not bypass canonical
  Commerce authorization or invent payment state;
- Host cannot remove themselves;
- max 6 active Seats / max 3 AI Seats enforced server-side on admissions;
- reactions are allowlisted and rate-bounded by durable viewer state;
- all mutations are retry/idempotency safe;
- ending a Talk updates the canonical Talk lifecycle and invalidates live participation;
- no participation or reaction state is injected into AI prompts by this service.

Status: active.
