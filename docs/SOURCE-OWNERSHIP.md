# Source Ownership and Donor Decisions

## Governing principle

Masanawa owns the resulting architecture. Every repository under `references/sources/` is a donor/reference system only.

**Donor ownership is currently provisional.** We deliberately expanded the landscape before freezing architecture because newer/more mature projects may provide a stronger skeleton for specific subsystems than the original four.

## Provisional donor matrix

| Masanawa domain | Primary candidates | Secondary candidates | Masanawa-specific responsibility |
|---|---|---|---|
| Product/domain model | ChatWithStars | — | generalize beyond the original Stars product |
| Character identity/versioning | ChatWithStars | Letta, AIRI, N.E.K.O | canonical Constitution/identity compiler and disclosure |
| Private relationships | ChatWithStars | Letta, N.E.K.O | strict user-character isolation |
| Shared world/life | **AI Town (selected simulation-mechanics donor)** + **ChatWithStars (selected life/canon donor)** | N.E.K.O | **packages/world owns canonical world/life state, events, generations, policy and projections** |
| Memory lifecycle | **N.E.K.O (selected cognitive donor)** | Letta Code, OpenClaw | **packages/memory owns canonical type+scope records, evidence, lifecycle and persistence** |
| Memory retrieval/evaluation | **Mem0 (selected specialist donor)** | N.E.K.O, OpenClaw, Letta Code | **packages/memory authorizes scope before hybrid retrieval; indexes are rebuildable** |
| Agent execution | **OpenJarvis (selected structural donor)** + **elizaOS (selected TS component donor)** | OpenClaw, Microsoft Agent Framework | **packages/agents owns character-aware execution envelope, strategies and budgets** |
| Skills | **OpenJarvis (selected structural donor)** | OpenClaw, Microsoft Agent Framework, ChatWithStars | **packages/skills owns canonical versions; CWS governance, OpenClaw revisions, MAF disclosure/security** |
| Tools/security | **OpenJarvis (selected structural donor)** | OpenClaw, ChatWithStars, elizaOS | **packages/tools + security own atomic capabilities and deterministic side-effect policy** |
| Learning/traces | OpenJarvis | ChatWithStars, Microsoft AF | gated candidate promotion |
| Decision fabric | ChatWithStars JEV | Microsoft AF middleware/policies | bounded typed decisions only |
| Durable workflows | **Microsoft Agent Framework (selected orchestration donor)** + **ChatWithStars (business-state donor)** | OpenClaw authority patterns, CyberVerse tasks | **packages/workflows owns durable graph/checkpoints/HITL; domain packages own business truth** |
| Proactivity | N.E.K.O | OpenClaw, Letta, ChatWithStars world | permission/frequency/privacy/quiet-hours |
| Perception | N.E.K.O, OpenClaw device nodes | AIRI, elizaOS, CyberVerse | canonical PerceptionEvent + permissions |
| Gateway/channels | **OpenClaw (selected architectural donor)** | elizaOS, OpenJarvis channels | Masanawa-native multi-tenant Gateway; optional OpenClaw bridge |
| Realtime transport | **LiveKit Server (selected)** | CyberVerse | production WebRTC/session infrastructure behind Masanawa PresenceSession |
| Realtime agent session | **LiveKit Agents TS (selected primary)** | LiveKit Agents Python, Pipecat, CyberVerse | Masanawa CharacterSession bridge |
| Realtime pipeline/turn-taking | **LiveKit Agents TS (selected primary)** | Pipecat, CyberVerse | interruption, frame/processor seams, multimodal composition |
| Digital-life/embodiment | **AIRI (selected architectural donor)** | N.E.K.O | Masanawa-owned Character contracts across web/desktop/mobile/avatar contexts |
| Avatars | **AIRI renderer architecture** + LiveKit avatar ecosystem | CyberVerse, N.E.K.O | one renderer-neutral AvatarProvider tied to canonical identity |
| Social | ChatWithStars | OpenClaw/eliza channel patterns | durable outbox/publish state |
| Commerce | ChatWithStars | eliza approval patterns | deterministic ledger/reconciliation |
| Studio | ChatWithStars | AIRI/CyberVerse media concepts | produced-media pipeline separate from live presence |
| Plugin ecosystem | **elizaOS (selected component-model donor)** | OpenClaw, N.E.K.O | **packages/plugins owns manifests/components/capabilities/lifecycle; plugins register canonical components only** |
| Ops/governance | ChatWithStars | OpenClaw control plane, Microsoft AF observability | unified operator control and readiness |

## Important candidate decisions

### Agent runtime, skills, plugins and workflows — decision recorded

Masanawa owns one execution fabric rather than adopting a donor kernel.

Selected composition:
- OpenJarvis — primary structural donor for agent strategies/guards, tools and SkillManager/parser/dependency/executor/import/provenance;
- elizaOS — primary TypeScript component/plugin runtime donor for typed actions/providers/evaluators/services/events and host-vs-kernel plugin loading;
- Microsoft Agent Framework — primary durable workflow graph/checkpoint/HITL/restart donor plus middleware/observability/progressive-disclosure skill behavior;
- OpenClaw — run steering/subagent/session policy, skill revision pinning/distribution and current-authority patterns;
- ChatWithStars — deterministic business workflows, skill certification/readiness/risk and side-effect reconciliation.

Canonical owners are `packages/agents`, `packages/skills`, `packages/plugins`, `packages/tools` and `packages/workflows`. Character identity, memory and world/business truth remain outside donor runtime objects.

See ADR-0008 and `docs/migration/RUNTIME-SKILLS-WORKFLOW-ADOPTION-BOUNDARY.md`.

