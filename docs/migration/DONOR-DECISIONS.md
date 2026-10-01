# Donor Decisions

Status: Phase 0 canonical overlap-resolution record.

Purpose: when multiple source systems implement the same broad capability, Masanawa must choose one canonical architecture and preserve only the strongest secondary behaviors. This document prevents later developers from recreating parallel donor runtimes.

## DD-001 — Character identity and persona

Primary skeleton: ChatWithStars.

Secondary donors:
- N.E.K.O for flexible character configuration/embodiment experience.
- CyberVerse only for session-facing character projection.

Decision:
- `packages/identity` owns Character and immutable/versioned IdentityVersion/Constitution.
- Authored identity, voice references, appearance references, disclosure and boundaries are versioned.
- N.E.K.O/CyberVerse character JSON/configs are import/reference formats only.
- No channel, avatar renderer, model provider or plugin owns character truth.

## DD-002 — Memory

Primary cognitive donor: N.E.K.O.
Primary privacy/scope donor: ChatWithStars.
Secondary retrieval donor: OpenJarvis.

Decision:
- one `packages/memory` service;
- memory has orthogonal type + scope;
- N.E.K.O-style recent/fact/reflection/persona cognition is adapted;
- CWS user-character/private-vs-world ownership is mandatory;
- OpenJarvis retrieval/index techniques are optional derived indexes;
- CyberVerse session history is conversation/presence state, not a second memory store;
- authored Character Constitution cannot be silently rewritten by learned persona memory.

## DD-003 — Skills, tools and plugins

Skill skeleton: OpenJarvis.
Skill governance: ChatWithStars.
Plugin packaging/lifecycle: N.E.K.O.

Decision:
- canonical chain: Capability -> Tool -> Skill -> Character Expertise.
- OpenJarvis SkillManager/parser/import/dependency/SkillTool pattern is adapted.
- CWS Skill Contract v2, versioning, certification, risk, approvals, pricing, idempotency and readiness are authoritative governance.
- N.E.K.O Plugin is an extension package that may register canonical tools/skills/providers/event handlers/UI extensions.
- A Plugin is not an alternate agent runtime, memory system or skill system.
- imported extensions enter quarantine/untrusted state until validation/certification.

## DD-004 — Agent execution and background work

Agent strategy skeleton: OpenJarvis.
Durable workflow/task truth: ChatWithStars.
Foreground/background realtime UX and worker isolation: CyberVerse.

Decision:
- Character != AgentStrategy.
- `packages/agents` exposes interchangeable execution strategies and loop/budget guards.
- `packages/workflows` owns durable task state, approvals, attempts and artifacts.
- CyberVerse's immediate foreground ACK, progress queries, terminal result reinjection and role-isolated worker pattern are preserved.
- there is no separate PersonaAgent task database/runtime in Masanawa.
- N.E.K.O browser/computer-use is implemented as permissioned Tools/worker execution, not as unrestricted agent authority.

## DD-005 — Realtime voice and digital-human presence

Transport/media skeleton: CyberVerse behavior/architecture, implemented independently because of GPLv3.
Operational call recovery: ChatWithStars.
Perception and optional speaker verification: N.E.K.O.

Decision:
- `services/presence` owns WebRTC/live transport, playback epochs, barge-in, media synchronization and avatar session bridge.
- canonical conversation/identity/memory/task truth remains outside presence.
- voice-only is first-class and cannot depend on an avatar renderer.
- CWS readiness/recovery/reconnect/relink race behaviors are preserved.
- N.E.K.O speaker identity is an optional security capability, not the character's output voice identity.
- avatar/media providers are swappable.

## DD-006 — Avatar and embodiment

Avatar breadth donor: N.E.K.O.
Realtime generated-human donor: CyberVerse.
Canonical identity/produced-media continuity: ChatWithStars.

