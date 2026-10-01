# ADR-0008 — Agent runtime, skills, plugins and workflow adoption boundary

Status: Accepted  
Date: 2026-10-01  
Phase: 0A

## Context

Masanawa requires exactly one character-aware execution framework, one skill system, one plugin/component registry and one durable workflow authority. The pinned comparison covers:

- OpenJarvis `c4da16e1ca3d21f4cc1905d4200063e564104f0f`;
- elizaOS `cda43c762c605b69e4fcb9a791092508814bf6c4`;
- Microsoft Agent Framework `e15c6dce2d10196a61c851a56ef3d839ff3c3ea7`;
- OpenClaw `83e4755b55e8864e48348f3eb2364ee3e5f0fb54`.

The donors solve overlapping but different layers. Adopting any donor runtime wholesale would collapse Masanawa Character identity, relationship privacy, business workflows or channel/session state into a framework object.

## Decision

Masanawa owns the stable execution boundaries.

- `packages/agents` owns the character-aware execution envelope, strategy contract and run budgets.
- `packages/skills` owns canonical Skill/SkillVersion/SkillRevision/eligibility/certification contracts.
- `packages/plugins` owns extension manifests, component registration, capabilities, lifecycle and permission intersection.
- `packages/tools` owns canonical callable capabilities and deterministic side-effect policy.
- `packages/workflows` owns durable workflow definitions, runs, checkpoints, requests/approvals and restart semantics.
- `packages/providers` owns model/provider selection; an Agent is never a provider.
- Character identity, memory, world and business truth remain outside the execution framework.

## Selected donor composition

### Agent execution — OpenJarvis structural donor, elizaOS TypeScript donor

OpenJarvis is the primary structural donor for:
- explicit agent strategy abstraction;
- simple/orchestrator/ReAct/code/recursive strategy families;
- loop/repeated-tool/polling guards;
- token/cost/iteration budgets;
- tool normalization and execution metadata;
- provider-neutral engine selection/fallback semantics;
- trace collection and learning-candidate overlays.

elizaOS is the primary TypeScript implementation reference for:
- one runtime registry of actions/providers/evaluators/services/events;
- staged routing/planning/action execution;
- service lifecycle;
- typed component contracts;
- prompt/context composition;
- per-turn access/disclosure gates.

Masanawa reimplements a smaller runtime rather than adopting elizaOS `AgentRuntime` wholesale. A Masanawa Character is not an eliza/OpenJarvis Agent.

OpenClaw contributes active-run steer/follow-up/collect/interrupt semantics, subagent lineage, sandbox/tool-policy separation and current-authority revalidation.

Microsoft Agent Framework contributes middleware/interception semantics and agent-as-workflow-executor adapters, but does not own the interactive character loop.

### Skills — OpenJarvis structural donor

OpenJarvis remains the primary structural donor for:
- manifest/parser;
- manager/catalog;
- dependency/subskill graph;
- SkillTool adapter;
- executor;
- import/source adapters;
- provenance/trust metadata;
- graceful isolation of invalid/cyclic skills;
- trace-driven optimization/discovery as non-authoritative candidates.

OpenClaw contributes:
- multi-scope distribution and deterministic precedence;
- eligibility/gating;
- immutable managed revisions;
- content-derived revision hashes;
- stale-edit conflict behavior;
- per-agent/session visibility and revision pinning;
- workshop/community lifecycle.

Microsoft Agent Framework contributes:
- progressive disclosure;
- composable skill sources;
- resource/script separation;
- path/symlink traversal defenses;
- MCP/Agent Skills interoperability.

ChatWithStars remains the governance donor for certification/readiness/risk/approval/pricing/idempotency/expertise.

Skill source files and Markdown are authoring/import formats, not production truth. Canonical SkillVersion state is database-backed.

### Plugins/extensions — elizaOS primary component-model donor

elizaOS is the primary component-model donor because a plugin can register typed:
- actions;
- providers;
- evaluators;
- long-lived services;
- events;
- models;
- routes;
- schema/components;
- optional UI/app surfaces.

