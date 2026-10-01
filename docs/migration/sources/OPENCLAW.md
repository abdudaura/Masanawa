# Source Map — OpenClaw

Pinned revision: `83e4755b55e8864e48348f3eb2364ee3e5f0fb54`.

Status: Phase 0A deep pass complete for Gateway/channels/devices/security/skills/session-steering/memory-policy; plugin internals and long-tail channel specifics remain secondary follow-up.

Decision: `docs/adr/0004-openclaw-adoption-boundary.md`.

## Executive result

OpenClaw is a major **operating-layer donor**, not Masanawa's base/kernel.

Primary donor areas:
- Gateway/control-plane topology;
- channel framework and account/conversation routing;
- device/node pairing and capability publication;
- runtime steering/queue semantics;
- skill distribution/revision/visibility;
- local-first operator tooling;
- selected approval/current-authority patterns.

Explicit non-owner areas:
- canonical Character identity;
- tenant/user isolation;
- relationship memory;
- world state;
- durable business workflows;
- commerce/social/studio truth.

## Repository scale and package shape

The pinned repository contains roughly 51k files and is a large multi-platform monorepo with:
- TypeScript/Node core;
- Android/iOS/macOS/Linux/Windows companion surfaces;
- channel extensions;
- device/node runtimes;
- plugin SDK;
- Gateway protocol/client packages;
- browser/computer-use integration;
- skills and custodian skills;
- extensive security/QA infrastructure.

Notable package split:
- public: `@openclaw/gateway-protocol`, `@openclaw/gateway-client`;
- private workspace packages: `agent-core`, `plugin-sdk`, `memory-host-sdk`, `net-policy`, `normalization-core`, `retry`, `llm-core`, `media-core`, `model-catalog-core`, `tool-call-repair`, etc.

This means direct reuse is cleanest only for the public protocol/client packages and only inside an OpenClaw bridge adapter. Most other adoption should be behavior/source adaptation under MIT provenance.

## Gateway/channel architecture

OpenClaw's channel framework includes:
- setup/onboarding/catalog;
- DM pairing and allowlists;
- group policy and mention gating;
- media normalization;
- outbound delivery;
- account lifecycle;
- conversation/thread routing;
- bindings;
- streaming/typing/status;
- health/readiness/operator controls.

Important rule: **bindings are routing, not authorization**. They run only after normal channel admission. Masanawa must keep this separation and insert canonical platform-user resolution before Character/relationship routing.

OpenClaw binding specificity is useful:
- concrete conversation/group-space match;
- account match;
- channel fallback;
- deterministic precedence;
- no silent fallback to an unknown bound agent.

Masanawa adapts this to Character/runtime destinations rather than Agent identity.

## Security boundary mismatch

OpenClaw explicitly documents one trust boundary per Gateway.

Its multi-user mode supports trusted collaborators and says ownership/visibility are usability features rather than hostile security isolation.

Important conflicting defaults:
- session visibility may be `all`;
- cross-agent access is enabled by default unless narrowed;
- cross-provider/cross-conversation messaging can be enabled broadly.

Masanawa therefore must NOT use an OpenClaw Gateway directly as the public multi-tenant authorization boundary.

If OpenClaw is run as a bridge:
- one bridge belongs to one explicit trust/organization boundary;
- Masanawa re-authenticates/re-authorizes normalized input;
- OpenClaw IDs are external references only;
- canonical user/Character/session/memory/task truth stays in Masanawa.

## Device/node lifecycle

OpenClaw has mature remote-device semantics:
- short-lived setup/bootstrap credentials;
- operator approval;
- device identity;
- scoped token rotation/revocation;
- node pairing/list/describe/invoke;
- command capability publication;
- node-local exec approvals;
- durable pending work for offline nodes;
- dynamic plugin/MCP tool publication.

Reliability details to preserve:
- consumed setup bearer + uncertain credential delivery becomes `deliveryUncertain`, not success;
- clients reconcile setup status before assuming expiry;
- outcomes survive beyond bootstrap credential expiry;
- node invoke retries only a narrow pre-execution `NODE_NOT_READY`;
- failures after progress/disconnect/timeout/ambiguous execution are not blindly retried;
- each retry rechecks connection, pairing and command authorization.

## Durable approvals/current authority

Approval system includes:
- typed pending/terminal records;
- retained history;
- first-answer-wins canonical result;
- waiters settle from the recorded result;
- disconnect does not cancel already admitted work;
- revocation before commit admission prevents mutation;
- committed verdict remains authoritative.

