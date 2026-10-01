# ADR-0006: Realtime Presence and Embodiment Adoption Boundary

Status: accepted for Phase 0A architecture selection  
Date: 2026-10-01

## Decision

Masanawa selects a layered realtime-presence architecture rather than one donor framework owning the whole live-character stack.

Primary ownership is:

- **LiveKit Server** — canonical production WebRTC room/media transport substrate.
- **LiveKit Agents TypeScript** — primary server-side realtime agent-session/runtime donor for `services/presence`.
- **Pipecat** — secondary donor for frame/pipeline composition, interruption propagation, media/control processors and side-pipeline patterns where these are stronger than the selected LiveKit abstraction.
- **AIRI** — primary client/digital-life embodiment donor and renderer lifecycle reference.
- **CyberVerse** — behavior-only reference for playback epochs, A/V synchronization, audio-only operation, session races and foreground/background task UX.

No donor owns Masanawa Character identity, durable conversation truth, memory, world state, workflows, permissions, commerce or provider-of-record state.

## Canonical boundary

```
Masanawa CharacterSession / RuntimeSession
                |
        services/presence
                |
      PresenceSession contract
      /          |          \
 transport   realtime       embodiment bridge
    |         pipeline             |
LiveKit     LiveKit Agents      AIRI-style Stage
 Server      TS primary        + AvatarRenderer
                |
        optional processors
          Pipecat patterns
                |
       provider adapters
 STT / realtime model / LLM / TTS

Cross-cutting clean-room invariants:
CyberVerse playback epochs, AV sync, audio-only,
pipeline generation/race safety and task UX
```

## Why LiveKit Server owns transport

The pinned LiveKit server is the strongest donor in the vault for production WebRTC room/participant/media infrastructure.

Masanawa adopts the architecture of:
- rooms and participants as transport/session topology, not Character truth;
- publish/subscribe media tracks;
- WebRTC reconnect/ICE/TURN handling;
- client data/RPC channels;
- telephony compatibility;
- cross-platform client SDK interoperability;
- horizontally scalable media infrastructure.

Masanawa does not adopt LiveKit rooms as durable business sessions. A LiveKit room is a transport instance linked to a Masanawa `RuntimeSession` / `PresenceSession`.

## Why LiveKit Agents TypeScript is primary

The pinned TypeScript agent framework exposes a mature `AgentSession` lifecycle that coordinates:
- room connection;
- turn detection;
- interruption/barge-in;
- STT/LLM/TTS or realtime-model pipelines;
- playout;
- metrics;
- worker/job execution;
- client data exchange.

Its `AgentActivity` model also demonstrates an explicit turn state machine from VAD/STT through endpointing, inference, TTS and playout.

Masanawa's primary language is TypeScript, so the TypeScript Agents implementation is the preferred starting point for the production realtime-session adapter. The Python Agents repository remains a maturity/reference source for parity and provider behavior, not a second canonical runtime.

## Pipecat adoption boundary

Pipecat is not selected as a second realtime runtime beside LiveKit Agents.

Its strongest concepts should instead shape Masanawa-owned media/control interfaces:
- typed frame flow;
- processor composition;
- transport-independent pipeline stages;
- explicit interruption/cancellation propagation;
- fan-out/sidecar processing;
- context aggregation after actual output;
- structured realtime workflow patterns.

If a concrete Pipecat subsystem is materially better than the corresponding LiveKit implementation, it may be used behind a Masanawa `PresenceProcessor` or provider adapter. It must not create a parallel session, identity, memory or workflow authority.

## AIRI relationship

ADR-0005 remains authoritative for client embodiment.

Presence supplies normalized live state to clients. AIRI-derived client architecture renders it across web/desktop/mobile/avatar surfaces.

The renderer boundary remains approximately:

```
AvatarRenderer
  load(identityPresentation)
  activate()
  setExpression(...)
  setMotion(...)
  setLipSync(...)
  setLookTarget(...)
  setPresenceState(...)
  suspend()
  dispose()
```

Renderer state is presentation state, not canonical Character/world truth.

## CyberVerse behavioral invariants

CyberVerse is GPLv3 and remains reference-only by default.

The following verified behaviors become Masanawa clean-room requirements:

