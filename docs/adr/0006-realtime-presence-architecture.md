# ADR-0006: Realtime Presence Architecture

Status: accepted for Phase 0A architecture selection
Date: 2026-10-01

## Decision

Masanawa adopts a layered realtime-presence architecture:

1. **LiveKit Server** is the primary transport/media-room infrastructure.
2. **LiveKit Agents TypeScript** is the primary server-side realtime session/worker substrate inside `services/presence`.
3. **Pipecat** is a secondary architectural donor for frame/pipeline composition, turn-policy decomposition and specialist worker/bus patterns; it is not the default Masanawa voice runtime.
4. **CyberVerse** remains a GPL-clean behavior donor for strict A/V epoch synchronization, renderer race handling, avatar warmup and foreground-persona/background-worker UX.
5. **AIRI** owns the client-side digital-life/embodiment pattern and local renderer lifecycle.

Masanawa itself owns:
- Character identity;
- relationship/memory context;
- durable conversation/task/workflow truth;
- authorization;
- tools/skills;
- world state;
- provider policy;
- recording/privacy policy.

## Why LiveKit Server

The pinned LiveKit server is a production-grade distributed WebRTC SFU rather than an application-level demo transport.

Relevant capabilities:
- scalable distributed WebRTC rooms;
- audio/video/data participants;
- UDP/TCP/TURN connectivity;
- JWT room authorization;
- selective subscription;
- simulcast/SVC;
- E2EE support;
- SIP/telephony ecosystem;
- webhooks;
- SDKs for web, React Native, Android, iOS, Flutter, desktop and embedded clients;
- self-hosted deployment.

Masanawa should not implement its own SFU or TURN/media routing stack.

## Why LiveKit Agents TypeScript

`@livekit/agents` is a public Apache-2.0 package aligned with Masanawa's TypeScript core.

Its `AgentSession` already coordinates:
- Room input/output;
- VAD;
- STT;
- LLM or realtime/duplex model;
- TTS;
- semantic/streaming endpoint detection;
- adaptive interruption;
- overlapping speech;
- preemptive generation;
- AEC warmup;
- transcription timeout;
- tool execution;
- usage and OpenTelemetry;
- agent/activity handoff;
- avatar sessions;
- worker/job execution.

Masanawa should wrap, not fork, this machinery where possible.

## Canonical boundary

```
Masanawa CharacterSession
        |
        | compiled, bounded PresenceContext
        v
Masanawa PresenceSession
        |
        +-- LiveKit AgentSession
        |     +-- VAD / EOT
        |     +-- STT
        |     +-- realtime model OR LLM
        |     +-- TTS
        |     +-- media I/O
        |
        +-- AvatarAdapter
        |
        +-- PresenceEventAdapter
              |
              v
       canonical events/tasks/memory
```

LiveKit session state is transport/realtime execution state. It is not durable Masanawa business truth.

## PresenceSession contract

Masanawa should expose a framework-neutral contract such as:

```ts
interface PresenceSession {
  id: PresenceSessionId;
  characterId: CharacterId;
  userId: PlatformUserId;

  start(input: PresenceStart): Promise<void>;
  updateContext(context: PresenceContextRevision): Promise<void>;
  interrupt(reason: PresenceInterruptReason): Promise<void>;
  setAvatar(avatar: AvatarBinding | null): Promise<void>;
  setTurnPolicy(policy: TurnPolicy): Promise<void>;
  close(reason: PresenceCloseReason): Promise<void>;
}
```

The implementation may wrap LiveKit Agents. Domain packages never import LiveKit types.

## Turn handling

### Primary execution

Use LiveKit Agents turn machinery initially because it already supports:
- streaming EOT;
- VAD;
- STT-driven;
- realtime-model-driven;
- manual turn modes;
- min/max endpointing delays;
- activity/agent overrides;
- interruption duration/word thresholds;
- adaptive overlapping-speech handling.

Important behavior:
runtime turn-policy overrides must survive activity/agent handoff.

### Pipecat contribution

Pipecat demonstrates a valuable policy decomposition:
- independent user-turn start strategies;
- independent user-turn stop strategies;
- proposed vs finalized turn state;
- speculative inference that can be confirmed/cancelled;
- explicit interruptible/uninterruptible frames.

Masanawa should preserve these concepts in its own `TurnPolicy` contract even if LiveKit Agents is the first implementation.

This prevents the domain contract from depending on today's LiveKit-specific endpointing API.

## Interruption and cancellation

Masanawa distinguishes:

- **media interruption** — stop/clear current speech playback;
- **generation interruption** — cancel a reply generation;
- **turn correction** — false interruption/backchannel handling;
- **runtime steering** — OpenClaw-style new guidance;
- **workflow cancellation** — durable task cancellation.

These are not interchangeable.

Adopt LiveKit regression behavior:
- interruption before first audio frame must not wedge all later replies;
- interruption thresholds are consistent;
- overlapping speech can be classified without automatically treating every utterance as a hard interruption;
- AEC warmup can suppress false interruption;
- TTS/forwarding stalls are bounded.

Adopt Pipecat behavior:
- frames may declare whether they are interruptible;
- control/result frames can remain uninterruptible;
- interruption must not deadlock a paused downstream TTS pipeline;
- TTS frame ordering must remain deterministic around start/audio/stop/control frames.

Adopt CyberVerse behavior:
- stale media/feedback from a prior playback epoch must not mutate the current turn;
- A/V sync correction is bounded;
- pipeline-generation cleanup cannot close a newer session.

## Handoff semantics

LiveKit AgentSession supports runtime agent/activity handoff and reusable STT/resource transfer.

This is **not** Masanawa's CharacterHandoff.

Define separately:

