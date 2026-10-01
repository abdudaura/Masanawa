# Masanawa Vision

## Product definition

Masanawa is an AI character operating platform.

It supports persistent AI beings that can maintain identity and relationships, perceive and communicate through multiple modalities, act through skills and tools, perform useful work, participate in a shared world, maintain social identities, conduct approved commerce and appear in both realtime and produced media.

ChatWithStars is one product/world that can run on Masanawa; it is not the platform boundary.

## Complete target capability

The target is defined by capabilities, not by donor repositories.

Masanawa must provide:

### Persistent character and world
- versioned fictional identity, appearance and voice;
- private user-character relationships;
- shared character/world state;
- character-to-character relationships;
- routines, locations, goals, story arcs and commitments;
- governed autonomous life/proactivity;
- consistent cross-channel/cross-device continuity.

### Professional agent and capability runtime
- pluggable agent strategies;
- provider-neutral inference;
- reusable skills and atomic tools;
- dependency/capability graphs;
- background/scheduled/continuous work;
- durable workflows and human approvals;
- safe browser/computer/device actions;
- trace/evaluation/learning with promotion gates.

### Memory and cognition
- bounded working/recent context;
- episodic/semantic/factual memory;
- evidence/reflections and corrections;
- relationship/persona/world/task memory scopes;
- temporal/entity/hybrid retrieval;
- memory compaction/consolidation/dreaming;
- liveness/dead-letter handling;
- explicit privacy and authority boundaries.

### Gateway, channels and devices
- one control plane for web, messaging, voice and future channels;
- account/channel routing to the correct character;
- device nodes for microphone/camera/screen/local actions;
- local-first or cloud-connected operation;
- cross-channel task/session continuity;
- strong permission/sandbox boundaries.

### Realtime digital-human presence
- production WebRTC;
- full-duplex audio/video;
- semantic turn detection and barge-in;
- realtime model or STT/LLM/TTS pipelines;
- foreground character with background specialist work;
- static/Live2D/VRM/MMD/generated-human/avatar providers;
- same identity across live and non-live surfaces.

### World, social, commerce and studio
- scalable world simulation;
- social identity/publishing;
- deterministic quote/payment/ledger/reconciliation;
- operator approvals and audits;
- script/storyboard/render/voice/lipsync/media production;
- identity/provenance consistency across generated media.

### Extensible platform
- plugins that register canonical skills/tools/providers/events/UI;
- skill/plugin provenance and trust;
- MCP/A2A/external protocol bridges where useful;
- observability, recovery and Ops;
- provider/compute portability.

## Reference landscape

Phase 0 studies multiple mature donors rather than treating any framework as the platform:
ChatWithStars, OpenJarvis, N.E.K.O, CyberVerse, AIRI, LiveKit, Pipecat, Letta, Mem0, AI Town, elizaOS, Microsoft Agent Framework and OpenClaw.

Their roles are frozen at the pinned Phase 0 baseline; later changes require evidence-backed ADR/ownership updates. See `SOURCE-OWNERSHIP.md`, `migration/PHASE-0A-CLOSURE-AUDIT.md`, and `migration/PHASE-0B-CLOSURE-AUDIT.md`.

## Experience goal

A person can meet a character on the web, continue on WhatsApp, call the same character later, interact through an avatar/device, ask it to perform useful work, receive results and return days later without losing identity, relationship, commitments or relevant world context.

While the person is offline, the character may continue its permitted fictional life, tasks, social schedule and media career. This persistence is governed and auditable rather than independently improvised by each conversation.

## Platform principles

- Identity is durable and versioned.
- Character != prompt != agent strategy.
- Relationships are private by default.
- World truth is separate from relationship truth.
- Skills are reusable capabilities, not persona prompt duplication.
- Tools are provider-independent side-effect contracts.
- Workflows own durable business state.
- Models reason; deterministic systems own permissions, money and execution truth.
- Channels/device nodes are adapters, not alternate brains.
- Realtime presence and produced media share identity but remain separate execution paths.
- Learning creates candidates and never silently mutates production.
- Every consequential side effect is traceable, idempotent/reconcilable and operable.
