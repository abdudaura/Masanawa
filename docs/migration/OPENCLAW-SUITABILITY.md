# OpenClaw Suitability — Masanawa Integration Decision

Pinned OpenClaw revision: `83e4755b55e8864e48348f3eb2364ee3e5f0fb54`.

Status: Phase 0A architectural suitability pass complete.

## Conclusion

OpenClaw should **not** be used as the base runtime that Masanawa is built inside.

OpenClaw is a strong primary **design donor** for the Gateway/channel/device operating layer, and a useful **direct library donor** for a small number of published, framework-neutral packages.

Masanawa must keep its own canonical kernel and runtime boundaries.

The target shape is:

```
Masanawa Domain Kernel
  |
  +-- Identity / Relationships / World / Memory / Tasks / Commerce
  |
Masanawa Operating Layer
  |
  +-- Gateway          <- OpenClaw design donor
  +-- Channel adapters <- OpenClaw design donor
  +-- Device nodes     <- OpenClaw design donor
  +-- Agent runtime    <- cross-donor decision
  +-- Skills/tools     <- OpenJarvis + OpenClaw + CWS governance
```

## Why OpenClaw cannot be the canonical base

OpenClaw's multi-agent model explicitly defines an agent as a full per-persona scope containing:
- workspace files/persona rules;
- auth profiles and model registry;
- SQLite-backed session history;
- agent-local state directory;
- channel-account bindings.

That is a valid personal/multi-agent assistant architecture, but Masanawa requires these concerns to remain separate:
- Character identity is canonical/versioned domain truth;
- user-character relationship is a private domain aggregate;
- world/life state is shared domain truth;
- execution workspace is disposable/replaceable runtime state;
- credentials are organization/user/provider-owned;
- conversations are not the character's identity;
- agent strategy is replaceable execution logic;
- tasks/workflows outlive one model/session/runtime.

Directly making OpenClaw the base would make `agent = persona + workspace + auth + session store` the gravitational center of Masanawa and force later subsystems to adapt around it.

## Reuse classes

### R1 — Safe candidate for direct dependency behind a Masanawa adapter

These are published MIT packages with reasonably narrow contracts.

#### `@openclaw/ai`
Public package. Provides model-provider adapters, streaming, normalized model/tool-call types and diagnostics.

Decision:
- evaluate as an implementation dependency for `packages/providers`;
- never expose OpenClaw provider/model types as Masanawa domain contracts;
- wrap behind Masanawa `IntelligenceProvider`;
- compare with Vercel AI SDK/elizaOS/OpenJarvis before final provider ADR.

#### `@openclaw/gateway-protocol`
Public typed TypeBox schemas/validators for OpenClaw Gateway WebSocket protocol.

Decision:
- direct dependency allowed only in an optional **OpenClaw compatibility adapter**;
- do not use it as Masanawa's canonical gateway protocol.

#### `@openclaw/gateway-client`
Public reference client for OpenClaw Gateway protocol.

Decision:
- allowed for interoperability/testing with an OpenClaw instance or OpenClaw-compatible device;
- not the canonical Masanawa client SDK.

These R1 dependencies are optional. Masanawa remains functional without them.

### R2 — Reimplement the behavior/contracts in Masanawa

These areas are architecturally valuable but tightly bound to OpenClaw runtime assumptions.

#### Gateway/control plane
Borrow:
- one long-lived control plane for channel/session/device events;
- authenticated RPC/event protocol;
- readiness/health diagnostics;
- explicit session ownership;
- input durability before ACK;
- reconnect-safe queue state;
- bounded lanes/concurrency;
- stuck/stalled recovery;
- client attribution distinct from human identity.

Implement as Masanawa `services/gateway`, with PostgreSQL-backed canonical routing/session state where durability is required.

Do **not** store canonical Masanawa identity or relationship state in gateway-local SQLite.

#### Channel routing
Borrow:
- channel account registry;
- explicit binding/routing;
- thread/conversation resolution;
- access/allowlist policy;
- dedupe/debounce;
- typing/draft/progress lifecycle;
- target normalization;
- channel-specific rich-message capability discovery.

Implement through `ChannelAdapter` and `ChannelAccountBinding`.

OpenClaw's WhatsApp and Telegram extensions are **not standalone**: they import the OpenClaw plugin host/SDK and expect OpenClaw runtime injection. Reimplement adapters or selectively adapt source under MIT/provenance after the Masanawa ChannelAdapter contract is frozen.

#### Device nodes
Borrow:
- paired device identity;
- capability discovery;
- per-command permission checks;
- camera/location/screen/contact/notification-style device commands;
- presence/heartbeat;
- node selection;
- explicit approvals and device trust.

Implement a Masanawa Node protocol whose authority comes from Masanawa user/device grants.

Do not make an OpenClaw node's local agent state authoritative for Character identity, memories, tasks or permissions.

#### Queue/steering
Borrow:
- steer/followup/collect/interrupt semantics;
- user input persisted before Gateway ACK;
- one active run per session lane;
- background work on separate bounded lanes;
- queued-turn ownership/cancellation;
- same-sender route-aware recovery;
- stale/stuck detection with recovery budgets.

