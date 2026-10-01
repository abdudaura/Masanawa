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