Useful invariants:
- core validates shape/dependencies but does not install arbitrary packages;
- package resolution/install is a host/supply-chain concern;
- missing resolver fails closed;
- dependency ordering/cycle validation precedes activation;
- service lifecycle has explicit start/stop and shutdown admission.

OpenClaw contributes operator/plugin lifecycle, idle-before-update/restart, control-plane separation and current-authority checks.

N.E.K.O remains a secondary isolation/hot-reload donor from the prior deep pass.

Masanawa plugins register canonical platform components; a plugin is never an alternate kernel, memory system, workflow engine or authorization boundary.

### Durable workflows — Microsoft Agent Framework primary orchestration donor

Microsoft Agent Framework is the primary workflow/orchestration donor for:
- typed executor graph;
- sequential/fan-out/fan-in/conditional composition;
- immutable built workflow definition;
- graph validation/signature;
- checkpoint storage abstraction;
- complete committed workflow state capture;
- checkpoint lineage;
- pause/resume;
- pending human/request-info state;
- restart/time-travel concepts;
- middleware and OpenTelemetry;
- agent executors inside workflows.

Masanawa does not use MAF checkpoint files or Python objects as canonical persistence. The graph/checkpoint semantics are reimplemented in TypeScript/PostgreSQL behind `packages/workflows`.

ChatWithStars remains authoritative for deterministic commerce/social/business state, provider reconciliation, idempotency and side-effect evidence.

OpenJarvis workflow graph is a useful lightweight validation/parallel-stage donor but is not sufficiently durable as the canonical workflow authority.

OpenClaw in-memory run queue/session steering is explicitly not a durable business workflow.

## Execution envelope

Every interactive run must bind:
- tenant/organization;
- user/principal;
- Character + CharacterVersion;
- relationship where applicable;
- channel/presence/session references;
- purpose/intent;
- memory/context authorization;
- effective tools/skills/plugins;
- provider/model policy;
- budget/timeout/loop guards;
- approval/current-authority policy;
- trace/run ID.

The model may propose tool/skill/workflow actions but never supplies authorization.

## Side-effect boundary

Consequential work crosses from probabilistic agent execution into deterministic workflow/tool execution.

Before commit:
1. validate canonical input;
2. authorize current principal/scope;
3. require approval when policy says so;
4. allocate idempotency key/operation identity;
5. revalidate current authority immediately before delayed mutation;
6. execute through a canonical tool/provider;
7. persist receipt/evidence;
8. reconcile ambiguous outcomes instead of blind retry.

Steering/cancellation can stop unstarted work but cannot erase or replay a side effect already admitted/executed.

## Workflow checkpoint boundary

A checkpoint captures committed workflow state, executor state, edge/fan-in delivery state, pending human/request events, iteration/superstep metadata and lineage. Compatibility is tied to a versioned workflow definition/graph signature.

Masanawa additionally records tenant, workflow version, run identity, side-effect receipts and authorization/approval evidence. Restoring a checkpoint never restores stale authorization as current authority.

## Learning boundary

Traces, evaluators and optimizers may produce candidate strategy/skill/prompt changes. Candidates require offline evaluation plus Masanawa certification/rehearsal before a production version is published. No runtime self-modifies consequential behavior directly.

## Direct reuse boundary

Default: adapt/reimplement in TypeScript behind Masanawa contracts.

Possible direct dependencies only after package/license/security review:
- protocol/interoperability packages such as MCP/A2A clients;
- narrow utility packages that do not own domain state;
- OpenClaw public gateway packages only in its compatibility bridge (ADR-0004).

Do not directly depend on donor runtime kernels as Masanawa's execution authority.

## Consequences

Masanawa gets one execution fabric without conflating conversational agency with durable business orchestration. Skills and plugins can evolve independently of Character identity. Workflows survive process failure and human pauses. Donor runtimes remain reference/adapter systems rather than hidden platform boundaries.
