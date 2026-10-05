# Agent Gateway Contract — mobile production surface

Status: active mobile shell contract.

The app authenticates once through `/auth/**`. The returned bearer session is
attached automatically to Agent and creator requests; users never enter a Gateway
token manually.

## Core endpoints

- `GET /agent/directory`
- `PUT /agent/preferences/default`
- `POST /agent/sessions/open`
- `POST /agent/sessions/{characterSessionId}/turn`
- `POST /agent/sessions/{characterSessionId}/turn-stream`
- `POST /agent/sessions/{characterSessionId}/media-turn`
- `POST /agent/sessions/{characterSessionId}/media-set-turn`
- `POST /agent/sessions/{characterSessionId}/close`
- `GET /agent/shell/config`
- `GET /agent/history`
- `GET /agent/events/stream`
- `POST /agent/live/token`
- `POST /agent/push/register`
- `POST /agent/push/unregister`
- `GET/PUT /creator/skills`
- `GET /creator/economy`
- `POST /creator/float`
- `POST /creator/clone`

## Session opening

`POST /agent/sessions/open`

```json
{ "characterId": "character_…" }
```

The response carries the canonical `characterSessionId`. The server authorizes
the signed-in User, Character visibility/relationship and current tenant scope
before admission.

## Turns

Text and media turns bind the canonical Character, CharacterSession and request
identity. Streaming text/audio is a transport projection only; AgentRun/session
truth remains server-side. A client timeout, retry or reconnect must not invent
success.

## Authorization and isolation

- A bearer session is the normal user session issued by production auth.
- Directory visibility is an authorized projection, not a capability grant.
- Platform support Characters may be admitted for the signed-in user.
- Personal clones are relationship/owner scoped; another user's clone is not
  exposed merely because its presentation is visible.
- Skills, Tools, provider access and financial authority are decided server-side.
- Client display names, role labels and cached session IDs never grant authority.

## Build behavior

Production Gateway origins are compiled as non-secret defaults. A staging build
may override `API_BASE_URL` and `AGENT_BASE_URL`; there is no
`AGENT_RUNTIME_ENABLED` switch and no Alpha/Developer access-token define.
