# Talk live-audio runtime — 2026-10-07

- **Owner/window:** current ChatGPT live Talk runtime window
- **Branch:** `work/talks-live-audio-runtime-20261007`
- **Base SHA:** `55373e6298a9b8ba605619da30e403644c93b07a`
- **Lane:** canonical live Talk audio/session state machine and host-presence enforcement
- **Last repository-visible update:** 2026-10-07 09:33 UTC
- **Lease:** released with complete handoff

## Owned paths

- `packages/agents/src/talk-live.ts`
- `packages/agents/src/talk-live.test.ts`
- one export-only addition to `packages/agents/src/index.ts`
- this workstream file: `docs/workstreams/talks-live-audio-runtime-20261007.md`

## Explicitly not owned

- `apps/mobile/**`
- `services/gateway/**`
- `pnpm-lock.yaml` or root/workspace configuration
- `packages/talks/**` and Talk persistence migrations owned by PR #337 / its stacked backend lanes
- Commerce, Billing, Crypto, Twin storage/runtime, channels, production deployment, shared migrations/readiness

## Product invariants implemented

- A public live Talk cannot remain live without a real human Host.
- Host disconnect enters bounded `host_reconnecting` state and immediately pauses public audio and AI turns.
- Host reconnect resumes only before the grace deadline.
- Grace expiry ends the Talk instead of allowing AI-only continuation.
- Human/AI Seat limits are policy inputs; launch defaults are 6 total active Seats and 3 AI Seats.
- Human Seats require no commercial authorization in this runtime.
- AI Seats require opaque higher-layer commercial authorization evidence; this lane does not charge/refund/settle.
- Host Seat cannot be removed or occupied by AI.
- Seat admissions stop while Host is absent.
- All state transitions use expected revision custody and reject stale mutation.
- Audio guards reject public frames and AI turns whenever the Host is absent.

## Implementation

- `packages/agents/src/talk-live.ts`
  - canonical session/Seat/policy/event contracts;
  - deterministic transition function;
  - Host reconnect deadline handling;
  - total/AI capacity enforcement;
  - human vs AI Seat admission boundaries;
  - public-audio and AI-turn admission guards.
- `packages/agents/src/talk-live.test.ts`
  - Host presence/startup;
  - immediate disconnect pause;
  - successful bounded reconnect;
  - terminal grace expiry;
  - human-vs-AI commercial boundary;
  - capacity/revision/Host immovability;
  - malformed AI Host rejection;
  - no Seat admission during Host absence.
- `packages/agents/src/index.ts`
  - exports the Talk live runtime.

## Verification

- PR: #344 — **Enforce human Host presence in Talk live-audio runtime**
- GitHub reports PR mergeable against current `main`.
- Foundation CI run `37601231133` failed before producing any workflow steps; the job step list is empty and logs are unavailable. This matches the repository-wide zero-step CI failure already recorded by the current Talk backend lane, so no branch-specific test failure was surfaced.
- Source/test changes remain isolated to the four claimed diff paths when compared with current `main`.
- No production deployment, Gateway composition or persistence migration was performed.

## Handoff

This lane is implementation-complete. The next integration owner can wire these guards into the live media transport/session adapter once that Gateway/media ownership is free. That integration must treat `assertAiAudioTurnAllowed` and `assertSeatAudioFrameAllowed` as admission checks, persist/replay revisions atomically, and schedule `host_grace_expired` from the durable host-presence deadline without inventing a second Talk state machine.
