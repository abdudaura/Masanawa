# Source Map — OpenClaw

Pinned: `83e4755b55e8864e48348f3eb2364ee3e5f0fb54`.

Status: Phase 0A suitability/deep architecture pass complete for Gateway/channel/device/runtime boundary. Memory/skills details remain inputs to later cross-donor comparisons.

## Scale

The pinned tree contains roughly 51,000 files and is much broader than a skill repository.

Observed major areas:
- TypeScript Gateway/runtime;
- `packages/*` reusable/internal libraries;
- hundreds of `extensions/*` providers/channels/tools;
- Android/iOS/macOS/Linux device-node applications;
- channel-specific QA/E2E infrastructure;
- skills and custodian skills;
- memory-core/LanceDB/wiki/active-memory extensions;
- browser/computer-use/device integrations;
- control UI/CLI/diagnostics/security.

## Core product model

OpenClaw's isolation unit is an **agent**.

The multi-agent documentation defines one agent as a combined scope containing:
- workspace/persona files;
- state directory;
- auth profiles;
- model registry;
- SQLite-backed session history;
- skill visibility;
- channel-account bindings.

This is intentionally **not** Masanawa's canonical domain model.

Masanawa separates:
- Character identity/Constitution;
- user-character relationship;
- world/life truth;
- Conversation and RuntimeSession;
- ExecutionWorkspace;
- provider credentials;
- AgentStrategy;
- durable Task/Workflow.

## Gateway/control-plane findings

OpenClaw has a mature unified Gateway pattern.

Important behavior to adapt:
- one control plane for channel/session/device/tool events;
- explicit routing/bindings;
- authenticated RPC/event protocol;
- client attribution is not human identity;
- user input is durably stored before Gateway acknowledgement;
- one active run per session lane;
- separate bounded lanes for background/subagent work;
- steer/followup/collect/interrupt input modes;
- queue cancellation ownership;
- dedupe/retry interaction between durable channel ingress and agent adoption;
- diagnostics distinguish long-running, stalled and stuck;
- recovery budgets prevent repeated retries/transport bytes from hiding semantic stagnation;
- same-route/same-sender continuation may recover a stalled turn without repeating completed actions.

Masanawa should reimplement these semantics against canonical RuntimeSession/Task/Workflow state.

## Channel architecture

The channel system includes:
- account resolution/configuration;
- channel/target registries;
- access control and allowlists;
- thread/conversation resolution;
- inbound dedupe/debounce;
- typing/draft/progress lifecycles;
- location/media/rich-message normalization;
- channel plugin contracts;
- channel-specific QA/E2E suites.

WhatsApp and Telegram illustrate why the extensions cannot simply become standalone Masanawa adapters:
- they import OpenClaw plugin-host contracts;
- runtime is injected by the OpenClaw host;
- WhatsApp peers against an OpenClaw version;
- Telegram depends on the private OpenClaw plugin SDK.

Decision: reimplement/adapt behavior behind Masanawa `ChannelAdapter`, not load these plugins as canonical runtime components.

## Device nodes

OpenClaw provides a strong reference for Masanawa device nodes.

Observed device concepts:
- device identity/auth store;
- pairing/approval;
- node presence/heartbeat;
- capability/permission snapshot;
- camera;
- location with disclosure/coarsening;
- contacts/calendar;
- notifications;
- photos;
- SMS/call-log/mobile UI on supported builds;
- native device settings;
- node selection and invocation.

Decision: primary design donor for `DeviceNode`, but Masanawa grants/identity are canonical.

## Security/tool policy

A useful OpenClaw separation:
1. sandbox = **where** execution occurs;
2. tool policy = **what** is callable;
3. elevation = narrowly scoped exec escape.

Verified policy behaviors:
- deny wins;
- a non-empty allowlist closes everything else;
- tool policy cannot be bypassed by session exec settings;
- required sandbox roles fail closed if a sandbox cannot be provisioned;
- elevation cannot escape creator/operator-required sandbox;
- path/bind validation accounts for symlink ancestors;
- workspace cwd alone is explicitly not considered a hard sandbox.

Masanawa should adapt this model and add domain authorization, risk, approval, idempotency and reconciliation.

## Skills

OpenClaw contributes:
- workspace/shared skill roots;
- deterministic precedence;
- per-agent allowlists;
- install/update/verify;
- managed/workshop/community distribution;
- provenance/trust;
- invalid-skill isolation;
- sandbox/workspace synchronization.

This remains a comparison input against OpenJarvis. CWS governance remains mandatory.

## Agent execution

OpenClaw's internal `@openclaw/agent-core` has useful patterns:
- sequential/parallel tool execution;
- before/after tool hooks;
- batch admission;
- tool-loop intervention;
- deferred authorized tools;
- queue steering modes;
- compaction summaries;
- interruption/recovery semantics.

It is private/internal at the pinned revision.

Decision: behavior donor only pending comparison with OpenJarvis, elizaOS and Microsoft Agent Framework.

## Memory

OpenClaw contributes useful operational patterns:
- memory search;
- action-sensitive memory;
- compaction-time flush;
- dreaming/consolidation;
- pluggable memory engines;
- memory-wiki/provenance.

Do not adopt its agent-local Markdown/SQLite storage model as canonical Masanawa memory.

## Package reuse findings

### Public direct-dependency candidates

#### `@openclaw/ai`
Published MIT package for provider adapters/streaming/model normalization.

Possible Masanawa use:
- implementation dependency behind `IntelligenceProvider`;
- OpenClaw types cannot escape the adapter.

#### `@openclaw/gateway-protocol`
Published typed Gateway protocol schemas.

Use only for optional OpenClaw compatibility.

#### `@openclaw/gateway-client`
Published Gateway reference client.

Use only for compatibility/testing with OpenClaw nodes/instances.

### Internal/private — do not treat as stable dependencies

At the pinned revision:
- `@openclaw/agent-core`;
- `@openclaw/plugin-sdk`;
- `@openclaw/memory-host-sdk`;
- `@openclaw/net-policy`;
- `@openclaw/retry`;
- `@openclaw/normalization-core`;
- `@openclaw/sdk`;
- several model/runtime packages.

MIT source may be studied/adapted with provenance, but these private workspace APIs are not a stable Masanawa dependency surface.

## Explicit rejection from Masanawa kernel

Do not inherit:
- Agent == Character/persona;
- workspace persona files as canonical identity;
- auth profiles inside Character truth;
- SQLite session DB as relationship-memory authority;
- plugin-global storage without tenant/user/character scoping;
- channel binding directly to replaceable AgentStrategy;
- filesystem cwd as security boundary;
- in-memory run queue as durable Task/Workflow truth;
- model/session commands as consequential authorization;
- "main agent" credential fallback as cross-character credential policy.

## Decision

ADR-0004 records the result:

**OpenClaw is the primary design donor for Gateway/channels/device nodes, not the Masanawa base runtime.**

See `docs/migration/OPENCLAW-SUITABILITY.md` for the full reuse/reimplement/reject matrix.

## Remaining OpenClaw work

Later cross-donor passes still need to compare:
- OpenClaw skills against OpenJarvis;
- OpenClaw memory maintenance against N.E.K.O/Letta/Mem0;
- OpenClaw AgentCore against OpenJarvis/elizaOS/Microsoft Agent Framework;
- OpenClaw plugin contracts against elizaOS/N.E.K.O.

The base-layer question itself is closed unless new evidence supersedes ADR-0004.
