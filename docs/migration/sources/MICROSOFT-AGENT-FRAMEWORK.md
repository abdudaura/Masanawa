# Source Map — Microsoft Agent Framework

Pinned revision: `e15c6dce2d10196a61c851a56ef3d839ff3c3ea7` (`main`).

Status: Phase 0B exhaustive descendant-family coverage **COMPLETE** at the pinned revision. See:
- `docs/migration/coverage/MICROSOFT-AGENT-FRAMEWORK.md`;
- `docs/migration/coverage/MICROSOFT-AGENT-FRAMEWORK-INVENTORY.md`.

## Executive result

Microsoft Agent Framework is Masanawa's primary durable workflow/orchestration donor, not Masanawa's runtime kernel.

Selected strengths:
- immutable graph construction and validation;
- conditional, fan-out, fan-in and switch routing;
- durable checkpoint lineage and restore compatibility;
- checkpointed pending HITL/external requests;
- handoff/group-chat/Magentic/sequential/concurrent orchestration patterns;
- exact argument-bound tool approvals;
- middleware/interceptor seams;
- progressive-disclosure Agent Skills safety;
- A2A and MCP adapter boundaries;
- declarative workflow authoring;
- OpenTelemetry workflow/agent/tool instrumentation;
- durable checkpoint backend/concurrency patterns.

## Canonical Masanawa boundary

Masanawa implements one TypeScript/PostgreSQL workflow engine in `packages/workflows`.

The donor's Python and .NET implementations are evidence surfaces only:
- no Python/.NET object is canonical workflow state;
- no provider thread/session is Character identity;
- no donor memory/vector store replaces `packages/memory`;
- no protocol session key authorizes itself;
- no donor storage backend changes canonical ownership.

## Strong invariants retained

- workflow publication validates graph shape/types/connectivity;
- restore requires workflow-version/graph compatibility;
- checkpoint lineage is explicit and not inferred from iteration count;
- fan-in partial state and pending external requests survive restart;
- non-converging loops are bounded;
- cancellation does not pretend already-started side effects were rolled back;
- approval binds to exact immutable prepared tool arguments;
- changed arguments invalidate approval;
- handoff targets are explicit workflow participants;
- manager-selected participants are validated;
- orchestration round/stall/reset budgets are bounded;
- skill resources/scripts revalidate path/symlink safety at use time;
- A2A/MCP adapters do not collapse HITL into false success;
- sensitive telemetry content is opt-in;
- canonical checkpoints use explicit versioned schemas rather than Python pickle.

## Repository closure

Pinned maintained Python workspace packages mapped: **40 / 40**.

Pinned .NET source projects mapped: **35 / 35**.

Pinned .NET test projects recognized: **48**.

Experimental Python lab is explicitly reference-only unless separately adopted.

Unresolved meaningful production families: **0**.

Unresolved canonical-authority conflicts: **0**.

See ADR-0008 and `docs/migration/RUNTIME-SKILLS-WORKFLOW-ADOPTION-BOUNDARY.md` for the cross-donor workflow/runtime decision.
