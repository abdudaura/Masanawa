# R02 / R19 — LiveKit AI dispatch identity and uncertainty fence

Owner/window: ChatGPT isolated R02 LiveKit dispatcher lane. Branch: `work/r02-livekit-dispatch-identity-fence-20261008`, PR #449 (draft). Base canonical main: `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`. Latest repository-visible activity: 2026-10-08T06:15:05.299Z.

Owned paths: `services/gateway/src/talk_ai_worker/livekit_dispatch.ts`, `services/gateway/src/talk_ai_worker/livekit_dispatch.test.ts`, this file. No overlapping `worker.ts` edits (PR #448), Gateway composition, migrations, pricing, commerce or mobile changes.

## Implemented

- Validate bounded tenant/Talk/Seat/persona and kind before contacting LiveKit.
- Parse both snake_case and camelCase LiveKit dispatch lists; reject malformed list bodies before creating an AI job.
- Existing dispatch reuse requires **schemaVersion + tenantId + talkId + seatId + personaId + kind + correct agent name and room**, not merely matching Seat ID.
- Same Seat with a different persona, tenant, Talk, kind or multiple active dispatches now fails closed rather than speaking as a wrong Expert/Twin. Explicit deleted remote dispatches do not block legitimate new dispatch.
- Coalesce identical concurrent calls for a Seat within this Gateway instance; competing concurrent reassignment fails closed.
- Validate CreateDispatch response ID and any echoed agent/room/metadata; sanitize fetch/invalid-JSON exceptions to avoid exposing tokens or raw provider payloads.
- If CreateDispatch is ambiguous or returns malformed confirmation, retain a bounded in-memory uncertain-Seat fence. Subsequent retry can **read/list** and resolve an authoritative matching remote dispatch, but cannot blindly issue another CreateDispatch for that Seat while uncertain. An incompatible remote assignment fails closed.
- Existing LiveKit roomAdmin JWT and Twirp Create/List contract preserved. LiveKit supports these metadata/response fields; no fabricated worker identity or room join assumed.

## LiveKit Proto3 compatibility correction

- LiveKit's authoritative `ListAgentDispatchResponse` includes repeated `agent_dispatches`. Proto3 JSON may omit an empty repeated field entirely (`{}`), so an empty Talk should **create** its first qualified AI job, not fail input validation.
- Commit `ee65d6ae6b1c12b7e253f56e0d4dd439506ff7b1` permits only this omitted-empty-list case, still rejects explicit malformed lists.
- Commit `37b92bc095d8059234fb2320ea7361c38fe3e21a` adjusts negative list fixtures and adds the real empty-Talk launch case. **17 focused Vitest cases authored; still not executed.** Verified from LiveKit's published `livekit_agent_dispatch.proto` and AgentDispatchService API; this avoids a blocking error introduced by overly strict earlier validation.

## Commits, evidence and limitations

- Initial implementation: `fb629d5f94111cd59c017c11e19c7621b7efc65b`.
- Metadata/concurrent tests: `7e570f34bbad24926653b62f7bee0a3da68a55ab`.
- Sanitized transport: `bd828dd0e3548b7fa08d13ef2fea03180b2aecc4`; matching regression tests `a6be107c96c1038c2e523303248ba7cf1e7f92cf`.
- Uncertain dispatch reconciliation: `5cf10027b6f5a9acc59b2ecff4a3b288062a1fc0`, tests `198b949bfa03257b11a9a3de7f327fb1dd606074`.
- **17 unit tests authored, not executed**. GitHub Foundation CI #37736534327 completed *failure* with an empty job step list (job #113177230986); it does not establish an application test failure or pass. No repo checkout/Node24 pnpm workspace or LiveKit credentials in execution container. Do not merge as verified.
- No actual LiveKit audio, AI worker deployment, provider handshake, paid Seat lifecycle or handset check performed.
- The uncertain-Seat fence is **process-local**, not persistent across restarts or multiple Gateways. Canonical admission transaction and production integration still require a durable dispatch-attempt journal with per-Seat lock, remote resolution and reconciliation before cross-process exactly-once dispatch can be claimed. The 4096-entry cap fails closed if exhausted; monitor and trigger operator repair.
- External LiveKit provider and Gemini AI worker readiness remain unverified. This is a protective adapter change, not R02 or R19 completion.

## Mandatory follow-up

1. Run `pnpm exec vitest run services/gateway/src/talk_ai_worker/livekit_dispatch.test.ts`, `pnpm --filter @masanawa/gateway-service typecheck`, full gateway and integration suites when a working runner is available; fix findings before merge.
2. Verify agent registration/deployment, CreateDispatch metadata and jobs from **two concurrent Gateway workers**, including reassign, deleted dispatch, multi-tenant, timeout and crashed-process cases against an authorized LiveKit environment.
3. Coordinate a persistent dispatch-attempt/outbox with the AI Seat admission owner (without duplicating commerce or inventing charged Seats), require real human Host presence and an admitted confirmed Seat.
4. Validate audible Gemini output, speaker interruptions, mute/remove, real voice identity and device network reconnection. Keep readiness gates OPEN/PARTIAL until observed.

**State:** CODE COMMITTED, TESTS AUTHORED, CI BLOCKED BEFORE STEPS, LIVE TEST NOT RUN, NOT DEPLOYED, NOT MERGED; claim released for a future verified integration window.
