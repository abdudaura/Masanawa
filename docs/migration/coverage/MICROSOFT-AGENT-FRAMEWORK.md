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
