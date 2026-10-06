# Realtime turn detection, interruption and playback generations — Task 122

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/realtime-turn-control-20261006`
Base SHA: `aae05c99ce009f6c22a9126fb6552971886b4402` (Task 121 exact head / PR #251)
Implementation head: `462f37a32b826cbc1f511b66767eeea8761e1de8`
PR: #252

## Completed implementation
- Added deterministic realtime turn lifecycle with listening, semantic finalization, generation, playback and terminal phases.
- Model/output phases cannot begin before the user turn is finalized.
- Playback carries a monotonically advanced playback epoch.
- Barge-in is accepted only against interruptible generation/playback state and rolls to a fresh generation.
- Protected control/result output rejects ordinary barge-in.
- Stale provider-generation and playback-epoch callbacks fail closed after replacement/interruption.
- Interrupted prior-generation callbacks cannot enter the new turn.
- Completed/cancelled/failed turns are terminal.
- Added root contract tests covering semantic finalization, barge-in, protected output, epoch/generation races and terminal behavior.

## Changed-file audit
Exactly three files:
1. `docs/workstreams/realtime-turn-control-20261006.md`
2. `services/presence/src/turn-control.ts`
3. `tests/contracts/realtime-turn-control.test.ts`

No LiveKit/Gemini SDKs, audio-device/mobile code, Gateway, provider inference implementation, package manifests/lockfile, production config or PR #136-owned paths changed.

## Verification
Foundation CI run `37456325867`, job `112244724403` ended `failure` with `steps = null`; checkout/install/typecheck/tests never executed. This is not recorded as a pass and is not application-failure evidence.

## Remaining dependencies
- PR #251 / Task 121 and PR #248 / Task 119 integrate first.
- LiveKit/Gemini/audio adapters must apply generation cancellation and playback-epoch checks to actual provider/media callbacks.
- Physical realtime acceptance must prove barge-in before first playout, stale callback suppression and protected control/result output.

## Current state
**ISOLATED COMPLETE / INTEGRATION READY.**

No further isolated implementation remains in this lane.
