# Realtime Presence Donor Comparison

Date: 2026-10-01

Sources:
- LiveKit Server `7ef0cd014e950373acd789557099305716eea196`
- LiveKit Agents TS `df97b867b3b16efbd348584c818cefc5536ef21a`
- LiveKit Agents Python `d251b89e61fe5f8ba78e0b39b501d91b0856a2d0`
- Pipecat `6396f9771e4d7870b3d538fda38a4241caf6c642`
- CyberVerse `13a6a95b47e5e6f0809683458767746ad54d7d7f`
- AIRI `85d90ab067ac4625875d5808364bd03bf324645e`

Decision: `docs/adr/0006-realtime-presence-architecture.md`.

## Result

| Concern | Selected donor | Secondary behavior |
|---|---|---|
| WebRTC/SFU transport | LiveKit Server | CyberVerse Pion tests |
| TypeScript realtime session | LiveKit Agents TS | Agents Python parity reference |
| Turn detection/interruption execution | LiveKit Agents TS | Pipecat turn-policy concepts |
| Frame/pipeline semantics | Masanawa small contract inspired by Pipecat | LiveKit events |
| Client embodiment | AIRI | N.E.K.O |
| Generated remote avatars | LiveKit AvatarSession/ecosystem | CyberVerse |
| A/V stale-epoch/race rules | CyberVerse behavior | LiveKit regression tests |
| Foreground/background specialist UX | CyberVerse + Masanawa task system | Pipecat multi-worker |
| Durable task/workflow | Masanawa/CWS | never LiveKit/Pipecat session state |

## LiveKit Server assessment

LiveKit is not merely a framework abstraction. It supplies the transport infrastructure that our earlier designs were otherwise going to rebuild:
- distributed SFU;
- TURN/UDP/TCP;
- rooms/participants/tracks;
- data channels;
- token permissions;
- E2EE;
- SIP;
- server/client SDK ecosystem;
- self-hosted deployment.

This makes it the strongest transport donor.

Masanawa should treat a room/participant/track as Presence infrastructure identifiers, not canonical user/Character identifiers.

## LiveKit Agents TypeScript assessment

The current public `@livekit/agents` package is unusually complete.

The `AgentSession` includes:
- VAD;
- STT;
- LLM;
- duplex/realtime model;
- TTS;
- turn detection;
- endpointing;
- adaptive interruption;
- tools;
- usage;
- OpenTelemetry;
- activity/agent handoffs;
- avatar output;
- recording;
- room I/O.

### Turn detection

Observed modes:
- STT;
- VAD;
- realtime model;
- manual;
- streaming semantic detector.

Endpointing defaults vary appropriately by detector and explicit per-session/per-agent overrides survive activity handoffs.

Masanawa should expose a framework-neutral TurnPolicy, compiled to LiveKit options.

### Interruption

LiveKit regression tests cover:
- minimum interruption words;
- overlapping speech;
- adaptive interruption;
- interruption before first audio frame;
- false interruption;
- uninterruptible response behavior;
- AEC warmup;
- transcript timeout.

The "interrupt before playout" regression is particularly valuable: an interrupted speech handle must not leave the session waiting forever and silence all later turns.

### Resource handoff

Agent/activity handoff can drain reusable resources such as STT pipelines into the next activity.

Important ownership behavior:
- untransferred resources are cleaned if the next activity fails before taking them;
- once successfully transferred, the previous owner does not clean them;
- reusing the same activity avoids unnecessary detach/restart.

This is useful for seamless realtime strategy changes inside one Character session.

### Worker/jobs

The Agent server manages worker/job lifecycle, process pools, health checks, load and inference-process sharing.

This is a good presence-worker substrate, but its job lifecycle is not Masanawa's durable Task model.

### Recording/telemetry

AgentSession supports granular audio/traces/logs/transcript recording and redaction plus usage/OTel events.

Masanawa must supply policy/consent.

## LiveKit AvatarSession assessment

AvatarSession models remote/generated avatar providers as participants/tracks.

Useful behaviors:
- avatar lifecycle attaches to job shutdown;
- warns when attached after AgentSession start would replace existing audio;
- waits for avatar participant and published video track;
- bounded join timeout;
- playback latency metrics;
- cleanup removes the provider participant when possible;
- "participant already gone" is a successful cleanup condition;
- other cleanup errors are logged but local lifecycle is still released;
- start can be rolled back locally for ambiguous provisioning/retry without blindly deleting the remote participant.

