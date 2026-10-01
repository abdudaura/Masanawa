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

## Deep-mined behavior added in Pass 2

### Skill parser/import safety
Verified from source/tests:
- required `name` and `description` fail strictly;
- kebab-case/lowercase/length rules fail strictly;
- known vendor fields are mapped through data-driven mappings instead of bespoke parser branches;
- unknown vendor fields are preserved under provenance metadata rather than discarded;
- imported scripts are skipped by default and require explicit opt-in;
- references/assets/templates may import without enabling scripts;
- symlinks inside copied directories are rejected before replacing an existing install;
- external unreviewed skills requesting dangerous capabilities are refused unless explicitly confirmed;
- provenance records source, source commit, translated/missing tools, script-import status, trust tier and dangerous capabilities;
- tool names in external skill instructions can be translated to canonical platform tools.

For Masanawa, confirmation alone is not sufficient for consequential production skills: import may succeed into quarantine, but certification/readiness policy must still gate use.

### Skill graph/manager
Verified:
- explicit dependencies and subskill step references participate in the same graph;
- cycles and dependency-depth excess are rejected;
- transitive capability requirements can be computed;
- one cyclic cluster can be pruned without discarding every healthy discovered skill;
- first discovered skill name wins according to configured source precedence;
- model-hidden skills are excluded from the agent-facing catalog/tools;
- optimization overlays are load-time sidecars; bad overlays do not break base skill discovery;
- a skill is wrapped as a normal Tool and tagged with skill/source/kind/step metadata for traces.

Masanawa should preserve graceful isolation of bad extensions while using a database/versioned registry rather than filesystem precedence as production truth.

### Inference engine discovery
Verified:
- engine health probes run independently/concurrently;
- an explicitly selected engine is authoritative and is never silently substituted;
- default-engine fallback may select another healthy engine, preferring the same local/cloud class;
- model-aware selection verifies the engine can actually serve the requested model;
- failed model-list lookup degrades to empty discovery rather than corrupting engine state;
- tool calls from provider-specific response formats normalize to one representation;
- asynchronous streaming is deliberately non-blocking and bounded by timeout;
- transport errors become typed connection failures.

Masanawa should preserve explicit-vs-default fallback semantics in ProviderRouter.

### Agent execution guards
Verified:
- repeated identical tool calls can be blocked;
- polling/tool-call budgets can stop runaway loops;
- loop-guard triggers emit telemetry/events;
- oversized context can be compressed while retaining bounded state;
- agent cost/token budgets can move an agent execution into a budget-exceeded state;
- potentially dangerous tools that require confirmation fail closed if no interactive confirmation mechanism is available or approval is denied.

Masanawa should implement these as generic execution budgets/policies, with durable workflow rules taking precedence for consequential work.

### Security references
OpenJarvis tests cover SSRF, capability policy, file boundaries, credential/log sanitization, injection scanning, rate limiting, signing, webhook validation, taint propagation and sandboxing.

Verified SSRF requirement: DNS resolution failure defaults to fail-closed, private/loopback/link-local/metadata/multicast and disguised mapped forms are blocked.

### Learning/traces
Verified:
- trace collection captures generation, tool calls, retrieval and response steps;
- collectors unsubscribe after a run so stray later events do not pollute the next trace;
- per-skill optimization buckets only traces carrying explicit skill metadata;
- skills below a minimum evidence count are skipped;
- optimization writes a separate overlay (description/few-shot) rather than mutating the base skill artifact.

Masanawa adds a stronger promotion gate: an optimized overlay is only a candidate until rehearsal/certification approves a new version.

### Scheduler
Verified:
- once, interval and cron scheduling;
- timezone-aware cron;
- pause/resume/cancel lifecycle;
- run result/error logs;
- start/end events;
- one-shot tasks complete and clear next-run after execution.

Masanawa will absorb these concepts into durable workflows/proactivity rather than create a separate assistant scheduler truth.

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
