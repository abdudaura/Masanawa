# Source Map — N.E.K.O

Pinned revision: `48ac9243a9d8e75a37d7598548c29017df1c6d2e` (`main`)

Status: Phase 0 Pass 1 source map complete; this is the largest donor and requires extensive deeper mining.

## Scale and shape

The pinned tree contains roughly 4,947 files. Major top-level counts observed include:
- `tests`: ~1,200 files;
- `plugin`: ~798;
- `docs`: ~420;
- `frontend`: ~392;
- `main_logic`: ~212;
- `utils`: ~192;
- `config`: ~119;
- `main_routers`: ~113;
- `memory`: ~68;
- `app`: ~45.

This size means README-level analysis is not sufficient.

## Major source subsystems observed

### Layered memory system
Evidence: `docs/architecture/memory-system.md`, `memory/`, `app/memory_server/`.

Current memory is a per-character pipeline, not a single vector DB:
- bounded working context;
- recent memory with in-place summary;
- raw chronological journal;
- atomic facts;
- reflections;
- persona knowledge.

Important behaviors:
- recent-memory compression retains newest turns verbatim;
- fact extraction and dedup;
- absorbed fact archival rather than immediate deletion;
- reflection IDs derived from source facts for retry idempotency;
- evidence-backed reflection lifecycle;
- promotion/merge into durable persona;
- explicit hybrid recall tool;
- persona excluded from user-facing recall because already injected;
- different fallbacks when embeddings fail;
- mention suppression is separate from evidence/deletion;
- replayable outbox/background operations;
- event-before-view-write recovery pattern;
- at-least-once handlers must be idempotent.

Masanawa should adapt the cognitive pipeline but replace per-character storage with canonical scoped Postgres persistence.

### Plugin platform
Evidence: `docs/plugins/index.md`, `plugin/`.

N.E.K.O plugin framework uses:
- process isolation;
- async IPC (ZMQ);
- host lifecycle manager;
- plugin server/registry;
- independent Plugin and Adapter package types;
- gateway/protocol adapters;
- marketplace/release tooling;
- hosted UI and tool-calling SDK concepts;
- extensive tests.

Masanawa should borrow packaging/isolation/lifecycle ideas while retaining canonical Skills/Tools/Providers as the only runtime abstractions.

### Agent/server
Evidence:
- `app/agent_server/`;
- `brain/`;
- browser/computer-use channels;
- OpenClaw/MCP/user-plugin bridges;
- task executor.

Capabilities include browser use, computer use, plugin execution and external agent/protocol bridges.

### Proactivity
Evidence:
- `main_logic/proactive_chat/`;
- `config/proactive_settings.py`;
- proactive API/router/design docs.

Observed decomposition includes:
- candidate selection;
- sources;
- decisions;
- generation;
- delivery;
- state;
- content logging;
- break reminders;
- mini-game invites;
- music recommendation.

This is a strong donor because proactivity is treated as a domain rather than a single prompt.

### Character/persona and voice
Evidence:
- character config/defaults/fields;
- prompt families;
- `app/main_server/voice_identity_runtime.py`;
- frontend/avatar modules.

N.E.K.O has strong same-character embodiment concepts but Masanawa retains CWS-style versioned canonical identity.

### Embodiment/avatar
Observed support/references include VRM, MMD, Live2D-style/PNG frontend behaviors, VMC pose output and rich avatar interaction tooling.

This should influence AvatarProvider and client-side embodiment, not create separate identity storage.

### Perception and computer use
Dependencies and modules show:
- Playwright/browser-use;
- pyautogui/desktop controls;
- screen capture;
- OCR;
- window enumeration;
- ASR/voice;
- visual/avatar interactions.

All must be mapped through Masanawa PerceptionEvent and Tool boundaries with explicit permissions.

### Provider breadth
Pinned dependencies include OpenAI, Google GenAI, Anthropic, DashScope plus local/optional speech and embedding components.

## Technology observations

Pinned runtime targets Python 3.11 exactly. It has a very large Python application plus frontend assets/applications. Masanawa does not preserve this as a second runtime.

## Important migration cautions

- N.E.K.O memory is scoped per character; Masanawa additionally needs per-user-character privacy scope.
- editable JSON/files are runtime truth in parts of N.E.K.O; Masanawa will use PostgreSQL canonical state.
- plugin processes must not become alternate memory/identity/task authorities.
- browser/computer use is highly permission-sensitive.
- N.E.K.O's vast test suite is a major behavior-mining source.

## Deep-mined behavior added in Pass 2

### Memory liveness and poison-input handling
Verified from `tests/unit/test_memory_liveness_dead_letter.py` and memory-server code:
- background LLM stages track repeated failures against a stable progress key/cursor;
- failures below the threshold preserve the cursor for retry;
- the terminal repeated failure moves the progress marker/dead-letters the poison input so one bad item cannot stall the entire character memory pipeline forever;
- successful processing clears accumulated failure counters;
- the same liveness principle is applied across fact extraction, rebuttal checks, persona correction batches, dedup/refine work and outbox completion;
- progress updates preserve work that arrived while a pass was in flight rather than blindly zeroing counters.

Masanawa should generalize this into durable per-work-item attempt state and a Needs Attention/dead-letter path rather than process memory.

