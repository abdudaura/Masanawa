# Phase 0B Coverage — Microsoft Agent Framework

Pinned revision: `microsoft/agent-framework@e15c6dce2d10196a61c851a56ef3d839ff3c3ea7`.

Status: **ACTIVE / PARTIAL**.

Canonical boundary: Microsoft Agent Framework (MAF) is Masanawa's primary durable workflow/orchestration donor. It does not own Character identity, memory, provider choice, business truth or Masanawa persistence. Workflow semantics are adapted into TypeScript/PostgreSQL behind `packages/workflows`.

## 1. Repository/runtime boundary

Pinned root evidence:
- `README.md` — production-grade .NET + Python agent/workflow framework, graph orchestration, checkpointing, streaming, HITL, time travel, provider flexibility and OpenTelemetry.
- `python/pyproject.toml` — Python workspace contains core plus provider, hosting, A2A, MCP, storage, orchestration and tooling packages.
- `dotnet/Directory.Build.props` — .NET implementation spans modern .NET plus compatibility TFMs with analyzers/warnings-as-errors.

Masanawa disposition: **B**. Preserve cross-language semantics, reimplement canonical workflow authority in TypeScript/PostgreSQL.

Acceptance gate:
- no Python/.NET workflow object is canonical Masanawa state;
- protocol/provider libraries may be adapters only;
- workflow definition/run/checkpoint IDs remain Masanawa-owned.

## 2. Checkpoint contract and lineage

Implementation evidence:
- `python/packages/core/agent_framework/_workflows/_checkpoint.py`.

Pinned behavior:
- `WorkflowCheckpoint` captures workflow name + graph signature hash;
- checkpoint ID is unique and linked by `previous_checkpoint_id`;
- committed messages/state are captured;
- executor state and edge/fan-in delivery state are included under reserved state keys;
- pending request-info/HITL events are captured;
- iteration count marks a superstep boundary but is explicitly **not** a unique ordering key;
- lineage is defined by checkpoint predecessor chain + timestamp;
- `CheckpointStorage` is an abstraction with save/load/list/delete/latest/list-ids;
- in-memory storage deep-copies records;
- file storage implements careful same-destination serialization and documents the limit that process-local coordination does not serialize writers across replicas.

Masanawa destination:
- `packages/workflows` `WorkflowCheckpoint`, `WorkflowRun`, `WorkflowRequest`, edge delivery state;
- PostgreSQL is canonical checkpoint persistence.

Disposition: **A for semantics; B for implementation**.

Acceptance gate:
- checkpoint restore requires exact workflow version/graph compatibility;
- checkpoint ordering uses explicit lineage/version, never iteration number alone;
- committed executor + edge/fan-in state and pending human requests survive restart;
- storage concurrency is database/transaction fenced across replicas, not process-local.

## 3. Graph signature / compatibility boundary

Implementation evidence:
- `python/packages/core/agent_framework/_workflows/_workflow.py`;
- checkpoint contract above.

Pinned behavior:
- workflows compute a graph signature/hash used to validate checkpoint compatibility;
- a checkpoint belongs to a workflow definition rather than one process instance.

Masanawa destination:
- immutable `WorkflowVersion` with content-derived graph signature.

Disposition: **A/B**.

Acceptance gate:
- incompatible workflow definition cannot restore an old checkpoint silently;
- migration/replay to a new workflow version is an explicit operation;
- side-effect receipts remain attached to the original run/version.

## 4. Runner convergence, edge delivery and cancellation

Implementation evidence:
- `python/packages/core/agent_framework/_workflows/_runner.py`;
- `python/packages/core/tests/workflow/test_runner.py`.

Pinned tested behavior:
- runner has a max-iteration convergence guard and raises a typed convergence failure;
- message order to the same edge runner is preserved;
- different edge runners can deliver concurrently;
- fan-out targets execute concurrently;
- a failed run does not permanently poison runner lifecycle for a later run;
- cancellation stops active executor work rather than allowing leaked completion;
- executor failure drains already-emitted events before propagating the failure.

Masanawa destination:
- `packages/workflows` executor/superstep engine.

Disposition: **A/B**.

