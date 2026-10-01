# Runtime / Skills / Plugins / Workflow Adoption Boundary

Pinned comparison: 2026-10-01. See ADR-0008.

## Selection matrix

| Concern | Primary donor | Secondary donor | Canonical Masanawa owner |
|---|---|---|---|
| Agent strategy/loop | OpenJarvis | elizaOS, OpenClaw | packages/agents |
| TypeScript component runtime | elizaOS | OpenJarvis | packages/agents + packages/plugins |
| Run steering/subagents | OpenClaw | Microsoft AF | packages/agents/runtime |
| Tools/security | OpenJarvis | OpenClaw, elizaOS, CWS | packages/tools + security |
| Skills structure/execution | OpenJarvis | Microsoft AF | packages/skills |
| Skill distribution/revisions | OpenClaw | OpenJarvis | packages/skills |
| Skill progressive disclosure/resources | Microsoft AF | OpenJarvis/OpenClaw | packages/skills |
| Skill governance | ChatWithStars | OpenJarvis | packages/skills + security |
| Plugin component model | elizaOS | OpenClaw, N.E.K.O | packages/plugins |
| Durable graph workflows | Microsoft AF | ChatWithStars | packages/workflows |
| Business side-effect truth | ChatWithStars | OpenClaw authority patterns | packages/workflows + domain packages |
| Middleware/observability | Microsoft AF | elizaOS/OpenJarvis | runtime + telemetry |
| Learning/traces | OpenJarvis | elizaOS/Microsoft AF | telemetry/evaluation + governed promotion |

## OpenJarvis findings

Strongest structural skill system among compared donors:
- manifest/parser/importer;
- dependency and subskill graph;
- manager/catalog;
- SkillTool adapter;
- executor;
- trust/provenance;
- graceful cycle pruning;
- model-hidden skills;
- optimization overlays that do not mutate base artifacts.

Agent runtime contributes multiple explicit strategies and loop/budget guards. Engine discovery distinguishes explicit selection from default fallback and normalizes provider tool calls.

Its workflow graph provides node/edge validation, cycle detection, topological ordering and parallel execution stages, but Microsoft AF has the stronger durable checkpoint/HITL model.

## elizaOS findings

The pinned TypeScript core is unusually broad. `AgentRuntime` owns one agent-scoped registry/lifecycle and delegates model dispatch, state composition, services and data mutations to dedicated components.

The plugin contract aggregates actions, providers, evaluators, services, models, routes, events and schema/UI contributions. Core deliberately does not dynamically install/import arbitrary package names: a host injects a resolver, and missing resolution fails closed. Dependency sorting/cycle checks happen before registration.

This is the strongest component/plugin model, but it is too broad to become Masanawa's kernel. Its agent-scoped identity/settings/memory assumptions must not replace Character/relationship/domain boundaries.

## Microsoft Agent Framework findings

The workflow system has the strongest orchestration semantics:
- graph builder and validation;
- executor edges including conditional/fan-in/fan-out forms;
- max-iteration convergence guard;
- checkpoint storage abstraction;
- graph-signature compatibility;
- checkpoint lineage rather than relying on iteration number;
- committed state plus executor/edge state;
- pending request-info/HITL state;
- pause/resume and restore;
- middleware around agents/functions;
- OpenTelemetry hooks.

Its Agent Skills implementation also provides progressive disclosure, aggregating/filtering/deduplicating/caching sources, resources/scripts, path/symlink defenses and MCP interop.

Masanawa adapts these semantics into TypeScript/PostgreSQL rather than introducing a second Python runtime as the workflow authority.

## OpenClaw findings

Previously verified strengths remain:
- steering vs queue-steer vs collect/follow-up/interrupt;
- explicit parent/child session lineage;
- concurrency/depth limits;
- sandbox separate from tool policy;
- current-authority revalidation before delayed mutation;
- managed skill revisions, hashes, visibility and session pinning;
- plugin/node idleness before update/restart;
- control-plane tool separation.

Its run queue and session state are not durable business workflow truth.

## Canonical rules

1. Character != Agent runtime object.
2. Skill != plugin package and plugin != workflow.
3. Tools are atomic capabilities; skills compose knowledge/procedure; workflows own durable multi-step state.
4. Agent execution is probabilistic and bounded; consequential commits are deterministic and evidence-bearing.
5. Effective authorization is compiled outside the model and revalidated before delayed mutation.
6. Runtime steering affects future/unstarted execution, not already committed side effects.
7. Workflow checkpoints persist committed state and pending human requests but never freeze authorization forever.
8. Plugin install/resolve is a host/supply-chain concern, not model-controlled runtime behavior.
9. Plugin components register through canonical registries and receive least privilege.
10. Learned/optimized artifacts are candidates until evaluation/certification publishes a new immutable version.

## Phase 0B acceptance fixtures to create later

- repeated identical tool-call loop is bounded;
- budget exhaustion terminates a run with typed reason;
- explicit provider selection never silently falls back;
- invalid/cyclic skill does not erase healthy siblings;
- skill revision pinned to a session does not silently change;
- skill resource path/symlink escape is rejected at use time;
- unresolved plugin package fails closed;
- plugin dependency cycle cannot partially activate;
- service shutdown rejects new admission before draining;
- workflow graph/version mismatch rejects incompatible checkpoint restore;
- checkpoint restore preserves fan-in/edge state and pending human request;
- restored workflow revalidates present authorization before mutation;
- ambiguous side effect reconciles instead of blind retry;
- steering during a run does not duplicate already-started consequential work;
- optimization candidate cannot self-promote to production.