1. **Playback epochs**
   - every spoken/output generation has an epoch/generation;
   - delayed feedback from an old epoch cannot mutate current playback state.

2. **Pipeline generations**
   - late completion from an old conversational pipeline cannot clear/cancel the current one.

3. **A/V synchronization**
   - avatar/video timing derives from actual renderer FPS/chunk timing;
   - audio padding/delay is bounded;
   - overflow is bounded rather than growing without limit;
   - idle avatar content becomes stale when a newer speech epoch advances.

4. **Audio-only validity**
   - avatar generation is optional;
   - disabling avatar must still leave a fully valid live voice session.

5. **Conversation ordering**
   - canonical turn ordering belongs to Masanawa;
   - delayed assistant output remains associated with its originating user turn;
   - provider dialogue projections may not pair turns across session IDs.

6. **Foreground/background UX**
   - long work may detach into the canonical workflow/task engine;
   - the live character acknowledges immediately;
   - progress/completion is reinjected into the same CharacterSession;
   - internal task/artifact IDs are never spoken as the natural final response.

## Masanawa contracts

Phase 1/2 design should expose Masanawa-owned contracts equivalent to:

```ts
interface PresenceTransport {
  connect(session: PresenceSessionSpec): Promise<PresenceTransportHandle>;
  disconnect(reason?: string): Promise<void>;
  publish(media: PresenceMedia): Promise<void>;
  subscribe(handler: PresenceEventHandler): Unsubscribe;
}

interface PresenceSession {
  id: PresenceSessionId;
  runtimeSessionId: RuntimeSessionId;
  characterId: CharacterId;
  userId: UserId;
  transportBinding: TransportBinding;
  modality: PresenceModality;
  playbackEpoch: number;
  pipelineGeneration: number;
}

interface PresenceProcessor<I, O> {
  process(input: I, context: PresenceProcessingContext): AsyncIterable<O>;
}

interface AvatarBridge {
  attach(session: PresenceSession, renderer: AvatarRenderer): Promise<void>;
  detach(reason?: string): Promise<void>;
}
```

Exact interfaces may change during implementation; ownership may not.

## Required lifecycle rules

Presence must preserve:

- transport connection is not proof of authenticated Character/user authority;
- authority is checked before joining/binding and revalidated for consequential operations;
- reconnect may replace transport identity without replacing Masanawa `RuntimeSession`;
- provider/realtime-model failure may fall back without changing Character identity;
- avatar renderer failure may degrade to audio-only;
- STT/TTS are adapters, not required when a realtime model natively handles audio;
- barge-in cancels/suppresses stale playout using the active playback epoch;
- client microphone lifecycle follows ADR-0005 serialized start/stop/replace behavior;
- presence telemetry is ephemeral unless deliberately promoted to canonical events;
- durable memories/workflow transitions are committed through their owning services, never directly by media callbacks.

## Explicitly rejected architectures

Do not:
- make LiveKit `Agent` equal Masanawa `Character`;
- store durable memory/world/task truth in LiveKit room metadata;
- run both LiveKit Agents and Pipecat as independent canonical agent runtimes;
- require avatar generation for voice presence;
- let a renderer/provider decide canonical turn ordering;
- copy CyberVerse GPL implementation code into Masanawa core without a separate license decision;
- introduce Python as the default presence runtime solely because LiveKit/Pipecat Python implementations are mature.

## Direct reuse posture

- LiveKit Server: deploy/use as infrastructure where appropriate; it is intentionally external transport infrastructure, not a donor submodule imported into domain code.
- LiveKit Agents TS: direct dependency is allowed behind Masanawa presence contracts after implementation-time API/license/version verification.
- LiveKit Agents Python: reference and optional Python/GPU adapter only when ecosystem requirements justify it.
- Pipecat: direct use only for isolated processors/services where it materially improves the implementation; no parallel authority.
- AIRI: architectural adaptation per ADR-0005; no mandatory private workspace package dependency.
- CyberVerse: behavior specification only by default.

## Consequence

Masanawa gets a production-grade WebRTC substrate and mature realtime turn/session handling without allowing realtime infrastructure to become the Character model.

The realtime stack can be replaced incrementally because the stable platform boundary is Masanawa's `PresenceSession`, media/control events and CharacterSession bridge—not LiveKit/Pipecat/AIRI object models.
