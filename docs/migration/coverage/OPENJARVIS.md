# Phase 0B Forensic Coverage — OpenJarvis

Pinned revision: `open-jarvis/OpenJarvis@c4da16e1ca3d21f4cc1905d4200063e564104f0f`

Status: ACTIVE REMEDIATION

OpenJarvis is a structural donor, not a Masanawa runtime dependency. This file replaces the invalid earlier root-only coverage claim.

## Canonical synthesis rule

OpenJarvis contributes execution structures and safety behavior. Masanawa does not preserve:
- OpenJarvis assistant/persona identity;
- SQLite as domain truth;
- its Python/Rust split as two production authorities;
- its standalone scheduler/workflow/session stores as competing canonical systems;
- its channel/provider ecosystem wholesale.

## Descendant capability matrix

| Family | Implementation evidence | Test evidence | Durable/state evidence | Integration evidence | A/B/C | Canonical Masanawa destination | Acceptance/parity gate |
|---|---|---|---|---|---|---|---|
| Agent execution envelope | `src/openjarvis/agents/executor.py`, `manager.py`, `orchestrator.py`, `native_react.py`, `simple.py`, `research_loop.py`, `rlm.py` | `tests/agents/test_executor*.py`, lifecycle/routing/native-react/orchestrator/rlm tests | donor manager/session state only | provider engine via canonical provider layer | B | `packages/agents` | agent strategy is selected per run; Character identity remains external; execution has bounded retries/budgets/trace correlation |
| Loop/runaway protection | `agents/loop_guard.py` | loop-guard/stall/budget tests | ephemeral per-run counters | none | A/B | `packages/agents` | identical-call, ping-pong and poll-budget loops are bounded; compression cannot remove authority/security state |
| Hybrid/model-routing research agents | `agents/hybrid/**`, skillorchestra/toolorchestra | hybrid/provider-search/security and orchestra tests | experiment configs | model providers | C/B | evaluation/agent-strategy research only | useful routing ideas must re-enter through agent/provider contracts; no experimental orchestrator becomes canonical |
| Skills parser/model | `skills/parser.py`, `types.py`, `loader.py`, bundled manifests | parser/loader/bundled-skill tests | filesystem manifests in donor | skill source imports | B | `packages/skills` | strict canonical schema; vendor extras preserved as provenance; malformed skill isolated without collapsing registry |
| Skill dependency/manager | `skills/dependency.py`, `manager.py`, `executor.py`, `tool_adapter.py` | dependency/manager/tool-adapter/metadata tests | filesystem discovery/overlay state | tools | A/B | `packages/skills` | cycles/depth rejected or unhealthy cluster pruned; transitive capabilities computed; immutable published versions replace filesystem precedence |
| Skill import/supply chain | `skills/importer.py`, `security.py`, `sources/{github,hermes,openclaw}.py`, `tool_translator.py` | importer/security/source/refresh tests | `.source` provenance sidecar | GitHub/Hermes/OpenClaw source adapters | A/B | `packages/skills` + security | scripts skipped by default, symlinks rejected, trust/dangerous capabilities recorded; import goes to quarantine/certification, never direct production |
| Tools/executor | `tools/_stubs.py`, atomic tool modules, template loader | 46 tool tests incl timeout/registration/template security | mostly stateless or local adapter state | filesystem/shell/http/browser/etc | B | `packages/tools` | common typed execution envelope; risk/side-effect/idempotency delegated to canonical tool/provider/workflow policy |
| Tool approvals | `tools/approval_store.py`, executor confirmation handling | `tests/security/test_tool_confirmation.py` | SQLite pending actions/permission memory | none | B with A fail-closed behavior | workflows + security | dangerous tool blocked if no interactive approval path; remembered permission cannot bypass current authority/policy |
| HTTP/network security | `security/ssrf.py`, HTTP/browser tools | SSRF/disguised/webhook/file/capability tests | none | network | A | `packages/security` | metadata/private/loopback/link-local/multicast and disguised IP forms blocked; DNS failure fail-closed by default |
| Sandbox | `sandbox/runner.py`, `wasm_runner.py`, `mount_security.py`; code/shell/docker tools | sandbox + code interpreter tests | ephemeral process/container state | local OS/docker/wasm | B | tools/security execution adapters | sandbox location, capability policy and elevated execution remain distinct; mounts/path escapes denied |
| Provider engine abstraction | `engine/_base.py`, `_discovery.py`, `_openai_compat.py`, cloud/local engines | 31 engine tests including discovery/model matrix/tools/structured output | provider health/model discovery cache only | OpenAI-compatible/cloud/local runtimes | B | `packages/providers` | explicit provider selection never silently substitutes; default fallback only to healthy/model-capable route; normalized tool calls |
| Provider implementations | Ollama/LiteLLM/NIM/Apple FM/Gemma/local OpenAI-compatible engines | provider-specific tests | adapter config | many external/local model runtimes | C/B per provider | provider adapters only if independently selected | no donor provider client becomes canonical merely because present |
| Memory service | `memory/{extractor,service,store}.py`, storage backends under tools | 15 memory/storage/retrieval tests | SQLite/FAISS/BM25/ColBERT etc | embedding/model providers | C/B | `packages/memory` specialist/reference only | canonical scoped PostgreSQL memory remains ADR-0007; OpenJarvis stores are rebuildable/reference algorithms only |
| Runtime sessions | `sessions/session.py`, `compression.py` | session/compression/wire-channel-history tests | SQLite session/history/link table | channels | B | agents + gateway | history continuity is runtime context only; cross-channel linkage cannot establish user identity or merge relationship memory |
| Scheduler | `scheduler/scheduler.py`, `store.py`, `tools.py` | scheduler/digest/store/tool tests | SQLite tasks + run logs | workflow/agent executor | B | workflows + proactivity | once/interval/cron, IANA timezone, pause/resume/cancel and run evidence preserved; no parallel scheduler truth |
| Lightweight workflow DSL | `workflow/{builder,engine,graph,loader,types}.py` | workflow + safe-condition tests | in-memory execution | tools/agents | C/B | workflow-definition import/reference | agent/tool/condition/transform/loop composition may inform definitions; Microsoft AF + Masanawa own durable checkpoints/HITL/restart |
| Connector contract/pipeline | `connectors/_stubs.py`, `pipeline.py`, `retriever.py`, `chunker.py` | connector integration/pipeline/attachment tests | source-aware knowledge projection | external sources | B | `packages/connectors` + knowledge | connector normalizes documents/provenance into canonical ingestion; connector never owns memory truth |
| Connector incremental sync | `connectors/sync_engine.py`, `store.py` | `test_sync_engine.py`, `test_incremental_sync.py` | SQLite cursor/items/last_sync/error in donor | external source reads | A/B | connectors + workflows | progress/failure/cancel can save cursor but never advance success watermark; source swap resets checkpoint |
| Concrete connector adapters | Apple*, Google*, Gmail/IMAP, Drive, Dropbox, Notion, Obsidian, Slack, Spotify, Strava, Oura, WhatsApp, Outlook, RSS, etc. | corresponding 46 connector tests | local OAuth/token/config stores | many third-party APIs | C/B | future connector adapters only when selected | keep interface/test ideas; do not pre-install or preserve auth/retry implementation without separate provider certification |
| Channel abstraction | `channels/**` | 33 channel tests | channel-local runtime/config | Telegram/Discord/Slack/LINE/etc | C/B | Gateway adapter references | OpenClaw remains primary channel architecture donor; OpenJarvis implementations are compatibility/reference candidates, not parallel routing |
| MCP/A2A | `mcp/**`, `a2a/**`, tool MCP adapter | MCP/A2A tests | registry/config only | MCP/A2A | B | gateway/tools interoperability | external protocol object never becomes canonical Tool/Agent identity; admission/security precedes registration |
| Trace collection | `traces/collector.py`, `store.py`, analyzer | collector/store/analyzer tests | SQLite trace store in donor | event bus | A/B | telemetry | event handlers unsubscribe after run; inference/tool/memory steps retain correlation and skill metadata; storage redesigned |
| Learning overlays | skill optimizer/discovery/evolver modules | optimizer/discovery/learning-integration tests | overlay artifacts | traces/model provider | B | telemetry + skills | minimum evidence; output is candidate/overlay, never silent production mutation |
| Spec-search learning | `learning/spec_search/**` diagnose/plan/execute/gate/checkpoint/pending queue | benchmark/regression/rollback/risk/pending/orchestrator tests | learning session files + Git checkpoint lineage | teacher/student model providers | B with A safety gates | telemetry/learning + skills + Ops | minimum traces, cost/tool budget, risk tiers, dirty-tree refusal, benchmark regression gate, explicit review tier, rollback; Masanawa certification remains final promotion |
| Routing/training research | `learning/routing/**`, `training/**`, `intelligence/**` | routing/GRPO/SFT/training tests | experiment/checkpoint data | model/GPU stacks | C/B | evaluation/research adapters | may inform future learned routing; cannot directly update production policy |
| Telemetry/energy/efficiency | `telemetry/**`, analytics/bench/evals | 25 telemetry + bench/eval tests | telemetry store | GPU/OS metrics | B | telemetry | cost/latency/token/energy observations are redacted evidence, not execution authority |
| Speech | `speech/**` discovery/STT/TTS/voice IO | 10 speech tests | provider config only | Deepgram/OpenAI/faster-whisper/Kokoro/Cartesia | C/B | providers/media/presence | retain provider-neutral discovery/interface ideas; provider adapters adopted independently |
| Server/API | `server/**` auth/middleware/routes/bridges | 38 server tests incl auth/CORS/websocket/security | donor session/API state | channels/providers/connectors | C/B | Masanawa services/apps only | server routes are product shell; security behaviors may migrate, API boundary itself does not |
| CLI/daemon/SDK | `cli/**`, `daemon/**`, root SDK | 65 CLI + daemon/SDK tests | local config | all subsystems | C/B | developer/Ops clients | preserve useful operator workflows only over canonical services; CLI cannot own state |
| Operators/recipes/templates | `operators/**`, `recipes/**`, `templates/**`, configs | operator/recipe/template tests | declarative TOML/Markdown | agents/skills/tools | C/B | workflow/skill/template import | content is seed/reference; no template becomes Character identity or privileged policy |
| Frontend/desktop | `frontend/src/**`, Tauri roots, `desktop/**` | server/CLI/UI-adjacent tests where present | client-local UI state | server APIs | C/B | future clients/ops | UI behavior may inform product design; Tauri/React shell is not architecture |
| Rust native crates | `rust/crates/openjarvis-{core,agents,engine,tools,skills,security,learning,traces,telemetry,scheduler,sessions,workflow,mcp,a2a,recipes,templates,python}/**` | Python parity/fallback tests + crate tests/build metadata | native runtime state only | Python bridge/external providers | C/B | optional native acceleration behind TS contracts | never run Python and Rust as independent authorities; only adopt bounded native algorithms after parity/profiling |
| Configs/deploy/examples | `configs/openjarvis/**`, `deploy/**`, `examples/**` | install/deployment/integration tests | deployment/config artifacts | OS/container/cloud | C/B | examples/deploy/reference | operational recipes and examples are evidence, not canonical packages |
| Full test tree | `tests/**` (721 files) | itself | fixtures/temp state | varies | evidence | parity/acceptance suite design | tests remain evidence even when implementation is retired |

