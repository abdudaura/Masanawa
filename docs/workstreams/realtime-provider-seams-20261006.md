# Realtime STT/LLM/TTS and direct-live seams — Task 121

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/realtime-provider-seams-20261006`
Base SHA: `23980903fe528292d25398bd091ec23734c7e355` (Task 119 exact head / PR #248)

## Task references
- `docs/PRODUCTION-MASTER-TASKS.md` — **121** Implement realtime STT/LLM/TTS and direct-live provider seams.
- `docs/migration/PRESENCE-ADOPTION-BOUNDARY.md` — LiveKit Agents/Pipecat behavior behind Masanawa-owned Presence contracts.

## Owned paths
- `services/presence/src/realtime-provider.ts` (new)
- `tests/contracts/realtime-provider-seams.test.ts` (new)
- `docs/workstreams/realtime-provider-seams-20261006.md`

## Excluded/shared paths
- No Gemini/LiveKit/provider SDK dependency, package manifest/lockfile, Gateway, inference package, credentials, production config or PR #136-owned paths.
- No duplicate canonical Agent inference strategy or durable transcript state.

## Dependencies
- Task 119 PresenceSession bridge.
- Provider/inference owners later implement these ports using admitted LiveKit/Gemini/STT/TTS infrastructure.
- Task 120 transport remains blocked on shared dependency/deployment ownership.

## Current state
CLAIMED. Implement provider-neutral realtime input/output contracts for STT, text/model streaming, TTS, and direct-live duplex sessions, with bounded media metadata, explicit lifecycle/cancellation and no provider-specific business truth.