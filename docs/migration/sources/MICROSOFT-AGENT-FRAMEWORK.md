# Source Map — Microsoft Agent Framework

Pinned: `e15c6dce2d10196a61c851a56ef3d839ff3c3ea7`.

Status: Phase 0A workflow/orchestration deep pass complete.

## Executive result

Microsoft Agent Framework is selected as the primary **durable graph-workflow semantics donor** and a secondary middleware/skills/interoperability donor.

Masanawa will adapt its workflow semantics behind a TypeScript/PostgreSQL `packages/workflows` implementation rather than introduce a second canonical Python runtime.

## Workflow graph

The pinned workflow builder supports typed executors/agents and graph edges including sequential, conditional, fan-out/fan-in/switch patterns. Build validates the graph and applies max-iteration convergence limits.

Useful Masanawa concepts:
- immutable/versioned workflow definition;
- explicit start executor;
- typed input/output;
- graph validation before activation;
- deterministic edge delivery state;
- selected/intermediate output semantics;
- subworkflow composition.

## Checkpointing and recovery

`WorkflowCheckpoint` captures:
- workflow name;
- graph signature hash;
- checkpoint ID + previous checkpoint lineage;
- messages;
- committed workflow state;
- executor state;
- edge-runner/fan-in state;
- pending request-info events;
- iteration/superstep metadata;
- timestamp/version/metadata.

Important invariant: checkpoint ordering is lineage-based, not simply iteration number, because human-in-loop response-entry checkpoints can share the same iteration boundary.

Checkpoint storage is abstracted. File storage includes careful serialization/atomic-replace behavior, but Masanawa will use canonical PostgreSQL persistence and DB concurrency.

Masanawa adds current authorization/approval revalidation and side-effect receipts to restore semantics.

## Human-in-loop

Pending request-info events survive checkpoint/restore. This is the strongest donor pattern for pause/resume around approvals, clarification and human intervention.

A restored request is durable workflow state, but an old authorization snapshot is never current authority.

## Middleware and observability

Agent/function middleware receives explicit invocation context and can inspect/modify metadata, tools/options and result around `call_next`. Workflow code includes OpenTelemetry spans/feature instrumentation.

Use as a donor for framework-neutral execution middleware and trace correlation.

## Agent Skills

The pinned skills implementation supports:
- progressive disclosure (advertise -> load -> resource read);
- file, inline, class and custom sources;
- aggregating/filtering/deduplicating/caching sources;
- resources distinct from scripts;
- script runners;
- XML escaping;
- traversal/symlink escape defenses;
- MCP interoperability.

OpenJarvis remains Masanawa's primary structural SkillManager/executor donor; MAF contributes disclosure/source/security/interoperability behavior.

## Adoption role

Primary donor:
- durable workflow graph/checkpoint/HITL/restart semantics.

Secondary donor:
- middleware;
- OpenTelemetry;
- Agent Skills progressive disclosure;
- A2A/MCP interoperability;
- agent-as-workflow-executor adapters.

Rejected:
- Python workflow objects/checkpoint files as canonical persistence;
- framework Agent identity as Character identity;
- framework session state as Masanawa memory/business truth.

See ADR-0008 and `docs/migration/RUNTIME-SKILLS-WORKFLOW-ADOPTION-BOUNDARY.md`.
