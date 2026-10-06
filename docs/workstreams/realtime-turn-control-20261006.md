# Realtime turn detection, interruption and playback generations — Task 122

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/realtime-turn-control-20261006`
Base SHA: `aae05c99ce009f6c22a9126fb6552971886b4402` (Task 121 exact head / PR #251)

## Task references
- `docs/PRODUCTION-MASTER-TASKS.md` — **122** Implement semantic turn detection, interruption/barge-in and playback generations.
- `docs/migration/PRESENCE-ADOPTION-BOUNDARY.md` — epoch/generation-safe cancellation and protected control/result frames.

## Owned paths
- `services/presence/src/turn-control.ts` (new)
- `tests/contracts/realtime-turn-control.test.ts` (new)
- `docs/workstreams/realtime-turn-control-20261006.md`

## Excluded/shared paths
- No LiveKit/Gemini SDKs, audio device code, Gateway, mobile player, provider inference implementation, package manifests/lockfile or production config.
- No durable Conversation/CharacterSession state.

## Dependencies
- Task 121 generation-aware provider events.
- Transport/audio owners apply returned cancellation/playout decisions to actual media.

## Current state
CLAIMED. Implement deterministic turn-generation state, semantic finalization, interruptibility, barge-in generation rollover, protected output handling and stale provider/playout callback rejection.