### PresenceActivityHandoff
Realtime execution optimization inside one canonical Character/presence session.

May reuse:
- STT pipeline;
- audio input;
- realtime session resources;
- turn options.

Failure to start the next activity must clean up resources that were not successfully transferred.

### CharacterHandoff
Canonical domain workflow from CWS:
- source Character;
- destination Character;
- bounded safe context;
- task continuity;
- privacy rules;
- durable evidence.

A LiveKit handoff may implement the media continuity of a CharacterHandoff, but cannot define its authorization/privacy semantics.

## Worker/job boundary

LiveKit worker jobs are realtime infrastructure lifecycle objects.

They must not become Masanawa durable tasks.

```
LiveKit Job
   = "run this presence worker/session"

Masanawa Task
   = "perform user's durable work"
```

A Masanawa Task may outlive many presence jobs.

## Pipecat boundary

Pipecat is not selected as the default Masanawa realtime runtime because:
- it would create a second Python agent/media orchestration layer beside the TypeScript core;
- LiveKit Agents already provides a public TypeScript session framework tightly integrated with LiveKit transport;
- running both end-to-end would duplicate VAD/STT/turn/tool/session responsibilities.

Use Pipecat as:
- a design donor for Frame/Processor concepts;
- a Python media/GPU worker option where its ecosystem gives material value;
- a possible specialized adapter for providers not well supported elsewhere;
- a source for multi-worker bus and turn-speculation patterns.

Do not run Pipecat and LiveKit Agents as competing canonical voice brains for the same session.

## Frame/event abstraction

Masanawa should not copy Pipecat's complete Python frame hierarchy.

Define a small typed media/control event vocabulary:
- AudioChunk;
- VideoFrameRef;
- UserSpeechStarted;
- UserSpeechStopped;
- TranscriptPartial;
- TranscriptFinal;
- ReplyGenerationStarted;
- ReplyGenerationStopped;
- SpeechPlaybackStarted;
- SpeechPlaybackStopped;
- InterruptionRequested;
- InterruptionConfirmed;
- AvatarState;
- MediaError;
- PresenceClosed.

Transport-specific frames/events map into these contracts.

## Avatar architecture

Two avatar modes must coexist.

### Client-rendered avatar

AIRI-style:
- Live2D;
- VRM;
- MMD;
- Spine/static;
- local lipsync/expression/motion.

Audio and expression/motion metadata flow to the client.

### Remote/generated avatar

LiveKit-style AvatarSession/provider participant:
- provider creates/publishes video/audio participant;
- session waits for avatar participant/video track;
- lifecycle tied to presence job;
- avatar metrics reported separately.

CyberVerse's generated-human synchronization behavior remains a clean-room reference.

The same Character Appearance/Voice identity selects either renderer mode.

## Avatar lifecycle rules

Adopt from LiveKit:
- start avatar before AgentSession where it replaces audio output;
- job shutdown closes avatar resources;
- avatar participant cleanup is idempotent/fail-soft if already gone;
- a failed/ambiguous start can roll back local lifecycle without blindly deleting a possibly valid remote participant;
- wait-for-avatar join/video publication has bounded timeout and metrics.

Adopt from AIRI:
- renderer target ownership/release;
- model-driver replace/start/stop/dispose;
- local renderer state never becomes server Character truth.

Adopt from CyberVerse:
- warmup policy;
- idle/speech renderer continuity;
- stale playback epoch rejection.

## Voice-input client lifecycle

AIRI's serialized MediaStream binding rules apply before audio reaches LiveKit:
- enabled preference != acquired stream;
- start/stop/replace serialized;
- failed start cleans partial resources;
- stale transcript callbacks do not cross binding generations.

LiveKit handles transport/turn execution after client input is bound.

## Recording/privacy

LiveKit AgentSession exposes granular recording for:
- audio;
- traces;
- logs;
- transcript;
- redaction.

Masanawa owns the policy.

Default recording options must derive from:
- tenant policy;
- user consent;
- channel;
- sensitivity;
- jurisdiction/product configuration.

The presence layer may not independently turn recording on because the framework supports it.

## Provider architecture

LiveKit Agents provider plugins can be used inside presence, but Masanawa's ProviderRegistry remains canonical.

Provider choice should compile into presence configuration.

Support both:
- cascaded STT -> LLM -> TTS;
- native realtime/duplex models.

The Character identity is independent of the selected provider.

## Observability

Adopt:
- OpenTelemetry spans;
- model usage;
- latency;
- end-of-turn/endpointing metrics;
- transcription timeout;
- avatar join/playback latency;
- worker health/job count;
- close reason.

Apply Masanawa privacy filtering/redaction before exporting sensitive attributes.

## Direct reuse

### Selected direct dependencies/services
- LiveKit Server (self-hosted or compatible managed deployment);
- `@livekit/agents` inside `services/presence`;
- appropriate official LiveKit client SDKs.

### Architectural/source donors only by default
- Pipecat;
- CyberVerse;
- AIRI renderer/client implementation.

Pipecat may become a specialized Python worker dependency by a later scoped ADR.

## Failure/degradation model

Presence must degrade by capability rather than fail the Character globally.

Examples:
- avatar provider unavailable -> voice-only session;
- semantic EOT unavailable -> VAD/STT/manual fallback according to policy;
- TTS provider fails -> alternative provider if explicitly configured/healthy;
- realtime model unavailable -> cascaded mode if policy allows;
- local AIRI-style renderer fails -> conversation can continue without visual embodiment.

Provider fallback never changes canonical Character identity or bypasses consent.

## Consequences

This decision avoids building our own realtime networking stack while retaining Masanawa's architectural independence.

LiveKit can be replaced later because all domain code sees Masanawa Presence contracts rather than LiveKit objects.