Implement in Masanawa RuntimeSession/TaskSupervisor. Durable task/workflow work remains in `packages/workflows`, not an in-memory agent queue.

#### Tool/sandbox policy
Borrow OpenClaw's useful separation:
1. sandbox decides **where** code runs;
2. tool policy decides **which** tools are callable;
3. elevation controls a narrowly defined execution escape.

Masanawa must add:
- workflow authorization;
- side-effect/risk classes;
- payment/destructive approval;
- idempotency/reconciliation;
- tenant/user/character scope.

Deny wins. An LLM/session command cannot override deterministic policy.

#### Skills distribution
Borrow:
- scoped skill roots;
- deterministic precedence;
- allowlists;
- install/update/verify;
- trust/provenance;
- managed/community distribution;
- invalid-skill isolation.

Merge with OpenJarvis's SkillManager/parser/dependency/SkillTool design and CWS Skill Contract v2 governance.

#### Plugin model
Borrow registration/lifecycle concepts only.

Do not adopt OpenClaw's private `@openclaw/plugin-sdk` as Masanawa's canonical plugin SDK. It exposes a very large OpenClaw-specific surface and would couple Masanawa extensions to OpenClaw runtime internals.

#### Agent core
`@openclaw/agent-core` is private/internal. It has useful queue modes, before/after tool hooks, tool-loop intervention, compaction and streaming semantics.

Decision:
- mine behavior;
- compare against OpenJarvis/elizaOS/Microsoft Agent Framework;
- do not import as the Masanawa AgentRuntime before the cross-donor agent decision.

#### Memory host
OpenClaw's memory host and memory plugins contain valuable maintenance/retrieval patterns.

Decision:
- behavior donor only;
- do not inherit Markdown/file/agent-local storage or SQLite as canonical state;
- merge useful behavior with CWS scopes + N.E.K.O cognition + Letta + Mem0.

### R3 — Reject from the Masanawa kernel

The following OpenClaw assumptions must not enter core domain design:

- `Agent == persona/identity`;
- workspace files as canonical Character truth;
- agent-local auth as Character identity state;
- SQLite session DB as canonical relationship memory;
- channel binding directly to an agent execution object rather than canonical Character/route identity;
- plugin-owned global stores without mandatory tenant/user/character scope;
- model/session command as authorization for consequential actions;
- filesystem/default cwd as security boundary;
- in-memory run queue as durable task/workflow truth;
- Markdown memory as authoritative platform memory;
- provider-specific model registry as domain state;
- personal-assistant "main agent" fallback credentials as cross-character credential policy.

## Published-package finding

The OpenClaw repository is increasingly modular, but not every workspace package is a stable external API.

Observed:
- public/published: `@openclaw/ai`, `@openclaw/gateway-protocol`, `@openclaw/gateway-client`;
- internal/private at pinned revision: `@openclaw/agent-core`, `@openclaw/plugin-sdk`, `@openclaw/memory-host-sdk`, `@openclaw/net-policy`, `@openclaw/retry`, `@openclaw/normalization-core`, `@openclaw/sdk`, several model/LLM internals;
- WhatsApp extension is publishable but peers against an OpenClaw host and imports OpenClaw plugin-host contracts;
- Telegram extension is private and also host-SDK-coupled.

"MIT source available" does not mean "stable direct dependency." Internal packages are patterns/source donors unless explicitly adopted by an ADR.

## Gateway compatibility strategy

If interoperability with OpenClaw becomes valuable, implement it at the edge:

```
OpenClaw node/client
      |
@openclaw/gateway-protocol/client
      |
Masanawa OpenClawCompatibilityAdapter
      |
Masanawa Gateway contracts
      |
Canonical Masanawa runtime
```

Do not make the compatibility protocol the internal Masanawa protocol.

## Masanawa concepts replacing OpenClaw concepts

| OpenClaw | Masanawa |
|---|---|
| Agent | Character + AgentExecution |
| agentDir | ExecutionWorkspace / provider credential refs |
| Workspace persona files | Character Constitution projection |
| Session store | Conversation + RuntimeSession |
| Channel binding -> Agent | Channel binding -> Character/Route |
| Memory files | Scoped Memory Service |
| Cron | Proactivity + durable Workflow |
| Tool policy | Capability/Tool policy + workflow authorization |
| Skill | SkillContract/SkillVersion |
| Plugin | PluginManifest registering canonical components |
| Node | DeviceNode with explicit grants |
| Agent queue | Runtime input queue + durable Task/Workflow |

## Direct-reuse admission rule

Before adding any OpenClaw npm dependency to a Masanawa production package, require:
1. package is public/published or intentionally vendored under provenance;
2. contract is narrower than the Masanawa subsystem boundary;
3. Masanawa adapter prevents OpenClaw types becoming domain types;
4. no OpenClaw state store becomes authoritative;
5. dependency can be removed without data migration;
6. license/third-party notices are recorded;
7. contract tests cover fallback/replacement.

## Result

OpenClaw is now the **primary design donor for Gateway/channels/device nodes**.

It is **not Masanawa's base layer**.

Masanawa's base remains its own canonical domain kernel and contracts.
