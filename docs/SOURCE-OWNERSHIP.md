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
| Shared world/life | ChatWithStars, AI Town | N.E.K.O | governed world truth + persistent simulation |
| Memory lifecycle | N.E.K.O, Letta | OpenClaw | type+scope memory, evidence, reflection, durable experience |
| Memory retrieval/evaluation | Mem0 | N.E.K.O, OpenClaw, Letta | tenant/privacy filters before retrieval |
| Agent execution | OpenJarvis, elizaOS | Microsoft Agent Framework, OpenClaw | character-aware execution envelope |
| Skills | OpenJarvis, OpenClaw | Microsoft Agent Framework, ChatWithStars | CWS governance/certification/risk |
| Tools/security | OpenJarvis, OpenClaw | ChatWithStars, elizaOS | provider-neutral capability/readiness + deterministic side-effect policy |
| Learning/traces | OpenJarvis | ChatWithStars, Microsoft AF | gated candidate promotion |
| Decision fabric | ChatWithStars JEV | Microsoft AF middleware/policies | bounded typed decisions only |
| Durable workflows | ChatWithStars, Microsoft Agent Framework | Pipecat Flows, CyberVerse tasks | deterministic business state + restartability |
| Proactivity | N.E.K.O | OpenClaw, Letta, ChatWithStars world | permission/frequency/privacy/quiet-hours |
| Perception | N.E.K.O, OpenClaw device nodes | AIRI, elizaOS, CyberVerse | canonical PerceptionEvent + permissions |
| Gateway/channels | **OpenClaw (selected architectural donor)** | elizaOS, OpenJarvis channels | Masanawa-native multi-tenant Gateway; optional OpenClaw bridge |
| Realtime transport | LiveKit | CyberVerse | production WebRTC/session infrastructure |
| Realtime agent session | LiveKit Agents TS | Pipecat, CyberVerse | Masanawa CharacterSession bridge |
| Realtime pipeline/turn-taking | Pipecat, LiveKit Agents | CyberVerse | interruption, frames, multimodal composition |
| Digital-life/embodiment | **AIRI (selected architectural donor)** | N.E.K.O | Masanawa-owned Character contracts across web/desktop/mobile/avatar contexts |
| Avatars | **AIRI renderer architecture** + LiveKit avatar ecosystem | CyberVerse, N.E.K.O | one renderer-neutral AvatarProvider tied to canonical identity |
| Social | ChatWithStars | OpenClaw/eliza channel patterns | durable outbox/publish state |
| Commerce | ChatWithStars | eliza approval patterns | deterministic ledger/reconciliation |
| Studio | ChatWithStars | AIRI/CyberVerse media concepts | produced-media pipeline separate from live presence |
| Plugin ecosystem | elizaOS, N.E.K.O, OpenClaw | OpenJarvis skills | plugins register canonical components only |
| Ops/governance | ChatWithStars | OpenClaw control plane, Microsoft AF observability | unified operator control and readiness |

## Important candidate decisions

### Skills
OpenJarvis remains the strongest structural candidate because it separates manager, parser, dependency graph, executor, SkillTool adapter, importers, trust and learning overlays.

OpenClaw must now be compared before we freeze the subsystem because it adds:
- multi-scope skill roots and deterministic precedence;
- per-agent/shared skill visibility;
- config/env/binary gating;
- install/update/verify flows;
- workshop/managed skill promotion;
- community distribution via ClawHub;
- workspace snapshot/sandbox synchronization.

ChatWithStars remains the governance donor for certification, readiness, risk, approval, pricing, idempotency and expertise.

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

### Memory
No single donor owns Masanawa memory.

Compare:
- N.E.K.O: cognitive lifecycle, facts, evidence, reflections, persona promotion, liveness;
- Letta: persistent agent identity/experience, shared memory and always-on stateful agents;
- Mem0: entity/temporal extraction, hybrid retrieval and evaluation;
- OpenClaw: action-sensitive memory, compaction flush, dreaming, memory engines and provenance-rich memory wiki;
- ChatWithStars: multi-user/privacy/world separation.

Masanawa's type+scope privacy model remains mandatory regardless of donor.

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

### Presence
CyberVerse is no longer the presumptive structural skeleton.

Compare:
- LiveKit server: production WebRTC/media infrastructure;
- LiveKit Agents TS: TypeScript AgentSession, job/worker and STT/LLM/TTS/realtime/avatar ecosystem;
- Pipecat: frame/pipeline architecture, structured conversation flows and multi-agent handoff/fan-out/shared-bus patterns;
- CyberVerse: digital-human synchronization and foreground persona/background specialist UX;
- AIRI: embodied character client/desktop/avatar experience.

CyberVerse remains GPLv3 reference-only by default.

### Agent runtime
OpenJarvis remains a strong skill/tool/strategy donor, but compare directly with:
- elizaOS for a large TypeScript AgentRuntime/plugin/provider/service stack;
- Microsoft Agent Framework for durable graph workflows, checkpointing, handoffs, human-in-loop and observability;
- OpenClaw for integrated session/workspace/channel runtime boundaries.

### World
AI Town is the new external simulation donor. Compare its transactional shared-state/simulation patterns with ChatWithStars world/life requirements. Masanawa still needs stronger privacy, governance and non-game product semantics than AI Town provides.

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
