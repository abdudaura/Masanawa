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
