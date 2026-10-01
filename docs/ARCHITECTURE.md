# Masanawa Canonical Architecture

Status: canonical. If another document conflicts with this one, this document wins unless an ADR explicitly supersedes it.

## 1. Architecture shape

```
Channels / Apps
      |
Gateway + Perception
      |
Character Session Runtime
      |
+-----+---------+---------+
| Identity      | Memory  | World
+---------------+---------+
      |
Decision Fabric
      |
Agent Strategy
      |
Skill Manager
      |
Skill Executor
  |         |
subskill   tool
  |         |
  +---- Tool Executor
             |
        Provider Layer
             |
       External systems

Cross-cutting: events, workflows, security, telemetry, audit, Ops.
```

## 2. Canonical domain ownership

Masanawa owns domain truth. Donor projects never remain runtime boundaries.

- Identity: `packages/identity`
- Memory: `packages/memory`
- World/life: `packages/world`
- Decisions/JEV: `packages/decisions`
- Agents: `packages/agents`
- Skills: `packages/skills`
- Tools: `packages/tools`
- Workflows/tasks: `packages/workflows`
- Provider contracts: `packages/providers`
- Perception: `packages/perception`
- Proactivity: `packages/proactivity`
- Commerce: `packages/commerce`
- Events: `packages/events`
- Security: `packages/security`
- Telemetry/evaluation: `packages/telemetry`

Services orchestrate these packages; they do not duplicate them.

## 3. Character != agent

A Character is a persistent domain entity:
- identity and identity version;
- biography and disclosure;
- personality and boundaries;
- languages;
- canonical voice;
- appearance/avatar identity;
- expertise;
- relationship graph;
- memory policy;
- social identities;
- world role and life state.

An AgentStrategy is an execution technique:
- simple response;
- tool orchestrator;
- research;
- ReAct;
- code execution;
- long-context decomposition;
- continuous/background work.

A character may use different strategies for different work. Never encode a character as an agent subclass.

## 4. Context compiler

For every interaction the runtime compiles a bounded CharacterContext from:
- active identity version;
- current channel/modality;
- user-character relationship;
- relevant private memories;
- relevant shared character/world state;
- current workflow/task state;
- permissions and policy;
- available/certified skills;
- healthy tools/providers.

The context compiler must not expose irrelevant private memory or provider internals.

## 5. Memory

Memory has two independent dimensions.

Type:
- working;
- episodic;
- semantic;
- reflective;
- relationship;
- persona;
- world;
- task.

Scope:
- session;
- user-character;
- character-private;
- character-shared;
- world;
- organization;
- task.

A memory record must always carry type and scope. Deterministic privacy policy controls scope. Model/JEV assistance may classify relevance/category but cannot expand access.

Lifecycle:
event -> candidate -> privacy/sensitivity gate -> dedupe -> classification -> write -> reflection/compaction -> retrieval.

## 6. Capabilities, tools, skills and expertise

Capability = atomic thing the platform can do.

Tool = concrete implementation of capabilities.

Skill = reusable workflow that composes tools and/or subskills.

Expertise = a character-level binding to certified skills.

Canonical dependency:
`Character -> AgentStrategy -> Skill -> Tool -> Provider`.

Skills may call subskills. Dependency graphs must be acyclic and bounded.

A SkillTool adapter makes a skill callable through the same execution interface as atomic tools, inspired by OpenJarvis.

## 7. Skill governance

Masanawa combines OpenJarvis's structural skill design with ChatWithStars governance.

A production skill version contains, as applicable:
- identity/version/description;
- activation and negative examples;
- input/output/entity schemas;
- capabilities and dependencies;
- workflow/state machine;
- clarification rules;
- confirmation rules;
- risk and side-effect classes;
- approval policy;
- pricing policy;
- retries/timeouts;
- idempotency;
- reconciliation;
- handoff policy;
- completion/partial completion;
- failure recovery;
- prohibited claims;
- telemetry;
- tests;
- certification state.

External imported skills never become production-capable merely because they parse.

## 8. Tools

All atomic side effects use a common Tool contract.

Tools declare:
- key/version;
- capabilities;
- schemas;
- auth requirements;
- risk;
- side effects;
- cost;
- timeout/rate limits;
- idempotency support;
- retry/reconciliation semantics;
- sensitivity;
- health/readiness.

Skills request capabilities rather than hard-coding providers whenever possible.

## 9. Workflows

Durable business state belongs to deterministic workflows, not agent conversation history.

Examples:
- commerce: identify -> validate -> quote -> pay -> confirm -> execute -> reconcile -> receipt;
- booking: constraints -> research -> shortlist -> quote -> confirm -> execute -> reconcile;
- studio: idea -> script -> storyboard -> approved -> render -> assemble -> review -> ready -> schedule -> publish.

Agents may decide or recommend transitions only inside permitted bounds. Workflow code validates transitions and side effects.

## 10. Decision fabric

The existing ChatWithStars JEV concept is retained as a bounded typed decision fabric.

Good uses:
- continuity;
- ambiguity;
- skill classification;
- handoff desirability;
- memory relevance;
- failure classification;
- response posture;
- evidence requirements.