### Gateway, channels and devices — decision recorded

OpenClaw is selected as the primary **architectural donor** for Gateway/channel/device-node behavior.

It is explicitly **not** selected as Masanawa's kernel or public multi-tenant security boundary. OpenClaw documents one trusted boundary per Gateway, while Masanawa must isolate untrusted users/relationships/tenants on shared infrastructure.

Adopt:
- admission-before-routing;
- deterministic bindings;
- channel health/lifecycle;
- node/device pairing and capability publication;
- steering/queue semantics;
- current-authority revalidation;
- skill distribution/revision semantics.

Reimplement behind Masanawa contracts:
- public Gateway ingress and RBAC;
- user/tenant/relationship resolution;
- device registry;
- approvals;
- runtime sessions/workspaces;
- skill registry.

Conditional direct reuse of `@openclaw/gateway-protocol` and `@openclaw/gateway-client` is allowed only inside an OpenClaw compatibility bridge.

See ADR-0004.

### Memory — decision recorded

`packages/memory` is the sole canonical memory authority.

Selected composition:
- N.E.K.O — primary cognitive-lifecycle donor for facts, evidence, reflections, promotion, liveness and explicit/proactive recall separation;
- Mem0 — primary extraction/retrieval/evaluation donor for ADD-oriented extraction, entity/temporal metadata, hybrid retrieval, reranking and benchmarks;
- Letta Code — working/core-context, revisioned editable memory, serialized writes/conflict repair and explicit shared-memory attachment donor;
- OpenClaw — action-sensitive metadata, compaction flush, consolidation/dreaming and provenance donor;
- ChatWithStars — mandatory relationship/private/shared/world privacy invariant.

Canonical PostgreSQL `MemoryRecord` + explicit `MemoryScope` own truth. Vector, lexical, graph and temporal stores are rebuildable projections. Authorization runs before retrieval. No donor agent/workspace/filesystem/vector object is a platform memory contract.

At the pinned baseline, `letta-ai/letta` is a landing/historical repository; current implementation evidence comes from Letta Code.

See ADR-0007 and `docs/migration/MEMORY-ADOPTION-BOUNDARY.md`.

### Digital-life and embodiment — decision recorded

AIRI is selected as the primary architectural donor for client-side digital-life and embodiment.

Adopt:
- one Stage concept across web/desktop/mobile;
- renderer-neutral Live2D/VRM/MMD/Spine/static presentation contracts;
- model-driver lifecycle and explicit renderer ownership/release;
- Character Card V3/AIRI pack as a validated interoperability/import format;
- plugin capability lifecycle and least-privilege grant intersection;
- serialized voice-input lifecycle and stale-callback protection;
- separate deterministic/browser-DOM/desktop computer-use lanes.

Do not adopt:
- AIRI card/module/provider configuration as canonical Character truth;
- Vue/Pinia/browser local state as platform truth;
- AIRI memory as the primary memory system;
- AIRI as realtime WebRTC transport;
- Vue/Electron/Capacitor as mandatory Masanawa frameworks.

Relevant AIRI packages are mostly private and/or Vue-specific, so architecture/source adaptation is preferred to hidden direct dependency.

See ADR-0005.

### Presence — decision recorded

The realtime presence comparison is complete.

Selected:
- LiveKit Server for production WebRTC room/media transport;
- LiveKit Agents TypeScript as the primary server-side realtime-session framework;
- AIRI for client-side digital-life/embodiment;
- Masanawa-owned PresenceSession/CharacterSession contracts as the stable platform boundary.

Secondary:
- Pipecat contributes frame/pipeline composition, interruption propagation and side-pipeline patterns behind Masanawa interfaces;
- LiveKit Agents Python is a maturity/provider reference and optional specialist runtime, not a second canonical presence engine;
- CyberVerse contributes GPL-clean behavioral specifications for playback epochs, A/V sync, audio-only mode, pipeline race safety and foreground/background task UX.

Do not make LiveKit Agent = Character, room metadata = durable business truth, or Pipecat = a parallel session authority.

See ADR-0006 and `docs/migration/PRESENCE-ADOPTION-BOUNDARY.md`.

### Agent runtime

Decision recorded above and in ADR-0008. No donor Agent object becomes Character identity or durable workflow/business truth.

### World — decision recorded

The AI Town + ChatWithStars comparison is complete.

Selected composition:
- AI Town — primary donor for ordered-input tick/step simulation, generation conflict rejection, transactional step commit, autonomous interactions, optional spatial mechanics and engine liveness;
- ChatWithStars — primary donor for Character life-state/canon semantics, Constitution gating, routines/story arcs, visibility/provenance, tenant isolation and immutable approved canon;
- Masanawa `packages/world` — sole canonical authority for world/life records, WorldPolicy, simulation generations/inputs/steps, WorldEvent/WorldInteraction evidence and current projections.

Do not make AI Town `Player`/`Agent`/Convex world documents canonical Character/world truth. Do not retain ChatWithStars' process-local life-engine lock for horizontal execution. Spatial state is optional, and world events cross explicit boundaries to memory, workflows and presence.

See ADR-0009 and `docs/migration/WORLD-SIMULATION-ADOPTION-BOUNDARY.md`.

## Donor conflict procedure

When sources overlap:
1. create/locate Feature Ledger rows;
2. compare source implementation, tests and operational maturity;
3. select the structural donor;
4. preserve stronger secondary behaviors;
5. record the decision in an ADR or this file;
6. create parity/acceptance fixtures;
7. implement exactly once in Masanawa.

A donor may win one subsystem and lose another. Never import an entire framework's conceptual boundaries just because one subsystem is strong.
