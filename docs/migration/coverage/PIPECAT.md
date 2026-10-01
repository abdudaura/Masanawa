# Phase 0B Forensic Coverage — Pipecat

Pinned revision: pipecat-ai/pipecat@6396f9771e4d7870b3d538fda38a4241caf6c642

Status: COVERED AT PINNED REVISION

Pipecat is a secondary frame/pipeline processor donor. It strengthens Masanawa's framework-neutral presence processor seam; it does not replace LiveKit Server transport or LiveKit Agents TypeScript session ownership.

## Descendant capability matrix

| Family | Evidence | State treatment | A/B/C | Canonical destination | Acceptance/parity gate |
|---|---|---|---|---|---|
| Frame envelope/model | src/pipecat/frames/frames.py + frame tests | PresenceFrameEnvelope | A/B | services/presence | explicit direction/priority/interruptibility/correlation without donor class hierarchy |
| Frame processor | processors/frame_processor.py + processor tests | processor-local runtime | A/B | presence processor contracts | ordering preserved; system/start priority explicit; interruption applies only to interruptible frames |
| Pipeline/task/worker | pipeline/**/* + worker tests | runtime task/process state | B | presence runtime | pipeline machinery remains replaceable and cannot own workflow/domain truth |
| Speculation gate | turns/speculation_gate.py + tests | SpeculativeTurn | A | presence | speculative turn explicitly confirm/cancel before context/history commit |
| User-turn start policies | turns/user_start/**/* | TurnBoundaryEvidence | B | presence | VAD/transcription/wake/external policies pluggable under one turn controller |
| User-turn stop policies | turns/user_stop/**/* + tests | TurnBoundaryEvidence | A/B | presence | transcription may arrive after VAD stop; bounded aggregation timeout; state resets between turns |
| Context aggregation | processors/aggregators/llm_context.py, llm_response.py + tests | derived runtime context | A/B | agents/context + presence | assistant context reflects actual output; interrupted/unplayed content not falsely committed |
| Protected frames | function/tool/control frame definitions | frame metadata | A | presence/tools | consequential function-result/end/control frames can survive ordinary barge-in |
| Pause/resume liveness | frame processor pause APIs + TTS interruption tests | ProcessorPauseLease | A | presence | interruption/zero-audio completion cannot leave pipeline permanently paused |
| TTS ordering | service base/TTS tests incl ordering and interruptible service | provider output runtime | A/B | providers/presence | synthesis-start, generated audio, actual bot speaking and completion are separate lifecycle facts |
| Service/provider abstractions | src/pipecat/services/**/* | provider-local state | C/B | packages/providers | optional adapters under ADR-0010 |
| Transport abstractions | src/pipecat/transports/**/* | transport-local state | C/B | presence adapters | LiveKit remains selected transport; Pipecat transports are optional/reference |
| Observers | observers/**/* | telemetry only | B | telemetry | turn/function/startup/latency observers cannot mutate canonical state |
| Eval/release suites | evals/**/* | evaluation evidence | B/C | telemetry/evaluation | parity/evaluation evidence only |
| Examples | examples/**/* | fixtures/reference | C | reference | examples cannot define architecture |

## File accounting

pipecat-file-family-manifest.json accounts for all 1,820 pinned files with zero unresolved paths.

## Integration disposition

pipecat-integration-disposition-manifest.json explicitly dispositions all 275 service/transport files. Structural abstractions are retained; concrete provider and transport implementations remain optional adapters.

## Merge decision

Adopt:
- framework-neutral frame envelope and processor seam;
- explicit frame interruptibility;
- speculation confirm/cancel;
- pluggable turn-start/stop policies;
- output-aware context aggregation;
- pause/resume liveness;
- protected tool/control frames;
- TTS/playout lifecycle distinctions;
- processor observers.

Do not adopt as canonical:
- Pipecat transport ownership;
- Pipecat service/provider registry;
- Pipecat PipelineTask as durable workflow truth;
- Pipecat memory/context state as canonical memory;
- Pipecat worker process as Character/session identity.

## Closure

No unresolved Pipecat source family remains at this pinned revision.
