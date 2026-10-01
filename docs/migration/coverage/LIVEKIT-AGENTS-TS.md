# Phase 0B Forensic Coverage — LiveKit Agents TypeScript

Pinned revision: livekit/agents-js@df97b867b3b16efbd348584c818cefc5536ef21a

Status: COVERED AT PINNED REVISION

LiveKit Agents TypeScript is the primary realtime agent-session donor. It contributes turn-taking, interruption, endpointing, playout, handoff and provider runtime behavior. Masanawa still owns Character identity, durable Conversation, Memory, Workflow, World and authorization.

## Descendant capability matrix

| Family | Evidence | State treatment | A/B/C | Canonical destination | Acceptance/parity gate |
|---|---|---|---|---|---|
| AgentSession lifecycle | agents/src/voice/agent_session.ts + session tests | runtime session projection | A/B | services/presence | session lifecycle cannot redefine CharacterSession identity |
| AgentActivity turn runtime | agent_activity.ts + speech/close/commit/handoff tests | LiveTurnGeneration | A/B | presence + agents | one active turn-generation authority; interruption/commit rules observable |
| Endpointing/turn detection | turn_config + endpointing/audio_recognition tests | turn config/evidence | A/B | presence | detector-aware defaults; explicit runtime overrides survive handoff |
| Interruption handling | interruption tests, generation interrupt-before-first-frame tests | playback/turn state | A | presence | interruption before first playout cannot wedge session or lose resumed valid turn |
| Resource handoff | agent_activity_handoff + ownership/release tests | ReusableMediaResourceLease | A | presence | reuse only on proven compatibility; transfer exactly once; cleanup untransferred resources |
| Speech/playout lifecycle | generation.ts, speech_handle.ts, playout tests | PlaybackCommitEvidence | A | presence | generation, first playout, completion and interruption remain distinct facts |
| Audio recognition | audio_recognition.ts + endpointing/EoU/VAD/STT recovery tests | runtime perception state | A/B | presence/perception | duplicate commits suppressed; stale detector/STT state cannot produce extra turns |
| Transcription synchronization | transcription/synchronizer.ts + tests | derived timed text | A/B | presence/client | transcript release follows actual playout, not generation completion |
| Room/console/recorder I/O | voice room_io, console_io, recorder_io tests | replaceable IO binding | B | presence adapters | I/O replaceable without changing session identity |
| Avatar session | voice/avatar/**/* tests | AvatarOutputSession | B | presence + embodiment | avatar optional; startup/cleanup failure cannot collapse underlying session |
| LLM runtime | agents/src/llm/**/* | provider stream state | B | providers/agents | provider formatting/fallback behind canonical provider contracts |
| STT runtime | agents/src/stt/**/* | provider stream state | B | providers/presence | fallback/recovery explicit; no hidden provider ownership |
| TTS runtime | agents/src/tts/**/* | provider stream state | B | providers/presence | provider output ordering/lifecycle remains playout-aware |
| Provider fallback | LLM/STT/TTS fallback adapter tests | ProviderAvailabilityState | A/B | packages/providers | mid-stream retry policy explicit; no accidental duplicated output |
| Inference services | agents/src/inference/**/* | provider/inference runtime | B | packages/providers | VAD/EOT/interruption inference remain replaceable provider capabilities |
| Tool execution | voice/tool_executor.ts + generation tool tests | per-turn tool state | B | packages/tools/workflows | tool side effects remain governed by canonical tool/workflow policy |
| Warm-transfer/workflow helpers | agents/src/workflows/**/* | call-transfer runtime | B/C | workflows/presence | helper workflow cannot replace durable Masanawa workflow state |
| Telemetry/metrics | agents/src/telemetry, metrics, turn spans | telemetry only | B | telemetry | provider/session measurements are observations only |
| IPC/worker runtime | agents/src/ipc/**/* | worker process state | B/C | presence infrastructure | process placement cannot become session/domain identity |
| Concrete provider/avatar plugins | plugins/**/* | adapter/provider state | C/B | provider/avatar adapters | independently selected and certified; not adopted wholesale |
| Examples/e2e tests | examples/**/*, tests/**/* | fixtures/evidence | evidence | parity/reference | examples never define architecture |

## File accounting

livekit-agents-ts-file-family-manifest.json accounts for all 1,042 pinned files with zero unresolved paths.

## Plugin disposition

livekit-agents-ts-plugin-disposition-manifest.json explicitly dispositions all 522 plugin files. Core live-session behavior is retained; individual providers/avatar vendors remain optional adapters.

## Merge decision

Adopt strongly:
- AgentSession/AgentActivity lifecycle patterns;
- detector-aware endpointing;
- generation/playout/interruption separation;
- false-interruption and first-frame deadlock protection;
- compatible resource handoff;
- actual-playout-based transcript synchronization;
- provider fallback state and explicit mid-stream retry policy;
- optional avatar output semantics.

Redesign:
- AgentSession becomes runtime machinery beneath Masanawa PresenceSession/CharacterSession;
- tool execution routes through packages/tools/workflows;
- provider fallback routes through packages/providers;
- telemetry routes through canonical telemetry.

Do not allow:
- LiveKit agent object = Character identity;
- plugin/provider object = provider registry authority;
- Room participant = canonical user identity;
- worker process/session = durable Conversation or Workflow truth.

## Closure

No unresolved LiveKit Agents TypeScript source family remains at this pinned revision.
