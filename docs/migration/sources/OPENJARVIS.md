# Source Map — OpenJarvis

Pinned revision: `c4da16e1ca3d21f4cc1905d4200063e564104f0f` (`main`)

Status: Phase 0 Pass 1 source map complete; deeper behavior/data extraction remains active.

## Scale and shape

The pinned tree contains roughly 2,169 files across 257 directories.

Important areas:
- `src/openjarvis` — Python platform implementation;
- `rust/crates` — native/Rust implementations for agents, tools, skills, security and bindings;
- `docs/architecture` — strong architectural documentation;
- `tests` — broad feature and security tests;
- `configs/openjarvis` — system/persona/scheduled-agent configurations;
- `frontend` and `desktop` — user surfaces;
- `deploy` — deployment examples;
- `examples` — end-to-end patterns.

The presence of Rust means OpenJarvis should not be treated as merely a small Python agent framework.

## Primary architecture concepts

### Inference Engine
Evidence: `docs/architecture/engine.md`.

Uniform engine abstraction provides:
- synchronous generation;
- streaming;
- model discovery;
- health;
- optional warmup;
- normalized tool calls across providers.

Backends include cloud and many local/on-device systems (Ollama, vLLM, SGLang, llama.cpp, MLX, LM Studio, Exo, Nexa, Lemonade, Apple Foundation Models, LiteLLM).

Useful Masanawa donor ideas:
- provider-neutral inference interface;
- health/discovery;
- normalization of provider tool-call formats;
- local/cloud compute routing.

### Agents
Evidence: `docs/architecture/agents.md`, Python and Rust agent crates.

Observed strategy family includes:
- simple;
- tool-using orchestrator;
- ReAct;
- code/OpenHands-style execution;
- recursive/long-context strategies;
- sandbox wrapping;
- scheduled/continuous/monitoring patterns.

Masanawa should adopt the strategy abstraction, not OpenJarvis's single-user assistant identity model.

### Skills
Evidence: `docs/architecture/skills.md`, `src/openjarvis/skills`, Rust skills crate.

Strong structural design:
- SkillManifest;
- SkillManager;
- strict+tolerant parser;
- SkillTool adapter;
- SkillExecutor;
- dependency graph;
- source resolvers/importers;
- provenance;
- trust/security;
- optimization overlays.

Source import concepts include agentskills-compatible repositories, Hermes, OpenClaw and generic GitHub sources.

This is the primary structural donor for `packages/skills`.

### Tools
Evidence: tool architecture and Rust/Python implementations.

Atomic tool execution includes:
- calculator;
- file operations;
- shell;
- HTTP;
- git;
- search/browser-related optional capabilities;
- common executor and result metadata.

Masanawa retains the interface/executor idea while adding stronger side-effect governance.

### Memory
OpenJarvis includes persistent memory/search options and optional FAISS/ColBERT/BM25/PDF capabilities. This should be inventoried but is a secondary donor relative to N.E.K.O + CWS scope/privacy requirements.

### Learning/evaluation
Evidence: `docs/architecture/learning.md`, learning modules/crates.

Important concepts:
- traces tagged by agent/skill/tool;
- per-skill optimization;
- few-shot/description overlays;
- evaluation/benchmarking;
- agent advisor/evolver concepts.

Masanawa will gate any learned candidate through rehearsal/certification instead of self-promoting consequential behavior.

### Security
Evidence: `docs/architecture/security.md`, `rust/crates/openjarvis-security`.

Observed security areas:
- capability policies;
- file policy;
- guardrails;
- prompt/injection handling;
- rate limiting;
- SSRF protection;
- taint/data-flow concepts;
- sandboxing;
- audit/security scanner.

This is a substantial secondary donor for Masanawa's extension/tool security.

### Channels
The package manifest exposes many optional channel adapters: Telegram, Discord, Slack, LINE, Viber, Messenger, Reddit, Mastodon, XMPP, Rocket.Chat, Zulip, Twitter/X, Twitch, Nostr, Twilio and Gmail.

Masanawa should record these as ecosystem capability references, not automatically implement all channels.

## Technology observations

Pinned Python package supports Python >=3.10,<3.14. It also contains a local Rust workspace and frontend/desktop code.

Masanawa does not inherit this language split. The architecture concepts are translated to TypeScript core and Python only where ML/media makes it useful.

## Phase 0 follow-up

Deep-mine:
1. agent strategy contracts and loop guards;
2. skill parser/import/trust behaviors;
3. tool executor/security behavior;
4. event/trace schemas;
5. scheduler/continuous-agent semantics;
6. learning overlay promotion and evaluation;
7. memory subsystem;
8. local/cloud engine discovery;
9. channel adapter contracts;
10. sandbox/security tests.