Acceptance gate:
- cyclic/non-converging graph is bounded by explicit run budget;
- per-edge ordering is deterministic where required;
- fan-out concurrency does not reorder same-edge messages;
- cancellation prevents uncommitted executor completion but cannot erase already-committed side effects;
- failure leaves run state typed/restartable rather than wedged.

## 5. Human/request-info checkpoint semantics

Implementation evidence:
- checkpoint `pending_request_info_events`;
- checkpoint tests under `python/packages/core/tests/workflow/test_checkpoint.py`;
- HITL checkpoint sample `python/samples/03-workflows/checkpoint/checkpoint_with_human_in_the_loop.py`.

Pinned behavior:
- workflows can pause with pending request-info events;
- checkpoint can be taken at the same iteration boundary before and after a response-entry transition;
- lineage, not iteration number, determines ordering.

Masanawa destination:
- `packages/workflows` pending approval/request model.

Disposition: **A/B**.

Acceptance gate:
- pause survives process restart;
- responding to a pending request creates a new lineage step;
- current authorization/approval is revalidated before consequential resumed mutation;
- stale human responses cannot satisfy a replaced/revoked request.

## 6. Handoff orchestration

Implementation evidence:
- `python/packages/orchestrations/agent_framework_orchestrations/_handoff.py`;
- workflow orchestration docs/tests located under Python/.NET orchestrations.

Current disposition: **ACTIVE / needs deeper descendant proof**.

Masanawa boundary:
- handoff is workflow/agent execution routing;
- it must not mint Character identity or bypass tool/security boundaries.

Required closure:
- explicit handoff state machine;
- target eligibility and termination;
- history/context transfer;
- failure/retry/cancellation;
- human handoff interactions;
- exact tests.

## 7. Agent Skills boundary

Implementation evidence:
- `python/packages/core/agent_framework/_skills.py`;
- `docs/decisions/0037-agent-skills-design.md`;
- .NET file skill source counterpart.

Current disposition: **ACTIVE / needs deeper descendant proof**.

Phase 0A selected MAF as secondary donor for:
- progressive disclosure;
- aggregated skill sources;
- resource/script separation;
- path/symlink traversal defenses;
- MCP interoperability.

Canonical Masanawa owner remains `packages/skills`.

## Current unresolved descendant families

Before MAF can be marked covered:
1. full Python workspace/package inventory and dispositions;
2. full .NET project inventory and parity/delta map;
3. graph builder validation, edge groups, fan-in/fan-out/conditional routing;
4. checkpoint file/storage implementations, restore validation and cross-process durability limits;
5. HITL/request-response lifecycle and approval/tool-approval semantics;
6. handoff/group-chat/magentic/sequential/concurrent orchestrations;
7. agent middleware/interceptors and failure semantics;
8. provider/client adapters and fallback/retry boundaries;
9. A2A and MCP hosting/client semantics;
10. durable storage packages (Postgres/SQL Server/Cosmos/Redis/Mongo/Qdrant/etc.) and authority classification;
11. agent skills source/resource/script/path-safety semantics;
12. OpenTelemetry/observability privacy and error propagation;
13. declarative workflows/agents and versioning;
14. exact direct-test inventory for retained consequential behavior;
15. repository-wide descendant proof with zero unresolved production families.

Do not advance to OpenClaw until these are closed.


## 8. Graph construction and validation

Implementation evidence:
- `python/packages/core/agent_framework/_workflows/_workflow_builder.py`;
- `python/packages/core/agent_framework/_workflows/_edge.py`;
- `python/packages/core/agent_framework/_workflows/_validation.py`;
- tests: `python/packages/core/tests/workflow/test_workflow.py`, `test_edge.py`.

Pinned behavior:
- immutable workflow build is separated from mutable builder configuration;
- duplicate executor IDs are rejected before activation;
- graph validation covers duplicate edges, type compatibility, graph connectivity, handler output annotations and output selection;
- supported edge groups include single, conditional, fan-out, fan-in and switch/case/default routing;
- fan-in keeps partial delivery state that is checkpointed;
- serialized edge conditions persist names, not executable Python callables; missing callable restoration fails loudly instead of silently routing differently;
- agent objects are wrapped as executors without turning the agent object into workflow identity.

