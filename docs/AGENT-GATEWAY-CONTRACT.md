# Agent Gateway Contract — Mobile Projection

Status: draft client-facing projection. Canonical domain contracts and production roadmap remain authoritative.

## Purpose

Define the minimal HTTP shapes the thin mobile shell can consume without owning Character, Skill, Workflow, Tool or Operation truth.

## Directory

### GET /v1/agent/directory

Returns the authorized Characters configured to appear in the current user's app.

Example response:

```json
{
  "agents": [
    {
      "characterId": "character_...",
      "characterVersionId": "character-version_...",
      "displayName": "Amina",
      "roleLabel": "Sales & Outreach",
      "about": "Prospecting and customer follow-up",
      "avatarUrl": "https://...",
      "greeting": "What should we work on?",
      "presence": "working",
      "activeWorkCount": 2
    }
  ]
}
```

The response MUST NOT expose or infer authorization from display names or role labels and MUST NOT require the client to know Skill assignments. The current Gateway projection is backed by visible AgentPresentation records; Skill assignments are deliberately omitted.

## Open/resume session

### POST /v1/agent/sessions/open

```json
{ "characterId": "character_..." }
```

Returns canonical CharacterSession identity and optional current AgentRun reference.

## Turn

### POST /v1/agent/sessions/:characterSessionId/turn

```json
{ "text": "Research 50 companies and make a spreadsheet." }
```

Example response:

```json
{
  "reply": "I started the research.",
  "agentRunId": "agent-run_...",
  "parts": [
    {
      "kind": "work",
      "title": "Research prospects",
      "status": "working",
      "progressCurrent": 0,
      "progressTotal": 50,
      "referenceId": "workflow-run_..."
    }
  ]
}
```

Supported part kinds are `audio`, `image`, `file`, `artifact`, `work`, `approval`, `operation`, `call_result` and `status`.

A file/artifact part carries a durable server reference rather than a device path.

## Close local handle

### POST /v1/agent/sessions/:characterSessionId/close

Closing the client handle is advisory. Character identity and durable server work survive disconnects.

## Future realtime stream

The production Presence/Gateway path should deliver ordered typed runtime events for voice/audio deltas, progress, artifacts, approvals, calls and Operation receipts. This document deliberately does not declare a transport protocol until the canonical Presence/runtime tasks choose it.

## Authority

Every route is an authorized projection over canonical domains. No field in these payloads is itself authority. Current Security policy and resource scope must be revalidated by the server before consequential work.


## Ops administration contract

The operator surface uses separate concerns:

- `GET /v1/agents` — list configured AgentPresentation records;
- `PUT /v1/agents/:characterId/presentation` — change app display name, role, about, greeting, visibility/order;
- `GET /v1/skills` — list canonical SkillVersion options and readiness for selectors;
- `GET /v1/agents/:characterId/skills` — read independent Character Skill assignment;
- `PUT /v1/agents/:characterId/skills` — replace the exact selected SkillVersion set.

Presentation and Skill assignment use independent revision compare-and-swap tokens.
Every Ops call requires an injected operator/current-authority authorizer; no route
derives authority from role labels, client input, or mere possession of a CharacterId.


## Alpha 1 development conversation slice

The development Gateway can expose a bounded vertical slice before the later
production Gateway/Presence tasks are complete. It uses the same canonical
CharacterSession and AgentRun stores; only the inference executor and dev
authorization adapter are temporary.

Development routes:

- `POST /v1/agent/sessions/open` with `{ "characterId": "character_..." }`;
- `POST /v1/agent/sessions/:characterSessionId/turn` with explicit
  `characterId` plus text;
- `POST /v1/agent/sessions/:characterSessionId/media-turn` with explicit
  `characterId`, caption, MIME type and bounded base64 bytes;
- `POST /v1/agent/sessions/:characterSessionId/close` with explicit
  `characterId`.

Each text/media turn creates one canonical AgentRun and returns its
`agentRunId`. Request/correlation IDs come from Gateway correlation admission,
not caller-provided IDs.

Alpha media input is a development convenience, not the durable file/artifact
architecture. The future file store will replace inline payload transport while
keeping the chat/file reference model.

Alpha inference is intentionally turn-local. It does not claim production
Memory/context compilation, Skill execution, Workflows, live browsing, phone
operations or realtime Presence. Those remain their numbered production tasks.

The debug Scenario Lab is UI-only. Its Work/File/Approval/Call cards never
represent executed backend work and must never be enabled as a production
source of truth.
