# Realtime STT/LLM/TTS and direct-live seams — Task 121

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/realtime-provider-seams-20261006`
Base SHA: `23980903fe528292d25398bd091ec23734c7e355` (Task 119 exact head / PR #248)
Implementation head: `dcaf47162394ead0f907f8b6d92707c5f2e2587c`
PR: #251

## Completed implementation
- Added provider-neutral streaming STT, realtime-model, TTS and direct-live duplex ports.
- Added normalized bounded audio-frame, transcript, model-delta and speech-chunk contracts.
- Every realtime input/output carries exact PresenceSession + generation identity.
- Added stale/foreign generation rejection so provider callbacks cannot mutate the current turn after replacement/interruption.
- Audio metadata, chunk size, timestamps, text/language and sequence/generation bounds fail closed.
- Input/output media bytes are copied at the boundary instead of retaining mutable provider buffers.
- All provider ports carry explicit cancellation signals and direct-live sessions expose explicit close disposition.
- No Character/Relationship/Workflow/Memory/Commerce truth is stored in provider sessions.
- Added root contract tests covering normalization, stale generation rejection, bounds and cancellation-aware direct-live lifecycle.

## Changed-file audit
Exactly three files:
1. `docs/workstreams/realtime-provider-seams-20261006.md`
2. `services/presence/src/realtime-provider.ts`
3. `tests/contracts/realtime-provider-seams.test.ts`

No provider SDKs, LiveKit/Gemini dependencies, Gateway, inference package, credentials, package manifests/lockfile, production config or PR #136-owned paths changed.

## Verification
Foundation CI run `37456128443`, job `112244074790` ended `failure` with `steps = null`; checkout/install/typecheck/tests never executed. This is not recorded as a pass and is not application-failure evidence.

## Remaining dependencies
- PR #248 / Task 119 integrates first.
- Task 120 transport owner provides LiveKit/WebRTC connectivity when shared dependency/deployment ownership clears.
- Provider/inference owners implement these ports with admitted STT/LLM/TTS/direct-live providers.
- Task 122 owns turn detection/interruption/playback generation semantics on top of these generation-aware events.
- Production verification requires real Gemini/LiveKit audio and interruption testing.

## Current state
**ISOLATED COMPLETE / INTEGRATION READY.**

No further isolated implementation remains in this lane.