This complements AIRI local rendering rather than replacing it.

## Pipecat assessment

Pipecat's strongest contribution is **explicit media/control flow**.

### Frame processors

A FrameProcessor:
- has ordered input processing;
- pushes upstream/downstream frames;
- can pause/resume frame processing;
- reports usability;
- can own tasks and queues;
- composes into pipelines/parallel pipelines.

This makes timing/backpressure and control flow visible rather than implicit.

### Interruptibility

Frames explicitly carry whether they are interruptible.

For example:
- text can be interruptible;
- function-call results/end/control frames can be uninterruptible.

This is a good concept for Masanawa's media/control contract.

### TTS ordering

Pipecat has extensive regression coverage for:
- TTS start/audio/stop ordering;
- synchronous vs WebSocket TTS;
- output pause while audio is in flight;
- interruption during paused processing;
- zero-audio provider completion;
- actual playout continuing after provider says generation is complete.

This is useful as a behavior donor even if LiveKit Agents executes our primary voice sessions.

### Turn-policy decomposition

Pipecat separates user-turn start and stop strategies.

A stop strategy can:
- trigger inference;
- finalize a turn;
- generate speculatively before finalization;
- cancel speculation;
- let another resolver finalize the turn.

This is a stronger conceptual model than tying all product semantics directly to one VAD/EOT implementation.

### Multi-worker patterns

Pipecat supports:
- local worker handoff;
- distributed handoff over a bus;
- transport worker separate from LLM workers;
- child worker owning its own TTS if desired.

Masanawa should borrow the separation, but its canonical background Task Supervisor remains outside the media pipeline.

## CyberVerse contribution

CyberVerse remains valuable because its tests emphasize media races and digital-human synchronization:
- playback epochs;
- stale feedback rejection;
- bounded RTP/AV sync;
- pipeline-generation race protection;
- idle vs speaking avatar continuity;
- avatar warmup;
- audio-only degradation;
- foreground acknowledgement before background specialist work.

Because of GPLv3, these behaviors are independently reimplemented/tested.

## AIRI contribution

AIRI owns the client embodiment side:
- local Stage;
- renderer-neutral conceptual split;
- Live2D/VRM/MMD/Spine;
- model-driver lifecycle;
- serialized voice-input binding;
- local client/device UX.

AIRI does not own WebRTC transport.

## Why not Pipecat as the primary runtime

Pipecat is highly capable but Python-first. Selecting it as the canonical presence runtime while also adopting LiveKit Agents TS would duplicate:
- provider pipelines;
- turn detection;
- tools;
- agent/session lifecycle;
- audio processing.

Masanawa's TypeScript core benefits from using the public `@livekit/agents` package directly.

Pipecat remains valuable as a specialist Python media worker option.

## Why not CyberVerse as primary

CyberVerse has excellent targeted behavior but:
- GPLv3 complicates direct incorporation;
- its architecture is narrower and less mature as distributed infrastructure than LiveKit;
- LiveKit/Pipecat provide much larger provider/client ecosystems.

CyberVerse remains a behavior/reference donor.

## Why not AIRI as primary

AIRI is a client/embodiment platform, not the strongest network transport/session infrastructure.

## Canonical layering

```
AIRI-inspired client Stage
    |
LiveKit client SDK
    |
LiveKit Server
    |
Masanawa services/presence
    |
@livekit/agents
    |
Masanawa PresenceContext / TurnPolicy / ProviderPolicy
    |
Masanawa runtime + tools + tasks + memory
```

Optional remote avatar:

```
@livekit/agents AvatarSession
       |
generated-avatar provider participant
```

Optional specialized Python media processing:

```
Masanawa presence adapter
       |
Pipecat worker
```

## Acceptance requirements for later implementation

Before presence is production-ready, tests must cover:
- connect/reconnect;
- user/device authorization;
- room/participant identity mapping;
- semantic/VAD/manual turn modes;
- false interruption/backchannel;
- barge-in before playback starts;
- TTS stall and zero-audio completion;
- stale playback epoch;
- A/V drift/gap;
- avatar startup/warmup/join timeout;
- generated-avatar cleanup;
- voice-only degradation;
- provider fallback policy;
- context update/handoff;
- task continuity across presence reconnect;
- privacy/recording consent;
- worker crash/restart;
- no duplicate external side effects after interruption/reconnect.