Disposition: **A/B**.

Masanawa destination: `packages/workflows` immutable `WorkflowVersion`, executor/edge definitions and validator.

Acceptance gate:
- invalid/disconnected/type-incompatible graph cannot publish;
- duplicate executor/edge IDs fail deterministically;
- conditional callable/expression identity is versioned and cannot silently disappear on restore;
- fan-in partial state survives checkpoint/restore;
- workflow definition is immutable once published.

## 9. Tool approval and approval-bound arguments

Implementation evidence:
- `python/packages/core/agent_framework/_tools.py`;
- `python/packages/core/agent_framework/_workflows/_agent_executor.py`;
- tests/samples for approval and HITL under core workflow and `samples/03-workflows/tool-approval`.

Pinned behavior:
- tools can declare always/never approval modes;
- approval state is session-bound and distinguishes authoritative caller-owned sessions;
- approval requests pause execution and can become workflow request-info events;
- approval binds to an immutable, type-aware snapshot/token of prepared arguments;
- opaque mutable arguments are rejected as unsafe approval authority;
- if middleware mutates arguments after approval, execution detects the change instead of silently applying approval to new arguments;
- approval requests are not charged as executed tool calls until the tool body actually runs;
- concurrent tool batches cancel sibling tasks when one fails loudly, while documenting that a synchronous side effect already running in a worker thread may still complete and therefore requires side-effect reconciliation above this layer.

Disposition: **A — preserve approval/current-argument authority semantics; B — integrate into Masanawa workflow/tool policy**.

Acceptance gate:
- approval refers to exact canonical arguments, tool/version, principal and scope;
- changed arguments invalidate approval;
- stale/revoked approval cannot authorize resumed mutation;
- already-started consequential effects are reconciled, never assumed cancelled merely because the coroutine was cancelled;
- approval state is durable and auditable.

## 10. Agent middleware / interception

Implementation evidence:
- `python/packages/core/agent_framework/_middleware.py`;
- middleware samples and tests.

Pinned behavior:
- middleware can wrap agent/chat/function invocation;
- explicit termination can return a controlled result;
- middleware failures are typed separately from ordinary model/tool errors;
- streaming and non-streaming paths share interception concepts;
- exception-handling middleware can observe/transform failures without requiring provider-specific code.

Disposition: **B**.

Masanawa destination:
- runtime middleware/telemetry/policy seams around agents/tools/providers;
- middleware cannot become an alternate authorization source.

Acceptance gate:
- middleware ordering is deterministic and versioned;
- middleware cannot bypass canonical tool authorization;
- termination/failure reason is observable;
- streaming cleanup/cancellation leaves no leaked workflow admission.

## 11. Orchestration families

Implementation/test evidence:
- handoff: `python/packages/orchestrations/agent_framework_orchestrations/_handoff.py` + `tests/test_handoff.py`;
- group chat: `_group_chat.py` + `tests/test_group_chat.py`;
- Magentic: `_magentic.py` + `tests/test_magentic.py`;
- sequential: `_sequential.py` + `tests/test_sequential.py`;
- concurrent: `_concurrent.py` + `tests/test_concurrent.py`;
- parity counterparts and tests exist in .NET workflow builders.

Pinned behavior:
- handoff tools target explicit eligible participants rather than arbitrary runtime names;
- conversation/history is cleaned and transferred on handoff rather than replaced by a new identity;
- handoff orchestration supports checkpoint/HITL/tool-approval paths;
- group chat has explicit participant selection and termination output;
- manager-produced unknown participant selections are validated against known participants;
- Magentic keeps task/progress ledgers, stall/reset/round bounds and checkpointable manager state;
- sequential and concurrent builders compose agent/executor participants into ordinary workflow graphs rather than separate execution engines;
- concurrent orchestration has explicit aggregation.

Disposition: **A/B for orchestration semantics**, **C as Character identity authority**.

Acceptance gate:
- orchestration target must be a workflow-version participant;
- handoff cannot mint identity or bypass tool permissions;
- bounded round/stall/reset budgets terminate non-converging coordination;
- manager/LLM participant selection is validated deterministically;
- checkpoint restore preserves orchestration manager state and pending approvals;
- sequential/concurrent composition uses the same canonical WorkflowRun/checkpoint engine.