Decision:
- `AvatarProvider` is renderer abstraction only.
- Live2D/VRM/MMD/PNG/generated-human/cloud renderers consume canonical Character appearance/voice references.
- realtime avatar state is ephemeral presence state.
- produced-media continuity belongs to Studio.
- embodied interactions enter the platform as PerceptionEvents and may produce scoped MemoryCandidates with provenance.

## DD-007 — Proactivity, scheduling and life simulation

Proactivity domain skeleton: N.E.K.O.
Generic schedule semantics: OpenJarvis.
Character/world life state: ChatWithStars.
Social cadence: ChatWithStars automation.

Decision:
- `packages/proactivity` owns trigger/candidate/decision/delivery policy.
- `packages/world` owns character routines/life events/story state.
- `packages/workflows`/workers own durable scheduled execution.
- OpenJarvis once/interval/cron/timezone behavior is reused conceptually.
- social posting cadence is a Social policy, not the universal scheduler.
- all proactive user contact passes permission/privacy/relevance/frequency/quiet-hour/channel gates.

## DD-008 — Providers and compute

General inference skeleton: OpenJarvis.
Realtime media provider separation: CyberVerse.
Operational readiness/acceptance: ChatWithStars.

Decision:
- one `packages/providers` registry with capability-specific interfaces.
- explicit provider selection does not silently substitute another provider.
- automatic routing may fall back only through configured policy/health/model compatibility.
- provider existence/configuration != production acceptance.
- deployment vendors are compute adapters, never domain architecture.

## DD-009 — Events, traces and reliability

Trace/evaluation skeleton: OpenJarvis.
Durable domain/outbox/financial evidence: ChatWithStars.
At-least-once/liveness patterns: N.E.K.O.
Ordered task progress: CyberVerse.

Decision:
- four event classes remain distinct: telemetry, durable domain, immutable audit, integration/outbox.
- execution traces do not become business truth.
- transactional side effects use outbox/idempotency/reconciliation.
- background cognition/work has bounded retries and dead-letter/Needs Attention.
- reconnectable task progress uses durable ordered events.

## DD-010 — Computer/browser use

Interaction donor: N.E.K.O.
Sandbox/security donor: OpenJarvis.

Decision:
- computer/browser use is a Tool family with explicit permission scope and device/session lease.
- generated arbitrary Python/shell is not the default desktop-action protocol.
- use a typed/restricted action representation, input cleanup and exclusive execution.
- browser/network access inherits SSRF, filesystem, secret and capability policies.

## DD-011 — Social platform

Primary donor: ChatWithStars automation/social architecture.

Decision:
- one tenant-scoped Social service with durable ingestion/planning/review/publish receipts.
- provider/channel adapters do not own queue truth.
- review rejection/terminal semantics, dedupe across redeploy and credential-vault separation are preserved.

## DD-012 — Studio

Primary donor: ChatWithStars media studio.
Secondary donor: CyberVerse only for reusable realtime media-provider concepts.

Decision:
- live presence and produced media remain separate systems.
- Studio owns project/script/storyboard/shot/render/quality/continuity/voice/lipsync/assembly state.
- canonical Character identity/voice/appearance are referenced, not duplicated into project truth.
- render retries are bounded and human review is a terminal/escalation path, not an infinite regeneration loop.

## DD-013 — Commerce and consequential service execution

Primary donor: ChatWithStars.

Decision:
- workflows, quote/payment/approval/provider attempt/reconciliation/receipt/ledger remain deterministic.
- model/JEV output never establishes financial truth.
- production provider acceptance, sandbox exclusion, immutable evidence and audited adjustments are preserved.

## DD-014 — Ops and governance

Primary donor: ChatWithStars.
Secondary evaluation donor: OpenJarvis.

Decision:
- Ops is a first-class application over canonical APIs.
- readiness, configured, live-accepted and degraded are different states.
- do not manufacture consequential real traffic merely to satisfy an evidence counter.
- operator surfaces expose privacy-safe aggregates by default.
- emergency kill switches are durable server-side policy state.