Plugin commands expose a particularly useful pattern:
- capture admission authority;
- after async preparation, call a current-authority assertion before mutation;
- a stale boolean owner snapshot is not enough.

Masanawa should generalize this to operator, credential, device, approval and financial mutations.

## Skills

OpenClaw skills provide an operational layer beyond simple Markdown loading:
- deterministic multi-root precedence;
- workspace/project/personal/managed/workshop/bundled/plugin scopes;
- per-agent allowlists separate from source precedence;
- invalid skill isolation;
- environment/config/binary eligibility;
- node-hosted dynamic skills;
- sandbox synchronization/materialization;
- managed immutable revisions;
- content-derived revision hash including support files and executable bits;
- identical saves are no-ops;
- stale edits conflict instead of overwrite;
- sessions pin selected skill IDs/revisions;
- publishing a new revision does not silently mutate existing sessions;
- explicit team sharing/ownership;
- bounded bundle/upload limits;
- workshop/community distribution.

Masanawa adaptation:
- OpenJarvis remains the likely structural donor for SkillManager/dependency graph/execution/SkillTool;
- OpenClaw contributes distribution, revisioning, visibility, session pinning and operator lifecycle;
- ChatWithStars contributes certification/readiness/risk/approvals/pricing/idempotency/expertise;
- Markdown/agentskills-style content is an import/authoring format, not the entire production SkillContract.

## Session/subagent execution

Useful patterns:
- explicit parent/child session lineage;
- native subagents vs external harness sessions;
- thread/conversation bindings;
- concurrency/depth limits;
- bounded attachments;
- Gateway-owned staging;
- read-only projection into sandboxes;
- transcript redaction of attachment payloads;
- cleanup/retention policy;
- per-subagent tool restrictions;
- push-based completion/announce;
- recovery/cascade stop semantics.

Security caveat: same-agent/session visibility can span multiple users and is not sufficient for Masanawa privacy isolation.

## Runtime steering

OpenClaw distinguishes:
- steer;
- queue-steer;
- collect;
- follow-up;
- interrupt.

Steering targets the current active run at a supported boundary. If unsupported/idle, it can become a normal follow-up prompt instead of disappearing.

Masanawa must preserve the semantic distinction but never interpret steering as permission to undo/replay already-started consequential side effects.

## Tool/plugin policy

Important patterns:
- control-plane tools separated from ordinary tools;
- node command allow/deny surfaces;
- per-agent tool profiles;
- sandboxing separate from tool policy;
- current-authority validation;
- managed operation ownership and cancellation;
- node-host capabilities visible only while node is connected;
- plugin/node work must report idleness before update/restart;
- presentation metadata does not confer authorization.

OpenClaw's plugin architecture remains a candidate to compare with elizaOS and N.E.K.O before final plugin freeze.

## Memory

Useful active-memory behavior:
- recall tools are a configured subset;
- subset is filtered through parent turn's finalized effective tool policy;
- explicit denies/provider/agent/sandbox limits still apply;
- recall authority expires with parent turn authority;
- if recall tools are unavailable or fail, normal conversation continues.

Other useful concepts:
- pre-compaction memory flush;
- action-sensitive memory metadata;
- dreaming/consolidation;
- pluggable memory engines;
- provenance-rich memory wiki.

Rejected:
- Markdown/SQLite/filesystem as canonical Masanawa memory;
- Agent workspace memory as Character/relationship/world memory.

## Direct reuse classification

### Conditional direct dependency
- `@openclaw/gateway-protocol`
- `@openclaw/gateway-client`

Only inside an optional compatibility/bridge adapter.

### Adapt/reimplement under Masanawa contracts
- channel admission/routing;
- device registry/pairing;
- current-authority checks;
- approval registry;
- skill revision/distribution layer;
- execution steering;
- tool/sandbox policy;
- execution workspace/session concepts.

### Reject as Masanawa defaults
- OpenClaw as base repository/kernel;
- one-trust-domain public Gateway;
- session ownership as privacy/security;
- broad cross-agent/cross-session access defaults;
- Agent identity = Character identity;
- local workspace/SQLite/Markdown = platform truth;
- cron = canonical business workflow engine.

## Remaining OpenClaw follow-up

OpenClaw is sufficiently analysed to make the adoption-boundary decision.

Only revisit OpenClaw in later Phase 0A comparisons when another donor creates a direct conflict:
- OpenJarvis/elizaOS/MAF for agent/plugin/workflow;
- N.E.K.O/Letta/Mem0 for memory;
- AIRI/elizaOS for device/embodiment;
- native channel implementation vs optional OpenClaw bridge.
