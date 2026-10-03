# Agent Gateway Contract (draft v0 — PLANNED)

Status: draft for Masanawa Task 099 (CharacterSession command/streaming
gateway APIs). The gateway does not expose these endpoints yet. The shell
ships against this draft so it lights up the moment the server lands it —
no app changes required. Until then every turn stays on preview.

## Endpoints

### Open (or resume) a session

`POST /agent/sessions/open`

Request:

```json
{ "masanaId": "labari" }
```

Response:

```json
{ "characterSessionId": "sess_…", "agentRunId": "run_… (optional)" }
```

Rules: idempotent per caller + masana. Returns the existing open session
when one is already active (resume). Auth: shell session bearer token.

### Send one turn

`POST /agent/sessions/{characterSessionId}/turn`

Request:

```json
{ "text": "…" }
```

Response:

```json
{ "reply": "…", "agentRunId": "run_… (optional)" }
```

Rules: `reply` is required and non-empty. `agentRunId` carries the Task 072
run reference when the runtime returns one. Missing/empty `reply` is a
transport failure — the shell falls back honestly, never fakes text.

### Close (advisory)

`POST /agent/sessions/{characterSessionId}/close`

Request: `{}`. Always best-effort. Server sessions are durable; a lost
close never strands the Character.

## Thread bindings

`characterSessionId` / `agentRunId` on a thread are last-known server refs.
They are null on preview-only threads. Older caches without these keys load
normally.

## Cutover checklist (staging)

- [ ] Gateway serves the three endpoints behind auth.
- [ ] Staging build sets `AGENT_RUNTIME_ENABLED=true` + `AGENT_BASE_URL=…`.
- [ ] Session IDs persist across restarts (server resume, not phone storage).
- [ ] Airplane-mode turn shows the honest offline reply, never fake success.
- [ ] Revoked device blocked server-side.
- [ ] Preview fallback removed only after a green staging week.
