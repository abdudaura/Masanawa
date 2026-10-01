# ADR-0004: OpenClaw Adoption Boundary

Status: accepted for Phase 0A architecture selection
Date: 2026-10-01

## Decision

OpenClaw is **not** the base/kernel of Masanawa.

OpenClaw is adopted as the primary architectural donor for:

- Gateway/control-plane topology;
- channel plugin lifecycle and routing;
- account/conversation binding semantics;
- device/node pairing and remote capability publication;
- runtime steering/queue semantics;
- local-first operator tooling;
- selected approval/current-authority patterns;
- skill distribution/revision/visibility patterns.

Masanawa keeps its own canonical kernel for:

- Character identity and Constitution;
- platform user identity and tenant isolation;
- user-character relationships;
- memory and privacy scopes;
- world/life state;
- skills governance/certification;
- durable workflows and tasks;
- approvals as business-domain evidence;
- financial/social/studio truth;
- provider readiness and audit.

## Why OpenClaw is not the kernel

OpenClaw's documented security model assumes **one trust boundary per Gateway**. Its multi-user mode is designed for trusted collaborators, and explicitly states that session ownership/visibility are usability features rather than security boundaries.

Relevant defaults/semantics also conflict with Masanawa's public multi-user platform requirements:

- session-tool visibility can default to all sessions on a Gateway;
- cross-agent access is enabled by default unless narrowed;
- message tools can cross providers/conversations unless configured otherwise;
- agent bindings select a destination after channel admission and are not access control;
- agent workspace/session state is central to the product model;
- memory uses OpenClaw-specific local/SQLite/file-backed semantics;
- one operator/admin boundary can control the whole Gateway.

Masanawa must assume untrusted end users can share infrastructure while remaining isolated by tenant, user, character, relationship and task boundaries.

## Adoption model

### 1. Masanawa-native control plane

Masanawa implements its own:

- `GatewayIngress`;
- `ChannelAdapter`;
- `ChannelAccountBinding`;
- `DeviceNode`;
- `RuntimeSession`;
- `ExecutionWorkspace`;
- `ApprovalService`;
- `ToolAuthority`;
- `SkillRegistry`.

These contracts may borrow OpenClaw behavior, but their authorization and persistence are Masanawa-owned.

### 2. Optional OpenClaw bridge

A separately operated OpenClaw Gateway MAY be supported as an integration bridge when its existing channels/device ecosystem saves substantial implementation work.

If used:

```
Channel / Device
      |
OpenClaw bridge
      |
Masanawa OpenClawAdapter
      |
Masanawa Gateway
      |
canonical user / character / policy / runtime
```

Rules:

- the bridge is never the canonical user/character/session/memory store;
- Masanawa re-authenticates/re-authorizes every normalized inbound action;
- one bridge maps to one explicitly declared trust/organization boundary;
- OpenClaw session IDs/node IDs/account IDs are external identifiers only;
- consequential actions are revalidated by Masanawa before execution;
- bridge failure cannot corrupt canonical workflow or financial state.

### 3. Conditional direct package reuse

At the pinned revision, the most clearly reusable published packages are:

- `@openclaw/gateway-protocol`
- `@openclaw/gateway-client`

These MAY be dependencies only inside an OpenClaw compatibility/bridge adapter.

They MUST NOT become Masanawa's canonical public Gateway protocol merely because they are reusable packages.

Most other attractive OpenClaw packages are private workspace packages, including agent core, plugin SDK, memory host SDK and generic utility packages. Masanawa should adapt the behavior/source under MIT provenance rather than make private OpenClaw workspace internals a hidden build dependency.

## Behaviors to adopt

### Channel framework

Adopt:

- channel admission before routing;
- normalized account/peer/thread facts;
- deterministic binding specificity;
- binding errors instead of silent wrong-agent fallback;
- mention/group/DM access gates;
- inbound debounce/deduplication;
- normalized media and rich channel data;
- durable outbound delivery orchestration;
- channel health/readiness and operator controls.

Change:

- routing target is a Masanawa Character/runtime destination, not OpenClaw Agent identity;
- platform user resolution happens before relationship/private context compilation.

### Device/node model

Adopt:

- short-lived pairing bootstrap credential;
- durable device identity;
- scoped token rotation/revocation;
- operator approval;
- command/capability advertisement;
- offline pending work;
- node-local execution policy;
- explicit command allow/deny surface;
- device/node health/readiness.

Important reliability rule:

A setup credential can be consumed while delivery of the resulting credentials is uncertain. That state must be reconciled explicitly; it must not be reported as success or retried as if nothing happened.

Node invokes may retry a specific pre-execution "not ready" rejection while still inside the original deadline, but failures after progress or ambiguous execution must not be blindly retried.

### Current-authority revalidation

Adopt OpenClaw's distinction between:

- authority captured at admission;
- current authority rechecked immediately before a delayed mutation.

A boolean "was owner" snapshot is insufficient after async preparation.

Masanawa applies this more broadly to:

- operator mutations;
- approvals;
- credential actions;
- financial actions;
- device execution;
- high-impact tools.

### Skills

Adopt:

- deterministic multi-source precedence;
- per-character/per-runtime/shared visibility;
- invalid sibling isolation;
- environment/config/binary eligibility gates;
- immutable managed revisions;
- content-derived revision hashes;
- optimistic conflict detection on stale edits;
- session/version pinning;
- explicit refresh/upgrade;
- sandbox materialization rather than host-path leakage;
- managed/workshop/community source provenance.

Do not adopt Markdown instructions as the complete Masanawa production skill contract. They are one import/authoring format that compiles into Masanawa SkillContract + SkillVersion + certification/readiness.

### Runtime steering

Adopt explicit distinctions between:

- steer current active run;
- queue follow-up;
- collect/batch;
- interrupt/cancel.

Steering is guidance at a safe runtime boundary, not retroactive cancellation of already-started side effects.

### Memory maintenance

Adopt:

- recall tools as a bounded capability subset;
- recall authority clamped by the parent turn's final tool policy;
- memory failure as fail-soft for ordinary conversation;
- pre-compaction persistence;
- action-sensitive memory metadata;
- consolidation/dreaming concepts.

Do not adopt OpenClaw memory storage or infer that agent workspace memory equals character memory.

## Behaviors explicitly rejected as Masanawa defaults

- one trust boundary per public Gateway;
- cross-agent session visibility enabled broadly by default;
- cross-provider messaging broadly enabled by default;
- session ownership as a privacy/security boundary;
- channel pairing identity as canonical platform user identity;
- agent workspace as Character identity;
- local filesystem/SQLite/Markdown as canonical platform memory;
- skills as prompt files without Masanawa governance/certification;
- cron jobs as the canonical durable business workflow engine;
- Gateway administrator authority as a substitute for tenant-scoped Masanawa RBAC.

Masanawa should default to least privilege across user, character, relationship, task, tool, provider and tenant scopes.

## Licensing

OpenClaw is MIT at the pinned revision. Direct source adaptation is permitted subject to preserving required copyright/license notices and any applicable third-party notices.

Every direct adaptation must be recorded in the provenance ledger.

## Consequences

OpenClaw can strongly accelerate Masanawa without dictating its domain model.

Future Gateway work should first define Masanawa-native contracts, then choose per feature among:

1. direct use of an independently published OpenClaw package inside an adapter;
2. isolated OpenClaw bridge integration;
3. MIT-attributed adaptation/reimplementation;
4. concept-only independent implementation.

No OpenClaw integration may create a second source of identity, memory, workflow, approval, financial or world truth.