Never use it as authoritative source for:
- permissions;
- account ownership;
- money;
- provider transaction truth;
- idempotency state;
- destructive authorization.

Decision classes are versioned, measurable, shadow-first and replayable.

## 11. Foreground/background execution

Realtime/persona conversation stays responsive while long work executes.

```
User <-> Character session
             |
             +--> task supervisor
                    |
                    +--> background agent strategy
                           |
                           +--> skills/tools
```

The background worker does not replace the character's identity. Results return through the character/session unless an explicit character handoff occurs.

## 12. Perception

All inbound modalities normalize to PerceptionEvent:
- text;
- audio;
- image;
- camera;
- screen;
- document;
- browser;
- system/external event.

Permission/consent is enforced before sensitive perception enters model context.

## 13. Proactivity

The Proactivity Engine can consider:
- time/routines;
- promises and follow-ups;
- task completion;
- world events;
- user-permitted context;
- calendar/reminders;
- social events.

Before contacting a user it must pass:
permission -> privacy -> relevance -> channel -> quiet-hours -> frequency -> persona policy.

## 14. Presence

`services/presence` owns live transport/media:
- WebRTC;
- audio/video streams;
- barge-in;
- realtime provider bridge;
- ASR/TTS adapters when required;
- avatar rendering;
- session state bridge.

It does not own identity, durable memory or task truth.

## 15. Avatar abstraction

AvatarProvider may support:
- static/PNG;
- Live2D;
- VRM;
- MMD;
- generated human;
- cloud avatar.

Every renderer consumes canonical character identity/appearance/voice references.

## 16. World engine

World state contains shared fictional truth:
- clock;
- character locations/context;
- routines;
- goals;
- relationships;
- story arcs;
- events;
- commitments;
- availability;
- social/studio commitments.

Private user memories never automatically become world facts.

## 17. Social

Publishing is durable:
planned -> approved -> queued -> publishing -> published
or blocked / retry_scheduled / failed.

Use outbox/idempotency/provider receipts. Social channel adapters never own canonical content state.

## 18. Studio

Produced media is separate from live presence:
idea -> script -> storyboard -> shots -> generation -> voice -> lipsync -> assembly -> review -> publish.

Identity references and provenance are shared with the character system.

## 19. Commerce

Financial truth is deterministic:
- quote;
- payment;
- ledger;
- approval;
- provider execution;
- reconciliation;
- receipt/refund.

Never equate request-sent with transaction-completed.

## 20. Events

PlatformEvent families:
- ephemeral telemetry;
- durable domain events;
- immutable audit events;
- integration/outbox events.

Examples: turn.received, memory.written, decision.completed, skill.started, tool.completed, workflow.transitioned, payment.confirmed, world.event, presence.interrupted, social.published.

## 21. Plugins

Plugin is packaging, not a competing abstraction.

A plugin may register:
- tools;
- skills;
- providers;
- event handlers;
- optional Ops UI extensions.

It may not create a parallel identity, memory, routing or workflow runtime.

## 22. Learning

Execution trace -> evaluation -> candidate optimization -> rehearsal -> certification -> new version.

Production skills/personas never self-modify directly from traces.

## 23. Dependency direction

Domain packages must form an acyclic graph. Architecture boundary tests should enforce this.

Apps -> services -> domain packages -> contracts.

Providers sit at the edge. Domain packages cannot import channel-specific implementations.

## 24. Data authority

Canonical durable operational state is PostgreSQL. No donor-specific SQLite/memory database becomes an independent source of truth.

Caches/vector indexes are derived and rebuildable.

## 25. Reliability

Required patterns:
- idempotency keys;
- durable jobs;
- outbox;
- deduplicated webhooks;
- leases/claims;
- bounded retries/backoff;
- dead-letter/needs-attention;
- provider reconciliation;
- replay-safe handlers;
- correlation IDs.

## 26. Security

Required from foundation:
- scoped service auth;
- RBAC/operator authorization;
- row-level data isolation where applicable;
- secret vault references;
- webhook verification;
- safe request limits;
- log masking;
- audit events;
- data minimization;
- explicit perception permissions.

## 27. One-truth rule

Never create:
- separate WhatsApp memory;
- CyberVerse memory;
- Jarvis skills beside Masanawa skills;
- N.E.K.O identity beside Masanawa identity;
- separate agent dispatchers.

Adapters translate to canonical Masanawa contracts.


## 28. Phase 1 implementation specifications

The following documents refine this architecture into implementation-ready contracts and are canonical together under ADR-0011:
- `DOMAIN-MODEL.md`;
- `PACKAGE-BOUNDARIES.md`;
- `EVENT-CONTRACTS.md`;
- `SECURITY-AUTHORITY.md`;
- `DATA-ARCHITECTURE.md`;
- `PRIVACY-SCOPES.md`;
- `SERVICE-CONTRACTS.md`;
- `GOLDEN-JOURNEYS.md`.

If a Phase 2 implementation choice conflicts with these boundaries, update the architecture/ADR first rather than introducing an implicit exception.
