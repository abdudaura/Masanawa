# Talk live-audio runtime — 2026-10-07

- **Owner/window:** current ChatGPT live Talk runtime window
- **Branch:** `work/talks-live-audio-runtime-20261007`
- **Base SHA:** `55373e6298a9b8ba605619da30e403644c93b07a`
- **Lane:** canonical live Talk audio/session state machine and host-presence enforcement
- **Claim published:** 2026-10-07 09:23 UTC
- **Lease:** 5 minutes from latest repository-visible work

## Owned paths

- `packages/talk-live/**`
- focused package tests under `packages/talk-live/**`
- this workstream file: `docs/workstreams/talks-live-audio-runtime-20261007.md`

## Explicitly not owned

- `apps/mobile/**`
- `services/gateway/src/app.ts`, `services/gateway/src/main.ts`, or existing Talk Gateway route files
- `packages/talks/**` and Talk persistence migrations owned by PR #337 / its stacked backend lanes
- Commerce, Billing, Crypto, Twin storage/runtime, channels, production deployment, shared migrations/readiness

## Product invariants

- A public live Talk cannot remain live without a real human Host.
- Host disconnect starts a bounded reconnecting/grace state and immediately pauses AI turn generation.
- Host reconnect resumes live state if the grace deadline has not expired.
- Grace expiry ends the live session rather than allowing AI-only continuation.
- Human/AI Seat limits are policy inputs, not hard-coded architecture; launch defaults are 6 total active Seats and 3 AI Seats.
- Human Seats never require payment in this runtime.
- AI Seat commercial authorization is consumed as an admission fact only; this package does not own charging/refunds.
- Runtime events are deterministic, revisioned and safe to persist/replay by an owning adapter.

## Dependencies

Consumes identities/seat classifications supplied by higher layers. No shared Gateway or persistence integration is required for this lane.

## Status

Claim active. Implementation starting from current main.
