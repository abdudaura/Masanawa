# OpenClaw Adoption Boundary — Phase 0A Deep Pass

Pinned source: `openclaw/openclaw@83e4755b55e8864e48348f3eb2364ee3e5f0fb54`

Decision: see `docs/adr/0004-openclaw-adoption-boundary.md`.

## Executive finding

OpenClaw is one of the strongest donors in the expanded landscape, but it should be used as an **operating-layer donor**, not as Masanawa's kernel.

Its strongest contributions are the Gateway/channel/node/control-plane ecosystem, runtime steering, operational skill distribution, tool/sandbox policy and local-first device integration.

Its biggest mismatch is security/domain ownership: OpenClaw documents one trust domain per Gateway and explicitly says its multi-user ownership/visibility model is not a hostile multi-tenant isolation boundary.

## What can be reused directly

### Conditional public packages

`@openclaw/gateway-protocol`
- typed TypeBox schemas/validators for OpenClaw's WebSocket protocol;
- suitable only for an OpenClaw bridge/client adapter.

`@openclaw/gateway-client`
- reference WebSocket client over the protocol;
- suitable for a Masanawa `OpenClawBridgeAdapter`.

Do not make these Masanawa's canonical public API/protocol.

### Private workspace packages

Useful source exists in private packages such as:
- `agent-core`;
- `plugin-sdk`;
- `memory-host-sdk`;
- `net-policy`;
- `normalization-core`;
- `retry`;
- `llm-core`;
- `media-core`;
- `tool-call-repair`;
- `model-catalog-core`.

Because these are private workspace packages at the pinned revision, direct npm dependency is not a stable integration strategy. Treat them as MIT source donors unless OpenClaw later publishes a stable supported package.

## Gateway/channel findings

OpenClaw's channel framework covers:
- channel setup/onboarding/catalog;
- DM pairing/allowlists;
- group/mention gating;
- media normalization;
- outbound delivery;
- conversation/thread routing;
- agent binding precedence;
- account startup and lifecycle;
- status/health/operator controls;
- streaming/typing/status UX.

Agent bindings are explicitly **routing only**. They do not admit the sender or grant permission.

Masanawa should preserve this separation:

```
Channel authentication/admission
       ↓
Platform user resolution
       ↓
Tenant/user policy
       ↓
Character/channel binding
       ↓
relationship scope
       ↓
runtime
```

## Security mismatch

OpenClaw states:
- one trust boundary per Gateway;
- several trusted people may operate one agent;
- session ownership/visibility is not a security boundary;
- users needing isolation should use separate agents/gateways/hosts.

This is incompatible with Masanawa's public multi-user platform boundary.

OpenClaw session tools also support broad visibility and agent-to-agent access unless narrowed. Masanawa must reverse this default: access is denied unless the canonical subject/tenant/relationship/task policy explicitly permits it.

## Device/node findings

OpenClaw has a mature device/node lifecycle:

- device setup codes with short-lived bootstrap credentials;
- approve/reject/remove;
- token rotate/revoke;
- node pair/list/describe/invoke;
- command advertisement;
- durable pending offline work;
- node-local tool publication;
- node-local execution approvals.

Particularly valuable reliability behavior:

1. Pairing delivery has an explicit `deliveryUncertain` outcome if credentials may have been consumed but response delivery could not be proven.
2. Clients reconcile by setup ID before treating the code as merely expired.
3. Node invoke retries only a narrow pre-execution `NODE_NOT_READY` rejection.
4. General unavailability, disconnect, timeout, post-progress failure or ambiguous execution does not receive blind replay.

Masanawa should adopt these semantics for all remote-device consequential execution.

## Approval findings

OpenClaw's approval registry has useful semantics:
- typed approval kinds;
- durable pending/terminal projections;
- retained history;
- first-answer-wins resolution;
- waiting callers settle from canonical recorded outcome;
- authority captured for admitted work;
- authority can be revoked before commit, preventing a verdict;
- disconnect alone does not cancel admitted work.

Masanawa should use the same principles, while its approval records remain canonical workflow/security domain objects.

## Skill findings

OpenClaw's skills system is operationally mature.