## Important merge decisions

### OpenJarvis workflow engine is not the workflow foundation

Its graph is useful for declarative composition, but it lacks the durable checkpoint/restart/HITL semantics already selected from Microsoft Agent Framework and the business-state/reconciliation rules selected from ChatWithStars. Therefore it is an import/reference format, not a second workflow executor.

### OpenJarvis session store is not identity or memory

A donor session may link channels and carry prior messages. Masanawa requires verified identity/relationship authorization before cross-channel private state is exposed. RuntimeSession is a context carrier, not durable person/Character truth.

### Connector synchronization is stronger than the old architecture notes captured

The success-watermark rule is adopted:
- cursor/progress may be checkpointed during a run;
- cancellation/failure preserves the previous successful watermark;
- only successful exhaustion advances `last_sync`;
- changing the bound source invalidates/reset old cursor and watermark state.

This becomes a generic ConnectorSyncRun/Checkpoint workflow invariant, not SQLite-specific behavior.

### Spec-search is adopted as a candidate-generation discipline, not self-modification

Strong ideas retained:
- cold-start/minimum evidence;
- explicit teacher budget/tool budget;
- diagnose before propose;
- risk tier;
- isolated stage;
- benchmark before/after;
- per-cluster regression threshold;
- manual/review queue;
- durable lineage and rollback.

