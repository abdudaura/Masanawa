# Agent Gateway Contract — Mobile Projection

Status: draft client-facing projection. Canonical domain contracts and production roadmap remain authoritative.

## Purpose

Define the minimal HTTP shapes the thin mobile shell can consume without owning Character, Skill, Workflow, Tool or Operation truth.

## Directory

### GET /agent/directory

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

### POST /agent/sessions/open

```json
{ "characterId": "character_..." }
```

Returns canonical CharacterSession identity and optional current AgentRun reference.

## Turn

### POST /agent/sessions/:characterSessionId/turn

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

### POST /agent/sessions/:characterSessionId/close

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
