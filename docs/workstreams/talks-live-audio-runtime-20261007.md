# Talk live-audio runtime — 2026-10-07

- **Owner/window:** current ChatGPT live Talk runtime window
- **Branch:** `work/talks-live-audio-runtime-20261007`
- **Base SHA:** `55373e6298a9b8ba605619da30e403644c93b07a`
- **Lane:** canonical live Talk audio/session state machine and host-presence enforcement
- **Claim refreshed:** 2026-10-07 09:29 UTC
- **Lease:** 5 minutes from latest repository-visible work

## Owned paths

- `packages/agents/src/talk-live.ts`
- `packages/agents/src/talk-live.test.ts`
- one export-only addition to `packages/agents/src/index.ts`
- this workstream file: `docs/workstreams/talks-live-audio-runtime-20261007.md`
- cleanup of the branch-only abandoned `packages/talk-live/**` prototype created by this same window

## Explicitly not owned

- `apps/mobile/**`
- `services/gateway/**`
- `pnpm-lock.yaml` or root/workspace configuration
- `packages/talks/**` and Talk persistence migrations owned by PR #337 / its stacked backend lanes
- Commerce, Billing, Crypto, Twin storage/runtime, channels, production deployment, shared migrations/readiness

## Product invariants

- A public live Talk cannot remain live without a real human Host.
- Host disconnect starts a bounded reconnecting/grace state and immediately pauses AI turn generation and public audio broadcast.
- Host reconnect resumes live state only if the grace deadline has not expired.
- Grace expiry ends the live session rather than allowing AI-only continuation.
- Human/AI Seat limits are policy inputs, not hard-coded architecture; launch defaults are 6 total active Seats and 3 AI Seats.
- Human Seats never require payment in this runtime.
- AI Seat commercial authorization is consumed as an opaque admission fact only; this lane does not own charging/refunds.
- Runtime transitions are deterministic and revision-guarded for durable adapter CAS/replay.

## Dependencies

Reuses the existing `@masanawa/agents` workspace package and `@masanawa/contracts` dependency. No lockfile, Gateway, persistence or production integration changes are required.

## Status

Claim active. Initial isolated-package prototype is being folded into the existing agents package specifically to avoid a shared lockfile edit.
