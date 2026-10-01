# Realtime Presence Adoption Boundary — Phase 0A

Pinned sources:
- LiveKit Server `7ef0cd014e950373acd789557099305716eea196`
- LiveKit Agents TypeScript `df97b867b3b16efbd348584c818cefc5536ef21a`
- LiveKit Agents Python `d251b89e61fe5f8ba78e0b39b501d91b0856a2d0`
- Pipecat `6396f9771e4d7870b3d538fda38a4241caf6c642`
- CyberVerse `13a6a95b47e5e6f0809683458767746ad54d7d7f`
- AIRI `85d90ab067ac4625875d5808364bd03bf324645e`

Decision: see `docs/adr/0006-realtime-presence-adoption-boundary.md`.

## Executive finding

Masanawa should not select one framework to own transport, live agent execution, avatar rendering and character state.

The strongest composition is:

```
LiveKit Server
    ↓
Masanawa PresenceSession
    ↓
LiveKit Agents TS
    ↓
Masanawa provider/processor adapters
    ↙                   ↘
Pipecat-derived        realtime/STT/LLM/TTS
pipeline patterns
    ↓
AIRI-derived Stage / AvatarRenderer

CyberVerse = clean-room reliability/UX behavior reference
```

## Comparative result

| Concern | Primary | Secondary/reference | Masanawa rule |
|---|---|---|---|
| WebRTC rooms/media | LiveKit Server | CyberVerse | transport only |
| realtime agent session | LiveKit Agents TS | Agents Python, Pipecat | CharacterSession remains Masanawa-owned |
| turn detection/barge-in | LiveKit Agents | Pipecat, CyberVerse | epoch/generation-safe cancellation |
| media/control pipeline | LiveKit Agents | Pipecat | expose Masanawa processor seam |
| client embodiment | AIRI | CyberVerse | renderer-neutral Stage |
| avatar A/V sync | CyberVerse behavior + AIRI renderer model | LiveKit avatar ecosystem | clean implementation |
| audio-only degradation | CyberVerse behavior | LiveKit | must always remain valid |
| long-task foreground UX | CyberVerse behavior | LiveKit job concepts | canonical workflow engine owns task |
| telephony/data RPC | LiveKit | OpenClaw channel layer | transport adapter only |

## LiveKit findings

The pinned server exposes production WebRTC/RTC room infrastructure and is already the strongest transport candidate in `SOURCE-OWNERSHIP.md`.

The pinned Agents implementations show a dedicated `AgentSession` responsible for live-session lifecycle, turn handling and interruption. The TypeScript implementation's `AgentActivity` explicitly coordinates the per-turn voice state machine.

This is materially closer to Masanawa's desired `services/presence` boundary than building a fresh WebRTC/session stack.

### Adoption

Use LiveKit as:
- room/media substrate;
- client connectivity;
- telephony bridge;
- realtime worker/session infrastructure;
- data/RPC transport.

Do not use it as:
- Character identity;
- durable Conversation;
- Memory;
- World;
- Workflow;
- permission source of truth.

## Pipecat findings

Pipecat's architectural advantage is composable realtime processing rather than transport ownership.

The pinned tree documents:
- `FrameProcessor` as a processing unit;
- worker/pipeline composition;
- interruption-aware tool execution;
- paired context aggregation;
- a rule that assistant aggregation belongs after actual transport output so history reflects produced output.

Masanawa should preserve these ideas in a framework-neutral processor seam.

Pipecat remains secondary unless implementation benchmarks show that a specific media pipeline should run as an isolated Pipecat service.

## AIRI findings

AIRI remains the selected embodiment client donor.

Its strongest presence-adjacent rules are:
- shared Stage across surfaces;
- renderer-neutral model-driver lifecycle;
- lip-sync separated from identity;
- serialized microphone/voice-input start-stop-replace;
- stale callbacks from old input bindings rejected.

LiveKit replaces AIRI's local transport experiments as the production media path; AIRI continues to shape the client side.

## CyberVerse findings

CyberVerse already contributed deeply tested presence behaviors:
- playback epochs;
- RTP gap/delay handling;
- bounded AV sync;
- avatar idle/speech synchronization;
- valid audio-only mode;
- pipeline-generation race protection;
- turn-order protection;
- task acceptance before background execution;
- progress/reconnect/final-response semantics.

Because it is GPLv3, those behaviors become acceptance tests/specifications for an independent Masanawa implementation.

## Presence failure hierarchy

A live Character must degrade by capability, not collapse as one monolith:

1. avatar renderer fails → continue audio;
2. video fails → continue audio/data;
3. realtime-model provider fails → switch/fallback through provider policy where possible;
4. TTS fails in cascade mode → text can still complete if product surface permits;
5. transport reconnects → preserve Masanawa runtime/conversation identity;
6. background work outlives live media → workflow/task continues durably and result can be delivered later through the character/channel.

## Ownership freeze

After ADR-0006:

- `services/presence` owns live media/session orchestration.
- `packages/perception` owns normalized inbound perception contracts.
- `packages/identity`, `packages/memory`, `packages/world`, `packages/workflows` remain authoritative for durable domain truth.
- LiveKit is replaceable infrastructure.
- LiveKit Agents is replaceable realtime execution machinery.
- Pipecat processors are optional implementation components.
- AIRI-inspired renderer/client state is replaceable presentation machinery.
- CyberVerse supplies acceptance behavior, not executable production dependency.

## Next Phase 0A comparison

Proceed to the memory architecture decision:

```
Letta + Mem0 + N.E.K.O + OpenClaw
```

The comparison must freeze:
- canonical memory record/scope model;
- write lifecycle;
- retrieval/indexing;
- reflection/compaction;
- shared vs relationship/private memory;
- working-context blocks;
- deletion/retention;
- evaluation and rebuildability;
- what may be reused directly versus adapted behind `packages/memory`.


## Additional verified implementation invariants

The comparative deep pass also verified the following implementation-level behaviors:

### LiveKit Agents
- Detector-aware endpointing defaults differ between streaming semantic detection and legacy/non-streaming modes.
- Explicit runtime endpointing overrides survive activity handoff.
- A speech interruption before the first playout frame has a watchdog path so the current speech handle cannot wedge all future replies.
- Reusable resources such as an STT pipeline transfer ownership during activity handoff; a failed destination start cleans resources only when ownership was not transferred.
- Remote AvatarSession startup can be rolled back locally without blindly deleting a possibly valid remote participant after ambiguous provisioning.
- Avatar cleanup treats an already-absent participant as a normal idempotent condition.
- AgentSession recording supports independent audio/traces/logs/transcript/redaction flags; Masanawa policy, not LiveKit defaults, decides which are enabled.

### Pipecat
- Frames can explicitly be interruptible or uninterruptible.
- Function-call results/end/control frames can remain protected from ordinary barge-in.
- TTS ordering is regression-tested across synchronous and WebSocket providers.
- Provider generation completion, actual audio generation and actual playout completion are separate lifecycle facts.
- Interruption while downstream processing is paused must not deadlock the pipeline.
- User-turn inference trigger and semantic turn finalization can be separate; speculative responses require explicit confirm/cancel semantics.

These invariants are now represented in the Behaviour Ledger and must become acceptance tests for Masanawa's framework-neutral Presence contracts.
