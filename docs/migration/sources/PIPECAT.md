# Source Map — Pipecat

Pinned: `6396f9771e4d7870b3d538fda38a4241caf6c642`.

Status: Phase 0A presence adoption pass complete.

Decision: Pipecat is a secondary realtime-pipeline donor, not Masanawa's canonical live-session runtime. See ADR-0006.

## Strongest architectural contributions

The pinned tree demonstrates:
- frame-based audio/video/control processing;
- `FrameProcessor` composition;
- worker/pipeline execution;
- interruption-aware tool execution;
- transport abstraction;
- paired context aggregation;
- side pipelines/fan-out patterns;
- structured realtime flow/state patterns.

One especially important ordering rule is that assistant aggregation belongs after actual transport output so recorded context represents what was truly produced rather than merely what was generated upstream.

## Masanawa adoption

Preserve these concepts through Masanawa-owned interfaces:
- `PresenceProcessor<I,O>`;
- typed media/control frames;
- cancellation/interruption propagation;
- bounded side pipelines;
- output-observed transcript/context events.

Pipecat may be used directly inside an isolated processor/service when benchmarking shows a material advantage.

## Explicit non-ownership

Pipecat must not create a parallel:
- CharacterSession;
- identity store;
- durable conversation store;
- memory system;
- workflow/task engine;
- provider registry.

LiveKit Agents TypeScript remains the selected primary realtime-session framework.

## Relationship to other donors

- LiveKit Server: transport substrate.
- LiveKit Agents TS: primary session/turn runtime.
- AIRI: client Stage/avatar lifecycle.
- CyberVerse: clean-room synchronization/race/audio-only/task-UX behavior.
- Masanawa: owns CharacterSession, PresenceSession and durable truth.

## Remaining Phase 0 work

Further Pipecat mining belongs to Phase 0B exhaustive feature/behavior coverage unless implementation evidence later justifies a focused direct-reuse ADR.