Masanawa adds a stronger final boundary:
`trace -> candidate -> isolated evaluation -> regression gate -> human/policy review where required -> rehearsal/certification -> immutable new version -> explicit activation`.

No learning process edits active production Character/Skill/Tool/Provider policy in place.

## State disposition

OpenJarvis local SQLite/file/Git stores are implementation evidence, not canonical data stores:
- sessions -> `D-SES-020`;
- scheduler -> `D-SCH-020/021`;
- connector checkpoint -> `D-CON-001`;
- knowledge provenance -> `D-CON-002`;
- approvals -> `D-APR-020`;
- traces -> canonical telemetry records;
- learning sessions/edits/checkpoints -> `D-LRN-001..003`;
- memory/vector/search stores -> ADR-0007 projections/reference;
- Git checkpointing -> revision-lineage behavior, not required storage technology.

## License/provenance

OpenJarvis is Apache-2.0 at the pinned revision. Direct code adaptation still requires path-level provenance/NOTICE tracking. Bundled examples, external skill sources, downloaded models and third-party provider SDK/assets do not automatically inherit reusable rights from the repository license.

## Current unresolved items

1. Produce an explicit integration disposition manifest covering every concrete `connectors/**` and `channels/**` adapter, marking each as retained adapter candidate or C/reference.
2. Produce a file-family manifest proving all 950 `src/openjarvis` files and 143 Rust crate files map to a family above or explicit non-capability/build metadata exclusion.
3. Verify Python/Rust overlap for security/loop-guard/tool execution so any future direct native reuse has an explicit parity test boundary.

Until those three items are closed, OpenJarvis remains `partial (remediation)`.