### Foreground persistence contract
Verified from `test_memory_server_cache_settle.py`:
- a completed conversation turn is persisted to bounded recent history and chronological original-event storage before background extraction;
- post-turn/outbox work is spawned from that durable foreground write;
- stale/deleted recent-history identity aborts downstream persistence rather than writing mismatched state;
- locale/language admission ordering is allocated deterministically before thread offload.

Masanawa equivalent: commit the canonical Turn plus memory-ingest event transactionally before asynchronous cognition jobs run.

### Memory rendering and retrieval separation
The architecture doc confirms:
- automatic new-dialog context is a bounded renderer over persona/reflections/recent context, not a semantic dump of all history;
- explicit recall is a separate tool/query path;
- persona is excluded from explicit user-facing recall because it is already injected automatically;
- retrieval has caller-specific degradation when embeddings fail;
- memory-server query failure degrades to an empty recall result so ordinary conversation can continue.

This distinction should become explicit Masanawa APIs: `compileMemoryContext` vs `recallMemory`.

### Plugin lifecycle/isolation
Verified from plugin docs and hot-reload tests:
- plugins/adapters execute in separate processes behind async IPC;
- hot reload does not auto-start a plugin that the user intentionally stopped;
- reload rechecks running state inside the operation lock, preventing race resurrection;
- start/registration is rejected once host shutdown begins;
- busy reload is rescheduled/retried rather than blocking forever;
- stop is idempotent;
- restart drain has a deadline and retains in-flight task ownership until it actually finishes;
- invalid/preflight-broken source changes must not replace a healthy running instance.

Masanawa should borrow isolation/lifecycle semantics, while plugin packages may only register canonical Tools/Skills/Providers/EventHandlers and cannot own platform identity/memory.

### Plugin SDK contracts
Verified:
- event/entry metadata is typed and supports input schema, timeout, persistence/autostart/LLM-result metadata;
- plugin-to-plugin calls expose typed success/error results;
- call-chain depth/circular-call errors are explicit;
- enabled/disabled plugin state is queryable;
- OS activity snapshots narrow system signals and explicitly represent `visible`, `private` and `unavailable` privacy states.

Masanawa should preserve typed extension contracts and call-chain limits.

### Proactivity
The modular design and tests show proactivity as a stateful domain:
- candidate/source collection, decisions, generation and delivery are separate;
- persistent source history prevents repetitive use across restarts;
- source-history load failure fails conservatively: it avoids overwrite that could truncate unknown on-disk history;
- concurrent writes are lock-protected through the actual atomic replace;
- cancellation waits for an already-offloaded atomic write to finish before releasing the lock;
- state survives restarts;
- repeated/unanswered proactive content, voice failure/backoff, user directives and screenshot staging have dedicated tests.

Masanawa should use PostgreSQL transactions/claims instead of JSON-file locks, but preserve persistence, repetition controls and fail-conservative state handling.

### Computer/browser-use safety
Verified from `test_computer_use_hardening.py`:
- generated desktop-control code is parsed/sanitized as AST and narrowed to approved actions/imports/literals;
- reflection/introspection, arbitrary imports, unpacking and indirect access to hidden backend objects are rejected;
- held keyboard/mouse state is always cleaned up, and failed releases remain tracked for retry;
- completion is not signalled until input cleanup has run;
- desktop execution is globally serialized so two computer-use agents cannot race the same physical desktop;
- rejected actions are fed back into the next reasoning step as an execution failure rather than silently ignored.

Masanawa must not execute model-generated general Python for desktop control. The canonical Tool should compile a typed action plan or similarly restricted action language, enforce exclusive device leases, and guarantee cleanup.

### Voice identity
N.E.K.O contains a substantial optional owner/speaker voice-identity subsystem, not merely TTS voice selection.

Verified from runtime/service tests:
- voice verification profile activation applies to current and future session managers;
- activation has explicit states such as READY, RUNTIME_DEGRADED and UNSUPPORTED_ASR_ROUTE rather than a boolean;
- newer session-level activation is preferred over legacy per-utterance filtering;
- incompatible legacy routes fail/degrade rather than receiving an unsafe verifier object;
- enrollment temporarily suppresses voice input and reliably restores suppression on unregister/cancel/failure;
- policy revision/CAS-style checks prevent stale activation work from overwriting newer requirements;
- sensitive embeddings/models are explicitly closed/wiped on cancellation/failure paths.

For Masanawa this should remain an optional security/recognition capability, separate from a character's canonical output voice identity.

### Avatar interaction -> memory
Verified from avatar interaction memory tests:
- embodied interactions can create compact factual memory notes;
- rapid/repeated variants use dedupe keys/ranks so a stronger summary can replace a weaker event within the dedupe window without repeating every interaction;
- unsupported/missing touch-zone detail is not invented;
- only direct event facts enter memory; compatibility/free-text draft context is excluded;
- automatic game/avatar lines can be marked interaction-only so generated chatter is not indiscriminately written into ordinary relationship memory.

This is useful for Masanawa's PerceptionEvent -> MemoryCandidate contract: embodied events need explicit provenance and memory eligibility.

## Phase 0 follow-up

Deep-mine:
1. all memory lifecycle tests and schemas;
2. plugin lifecycle/security/permissions/hot reload;
3. proactive domain;
4. character/avatar identity configuration;
5. voice and multimodal session behavior;
6. browser/computer-use safety;
7. cross-device/session continuity;
8. provider configuration;
9. task execution;
10. frontend avatar interaction contracts.