## 12. Agent Skills progressive disclosure and filesystem safety

Implementation evidence:
- `python/packages/core/agent_framework/_skills.py`;
- `docs/decisions/0037-agent-skills-design.md`;
- .NET `AgentFileSkillsSource`.

Pinned behavior:
- progressive disclosure is explicit: advertise -> load full skill -> read resource on demand;
- inline/class/file/custom sources share one abstraction;
- aggregating/filtering/deduplicating/caching sources compose without changing canonical skill identity;
- metadata injected into prompts is escaped;
- file skill resources/scripts retain a trusted discovery-root scope;
- containment is validated during construction and revalidated immediately before read/run;
- symlink/reparse-point replacement after discovery is checked at use time, closing a TOCTOU escape path;
- scripts are separate executable capabilities and require a runner rather than being treated as plain prompt text.

Disposition: **A/B as secondary skills donor**; canonical owner remains `packages/skills`.

Acceptance gate:
- skill revision/source trust is explicit;
- file/resource/script path escape and post-discovery symlink swap fail closed;
- executable scripts use canonical tool permissions/sandbox/approval;
- skill source aggregation cannot silently override a certified immutable revision;
- prompt metadata remains data, not privileged instructions.

## 13. A2A protocol boundary

Implementation evidence:
- `python/packages/hosting-a2a/agent_framework_hosting_a2a/_conversion.py`;
- `python/packages/hosting-a2a/README.md`;
- Python A2A package/tests;
- .NET `Microsoft.Agents.AI.A2A` and hosting A2A projects/tests.

Pinned behavior:
- protocol conversion validates advertised input/output modes and typed workflow input;
- workflow input must have exactly one compatible A2A part;
- completed workflow outputs are converted to protocol parts;
- a workflow requiring external/HITL input is **not** falsely represented as a completed A2A response; application contract must manage continuation.

Disposition: **B — protocol adapter only**.

Acceptance gate:
- protocol task/message IDs map to canonical run/session IDs without becoming workflow authority;
- incompatible mode/type fails at adapter boundary;
- HITL continuation remains explicit rather than being collapsed into success;
- remote A2A agent responses are untrusted provider/tool input until validated.

## 14. Declarative workflow boundary

Implementation evidence:
- `python/packages/declarative/agent_framework_declarative/_workflows/_declarative_base.py`;
- declarative workflow integration tests;
- .NET declarative workflow projects/tests.

Pinned behavior:
- declarative variables live inside checkpointable workflow State;
- expression environment defaults to caller-supplied configuration only;
- optional OS-environment fallback is restricted to names literally referenced by workflow expressions;
- unrelated environment variables are not injected into expression scope;
- cyclic definition containers are rejected;
- PowerFx-compatible state is size/depth bounded and normalized before evaluation.

Disposition: **B — authoring/import format, not production truth**.

Acceptance gate:
- YAML/declarative definition compiles to immutable canonical `WorkflowVersion`;
- secrets/config references resolve through explicit bindings, not ambient environment enumeration;
- expression/state size and recursion are bounded;
- declarative HTTP/MCP/tool executors still pass canonical tool/security policy;
- editing YAML never mutates a running workflow definition in place.

## 15. OpenTelemetry / observability privacy

Implementation evidence:
- `python/packages/core/agent_framework/observability.py`;
- `python/packages/core/tests/core/test_observability.py`;
- workflow telemetry hooks.

Pinned behavior:
- spans cover agent/chat/tool/workflow operations and capture typed errors;
- streaming cleanup records stream/finalization failures and closes spans even when streams are not fully consumed;
- sensitive message content capture is opt-in through sensitive telemetry settings;
- application-managed conversation identity can be supplied for telemetry without overwriting service continuation identity;
- token usage and duration are collected separately from raw content.

Disposition: **A/B**.

Masanawa destination: telemetry/observability layer.

Acceptance gate:
- private content is excluded from telemetry by default;
- enabling sensitive telemetry is explicit, scoped and auditable;
- provider/tool/workflow failures preserve trace linkage without leaking secrets;
- abandoned streams/spans close deterministically;
- telemetry identifiers never become domain identity authority.