Useful behaviors:
- deterministic source precedence;
- workspace/project/personal/managed/workshop/bundled/plugin scopes;
- per-agent allowlists independent from source precedence;
- invalid skill isolation;
- environment/config/binary gating;
- node-hosted dynamic skills;
- sandbox synchronization;
- immutable managed revisions;
- revision hash includes support files and executable bits;
- identical save is a no-op;
- stale edit conflicts instead of overwriting;
- sessions retain selected skill IDs/revisions;
- published changes do not silently mutate an existing session;
- explicit sharing/ownership;
- bounded bundle/upload sizes.

Masanawa should keep OpenJarvis as the likely structural runtime donor for SkillManager/dependencies/executor/SkillTool while adopting OpenClaw's operational distribution/revision/session-pinning model and CWS governance/certification.

## Tool/plugin findings

OpenClaw Plugin SDK patterns worth adopting:
- typed registration of tools/commands/node commands;
- managed operation ownership/cancellation;
- node-host commands advertise capability only while connected;
- explicit idle/active-work signal before update/restart;
- authorization is not inferred from presentation metadata;
- current authority can be rechecked after async preparation before mutation;
- plugin/provider-specific prompt guidance is scoped by runtime surface.

Masanawa should compare the final plugin shape with elizaOS and N.E.K.O before freezing it.

## Session/subagent findings

Useful:
- separate native subagent and external harness sessions;
- explicit parent/child lineage;
- session/thread binding;
- child concurrency/depth budgets;
- attachment limits;
- attachment staging outside child workspace;
- read-only projection for sandboxed children;
- transcript redaction for inline attachments;
- explicit cleanup/retention;
- per-subagent tool policy;
- push-based completion/announce;
- recovery/stop/cascade semantics.

Reject as a public security model:
- broad `all` session visibility;
- cross-agent enabled by default;
- same-agent visibility potentially containing multiple users.

## Runtime steering

OpenClaw distinguishes:
- explicit `steer`;
- queue-steer;
- collect;
- followup;
- interrupt.

Steering is delivered at a supported runtime boundary. If the runtime cannot accept it, OpenClaw may turn it into a normal follow-up prompt rather than dropping it.

Masanawa should preserve the vocabulary but ensure already-started consequential side effects are not implicitly cancelled/replayed by steering.

## Memory findings

Active Memory has a good capability rule:
- configured memory tools are filtered through the parent turn's finalized effective tool policy;
- explicit denies/provider/agent/sandbox restrictions still apply;
- recall does not outlive parent authority;
- if no recall tool is allowed or recall fails, the main reply continues.

This is a strong Masanawa invariant.

Other OpenClaw memory ideas remain secondary donor candidates:
- compaction flush;
- action-sensitive memories;
- consolidation/dreaming;
- pluggable engines;
- provenance-rich memory wiki.

Storage remains a mismatch and will not be adopted as canonical truth.

## Resulting reuse categories

### Use/adapt aggressively
- channel framework behavior;
- device/node lifecycle;
- pairing/token semantics;
- current-authority checks;
- approval reliability;
- runtime steering;
- managed skill revision/distribution semantics;
- tool/sandbox policy concepts;
- operator readiness/status patterns.

### Conditional direct dependency
- `@openclaw/gateway-protocol`;
- `@openclaw/gateway-client`;
only inside an OpenClaw compatibility bridge.

### Reimplement in Masanawa contracts
- Gateway ingress;
- authorization/RBAC;
- channel bindings;
- device registry;
- approval registry;
- skill registry;
- tool authority;
- execution workspace;
- runtime session;
- durable scheduling/workflows.

### Explicitly reject
- OpenClaw as Masanawa base repository;
- one-trust-domain Gateway as public perimeter;
- session ownership as security;
- broad cross-session/cross-agent defaults;
- OpenClaw local state as platform truth;
- Agent identity as Character identity.

## Next comparison impact

OpenClaw no longer needs to compete to become Masanawa's kernel.

Remaining comparisons should focus on:
- OpenClaw vs OpenJarvis/elizaOS/MAF for execution/plugin pieces;
- OpenClaw memory ideas vs N.E.K.O/Letta/Mem0;
- OpenClaw nodes vs AIRI/elizaOS device/embodiment;
- OpenClaw channel bridge vs native Masanawa adapters.
