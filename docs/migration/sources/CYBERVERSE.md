# Source Map — CyberVerse

Pinned revision: `13a6a95b47e5e6f0809683458767746ad54d7d7f` (`main`)

License: GPLv3. Architecture/behavior reference by default; no direct Masanawa-core copying without explicit review.

Status: Phase 0 Pass 1 source map complete.

## Scale and shape

The pinned tree contains roughly 532 files across 134 directories.

Major areas:
- `server` (~127 files) — Go session/media/API/orchestration server;
- `inference` (~59) — Python inference/plugin services;
- `frontend` (~60) — Vue client;
- `models` (~176) — bundled/referenced model code;
- `proto` — gRPC contracts;
- `infra` — provider/model configuration;
- `tests` — inference tests plus significant Go tests.

## Major architecture observed

### Go realtime/session server
Uses Pion WebRTC, LiveKit-related packages, TURN, gRPC and SQLite.

Observed modules/tests cover:
- direct WebRTC negotiation;
- RTP pacing/gaps;
- audio delay;
- media segmentation;
- session lifecycle;
- WebSocket hub/origin controls;
- avatar orchestration;
- voice synchronization;
- recording;
- visual input;
- startup greeting;
- audio-only and silent-avatar modes.

The realtime transport reliability behavior must be mined from tests before Masanawa presence implementation.

### Python inference plugin registry
Plugin families:
- ASR;
- LLM;
- TTS;
- voice/realtime LLM;
- avatar.

Observed providers:
- Whisper/Qwen ASR;
- OpenAI/Qwen/LiteLLM LLM;
- OpenAI/Qwen/Doubao TTS;
- Gemini Live, Qwen Omni, Doubao realtime, OpenAI-compatible realtime;
- FlashHead and LiveAct avatar renderers.

This strongly supports Masanawa's provider interface separation.

### PersonaAgent
PersonaAgent wraps a realtime/omni provider rather than being the underlying model.

Important pattern:
- realtime conversation remains foreground;
- hidden native tool calls identify long work;
- task accepted quickly;
- background task executes separately;
- result is reinjected into same realtime session;
- character provides natural final response.

### Background task state
Evidence:
- `server/internal/agenttask/types.go`;
- task service/store tests;
- Persona/SubAgent design docs.

Task data includes:
- queued/running/waiting_user/completed/failed/cancelled;
- session ID;
- character ID;
- user request;
- progress;
- result summary;
- per-task ordered events with sequence number;
- artifacts.

Important behaviors documented:
- foreground acknowledgment before async task start;
- task progress pushed to frontend;
- task results/artifacts survive independently;
- reconnect can recover task events;
- terminal tasks reject late state/artifact updates;
- task state is server-side, not just model conversation state.

Masanawa's richer workflow system should absorb these realtime UX/recovery behaviors.

### Avatar/digital human
Plugin/service abstractions support FlashHead and LiveAct plus external avatar integrations.

Important behaviors:
- avatar generation follows voice/audio stream;
- voice-only mode can disable avatar;
- avatar warmup;
- silent/idle video handling;
- real-time synchronization tests.

### RAG/knowledge
Python inference includes RAG services/vector stores with optional LangChain/Chroma/Milvus dependencies.

This is a secondary donor relative to Masanawa's broader knowledge/tool architecture.

## Technology observations

CyberVerse uses:
- Go 1.25 server;
- Python inference;
- Vue frontend;
- gRPC/protobuf boundaries;
- SQLite for local task/character-like state.

Masanawa adopts none of these language/storage choices by default. WebRTC/media behavior is reimplemented behind Masanawa contracts.

## License caution

GPLv3 is materially different from the Apache donors. Default migration method:
behavior/architecture ledger -> independent Masanawa contract -> clean implementation -> parity test.

## Deep-mined behavior added in Pass 2

### Realtime media epochs and synchronization
Verified from direct-media/orchestrator tests:
- media playback is partitioned by playback/turn epoch so feedback from an older turn cannot mutate current-turn sync;
- RTP gap handling derives its threshold from real frame duration and may skip a large idle gap rather than reproducing a long frozen pause;
- AV synchronization can insert bounded silence/shift PCM while preserving output length;
- delayed PCM tail carries correctly into the next chunk;
- changing playback epoch resets delay/gap state;
- media-path reset clears stale tracks, bitrate, codec and AV-sync state while leaving the inbound user-audio channel usable;
- idle/supersedable avatar segments queued before a newer speech epoch become stale once speech advances;
- transport-estimated bitrate is bounded by platform min/max policy rather than copied directly.

