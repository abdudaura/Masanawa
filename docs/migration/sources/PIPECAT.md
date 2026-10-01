# Source Map — Pipecat

Pinned revision: `6396f9771e4d7870b3d538fda38a4241caf6c642`.

Status: Phase 0A presence deep pass complete.

Decision: `docs/adr/0006-realtime-presence-architecture.md`.

## Executive result

Pipecat is selected as a **secondary architectural donor** for realtime media/control pipeline semantics, turn-policy decomposition and multi-worker patterns.

It is not selected as Masanawa's default realtime runtime because doing so alongside LiveKit Agents TypeScript would duplicate agent/session/provider/turn/tool responsibilities and add a Python voice-runtime boundary to the TypeScript core.

## Frame/processor model

Pipecat makes realtime control flow explicit through typed frames and processors.

Useful concepts:
- ordered upstream/downstream frame flow;
- processor queues;
- pause/resume;
- processor usability/readiness;
- pipeline and parallel-pipeline composition;
- control vs data frames;
- explicit interruptibility.

Masanawa should adopt a **small** framework-neutral media/control event vocabulary rather than port the full Pipecat frame hierarchy.

## Interruptibility

Pipecat allows frames to declare whether interruption is valid.

Observed examples:
- text: typically interruptible;
- terminal/end/control/function-result frames: can be uninterruptible;
- interruptibility can be overridden deliberately.

Masanawa should preserve the concept so "barge in" does not imply every control/result side effect can be cancelled.

## TTS ordering/backpressure

Pipecat's regression suite captures important behavior across HTTP and WebSocket TTS:
- text aggregation precedes TTS start;
- audio belongs to the correct TTS context;
- TTS stop precedes subsequent gated control frames;
- downstream processing may pause while audio remains in flight;
- interruption during a pause cannot deadlock the pipeline;
- provider "finished" with zero audio cannot leave downstream permanently paused;
- provider generation completion and actual playout completion are separate events;
- word/text alignment must not contaminate adjacent TTS contexts.

These are acceptance behaviors for Masanawa presence regardless of implementation framework.

## Turn-policy decomposition

Pipecat separates:
- user-turn start strategies;
- user-turn stop strategies;
- inference trigger;
- semantic finalization;
- speculative response;
- speculation confirmation/cancellation;
- proposed stop vs resolver.

Masanawa's TurnPolicy should preserve this conceptual flexibility even though LiveKit Agents executes the initial runtime.

## Multi-worker patterns

Pipecat examples demonstrate:
- one transport worker with separate specialist workers;
- local handoff;
- distributed handoff via a bus;
- optional child-specific TTS/media pipelines.

Masanawa may use these patterns for specialized Python media/GPU workers, but durable user tasks remain in Masanawa Workflows/TaskSupervisor.

## Provider breadth

Pipecat has a broad Python provider ecosystem for:
- STT;
- TTS;
- realtime models;
- avatars;
- transports;
- metrics.

A specialized Pipecat worker may later be justified when a provider/media transform has materially better Python support. That requires a scoped ADR; it does not become a second canonical voice brain.

## Direct reuse

Default:
- concept/source reference only.

Optional later:
- specialized Python media worker;
- provider adapter behind a Masanawa contract.

## Remaining follow-up

No further broad Pipecat mining is required before Phase 0A donor freeze. Revisit only for a concrete provider/media worker decision.