Masanawa should model `PlaybackEpoch`/turn identity explicitly inside presence streams and reject stale media/control feedback.

### Audio/avatar synchronization
Verified:
- voice/avatar synchronization computes target audio samples from video frames/FPS;
- short audio is padded to match video duration;
- bounded audio buffers discard oldest overflow rather than growing without limit;
- silent/idle avatar playback may continue before first speech video is ready;
- first actual speech video suppresses idle filler;
- final speech completion permits idle filler again;
- continuous avatar inference streams are not torn down on every spoken utterance;
- maximum avatar lead is derived from actual renderer FPS/chunk duration.

### Audio-only mode
Verified:
- disabling avatar generation still produces a valid voice session;
- audio is published directly;
- avatar generation is not called;
- no synthetic AV segment is required;
- user and assistant history are persisted;
- pipeline returns the session to listening after response completion.

This is a non-negotiable separation: AvatarRenderer is optional to live voice.

### Session/pipeline races
Verified:
- every running conversational pipeline receives a sequence/generation;
- a late completion callback from an older pipeline must not clear or cancel the current pipeline;
- history associates assistant messages with matching turn sequence so delayed responses remain next to the correct user turn;
- provider dialog-context construction keeps recent complete pairs, drops orphan/incomplete pairs, never pairs across session IDs, and rejects messages without session identity;
- repeated user fragments within the same session may be merged before a complete assistant pair;
- provider timestamps are normalized to a strictly increasing sequence without creating future time.

Masanawa should keep canonical conversation ordering independently of provider-specific dialog projections.

### Durable task store
Verified from `server/internal/agenttask/store_test.go`:
- task creation begins queued with zero progress;
- appending a task event atomically advances per-task sequence and updates task status/progress;
- terminal completion records finish time;
- artifacts have explicit type/MIME/content metadata;
- after terminal state, late task events and late artifacts are rejected;
- events can be listed strictly after a sequence number for reconnect/catch-up;
- latest active task can be resolved per session;
- externally supplied task/artifact IDs are accepted only when path-safe; path-segment/traversal IDs are rejected.

Masanawa's richer workflow engine should preserve terminal immutability and ordered event catch-up.

### Foreground persona + background subagent
Verified from PersonaAgent/Supervisor tests:
- long work is accepted as a durable task and returned to the voice layer before background execution begins, allowing an immediate natural acknowledgement;
- background progress/artifact/completion events are projected into the same persona session;
- delayed task completion is still awaited after the original input stream ends;
- the user can ask for progress while background work continues;
- final spoken completion occurs after the terminal task event;
- final persona response is generated from user request + task status + safe summary/artifact hint, and explicitly must not read JSON/internal task/artifact IDs aloud.

Masanawa should preserve the UX pattern while using its canonical Task/Workflow engine rather than a separate Persona task store.

### Role-isolated worker context
Verified from subagent runner/tests:
- background execution requires a character/role identity;
- each role may have separate workspace/session/agent directories;
- allowed tools, skills, packages and extensions are explicit;
- subprocess environment is allowlisted/constructed rather than inheriting arbitrary parent secrets;
- unrelated environment secrets must not leak to the worker;
- cancellation sends an explicit cancel command before teardown;
- timeout terminates the stuck bridge;
- failed child process is reaped and its structured error is preserved;
- artifact payload has a configured maximum size.

Masanawa should generalize this as a sandboxed WorkerExecutionContext.

### Avatar warmup
Verified:
- renderer warmup can be globally disabled;
- single-device warmup follows global enable;
- distributed/multi-GPU warmup requires an explicit distributed-warmup capability;
- warmup has a timeout.

### License boundary
All findings in this section are behavioral requirements derived from the pinned GPLv3 source/tests. They are specifications for independent Masanawa implementation, not copied implementation code.

## Phase 0 follow-up

Deep-mine:
1. WebRTC/direct media tests;
2. orchestrator session/recovery tests;
3. PersonaAgent and SubAgent runner;
4. task store terminal/race behavior;
5. avatar synchronization/warmup;
6. visual input;
7. RAG/knowledge;
8. frontend reconnect/task progress behavior;
9. provider registry/configuration.
