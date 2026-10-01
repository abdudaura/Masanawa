# Masanawa Greenfield Rewrite Plan

## Completion philosophy

No source feature is considered migrated because a source file was copied or a similar feature exists. It is complete only when represented in the ledgers, designed in Masanawa terms, implemented in the canonical subsystem and verified through the appropriate parity/acceptance gates.

## Classification

Every discovered source capability receives:
- A — preserve behavior: critical/core behavior requiring parity evidence;
- B — preserve capability, redesign implementation: behavior goal retained but implementation intentionally differs;
- C — explicit reference/retirement: not part of target product; reason recorded.

## Ledger status lifecycle

discovered -> analysed -> designed -> contracted -> implemented -> unit-tested -> parity-tested -> integrated -> production-verified -> complete

Retirement is an explicit terminal state with rationale.

## Phase 0 — Source forensics

Inputs: the four pinned repositories in SOURCE-LOCK.

Outputs:
- FEATURE-LEDGER;
- BEHAVIOUR-LEDGER;
- DATA-LEDGER;
- INTEGRATION-LEDGER;
- LICENSE-LEDGER;
- donor decisions for every overlapping subsystem.

Method:
- analyse each source using the same domain taxonomy;
- inspect docs and implementation, not README only;
- include hidden operational behavior, failure handling, tests and configuration;
- trace database/state concepts;
- trace external providers;
- identify source security assumptions;
- identify user-visible behavior;
- deduplicate after source-specific inventories are complete.

Gate: every meaningful source subsystem is classified A/B/C and assigned a Masanawa destination or explicit retirement.

## Phase 1 — Architecture specification

Finalize:
- domain model;
- package boundaries;
- event model;
- data/security model;
- service contracts;
- ADRs for unresolved donor conflicts;
- initial golden journeys.

No production feature porting yet.

## Phase 2 — Foundation

Implement:
- pnpm monorepo;
- strict TypeScript configuration;
- shared contracts;
- branded IDs;
- structured errors;
- configuration;
- event primitives;
- Fastify service bootstrap;
- Next.js app shells;
- PostgreSQL migration system;
- auth/service-auth foundation;
- structured logging/OpenTelemetry;
- Vitest/Playwright/pytest harness;
- architecture-boundary checks;
- CI.

## Phase 3 — Identity and world

Implement:
- character;
- identity versions/Constitution;
- voice/appearance refs;
- expertise metadata;
- character relationships;
- life state;
- world events/routines;
- context compiler base.

Gate with ChatWithStars parity fixtures.

## Phase 4 — Memory

Implement type+scope memory, lifecycle, retrieval, compaction/reflection, correction/supersession and privacy isolation.

Gate with CWS fan-isolation and N.E.K.O cognitive-memory behaviors.

## Phase 5 — Tools and providers

Implement:
- capability registry;
- Tool contract/executor;
- provider registry;
- credentials/vault references;
- readiness/health;
- idempotency/retry/reconciliation metadata.

No skill may bypass the Tool boundary for external side effects.

## Phase 6 — Skills

Implement OpenJarvis-inspired structure:
- SkillManifest/SkillContract;
- manager;
- parser/import format;
- resolver;
- dependency graph;
- executor;
- SkillTool adapter;
- source importers;
- governance/certification/readiness;
- trace metadata.

Gate against OpenJarvis structural behaviors and CWS governance behaviors.

## Phase 7 — Agent runtime

Implement:
- AgentStrategy;
- AgentContext/Result;
- inference provider abstraction;
- simple/tool-orchestrator/research strategies;
- task supervisor/background execution;
- character-aware context integration.

## Phase 8 — Decisions and workflows

Rebuild:
- typed JEV decision fabric;
- shadow/replay/evaluation;
- workflow state machine framework;
- approvals;
- idempotency;
- outbox;
- reconciliation.

## Phase 9 — Channels

Implement canonical adapters:
- web;
- WhatsApp;
- Telegram.

All use one runtime/memory/identity/task system.

Cross-channel continuation becomes a golden journey gate.

## Phase 10 — Proactivity and perception

Implement:
- schedules/routines/promises;
- trigger engine;
- contact permission/frequency/quiet-hour gates;
- PerceptionEvent;
- screen/image/document/vision adapters with consent.

## Phase 11 — Realtime presence

Implement CyberVerse-inspired clean architecture:
- WebRTC;
- full-duplex audio;
- barge-in;
- realtime model adapter;
- ASR/TTS adapters;
- avatar provider;
- foreground persona/background work.

Do not copy GPL code into core by default.

## Phase 12 — Commerce, social and studio

Rebuild CWS production domains:
- commerce/payments/ledger/reconciliation/receipts;
- social accounts/outbox/moderation/publish receipts;
- media studio identity locks, script/storyboard/render/voice/lipsync/assembly/provenance.

## Phase 13 — Learning and plugins

Implement:
- execution traces;
- skill/decision evaluation;
- candidate optimization overlays;
- rehearsal/certification promotion;
- plugin manifest/SDK;
- external skill import pipeline.

Production never self-mutates directly.

## Phase 14 — Full parity and cutover

Requirements:
- 100% ledger resolution;
- all A items parity verified;
- all B items have accepted replacement evidence;
- all C items explicitly retired;
- golden journeys passing;
- security/load/recovery gates passing;
- production pilot passing;
- rollback proven.

Only then archive/retire ChatWithStars as an active platform repository.

## Golden journeys

At minimum:
1. meet character -> converse -> remember -> return -> appropriate proactive follow-up;
2. research request -> route -> tools -> sourced result -> memory;
3. live call -> character responds -> user interrupts -> state continues;
4. commerce request -> quote -> payment -> execute -> reconcile -> receipt;
5. world event -> shared state -> consistent references across users without privacy leakage;
6. web conversation -> WhatsApp continuation -> call -> same relationship/task state;
7. long task -> foreground character remains responsive -> background work returns result;
8. cross-character handoff -> bounded context -> completion -> optional return;
9. social content -> approval -> publish -> receipt/retry;
10. studio content -> identity-consistent asset -> review -> publish.

## Rule for source repositories

After Phase 0 begins, donor repositories are reference sources. Major new platform architecture should be implemented only in Masanawa. Critical production bug fixes in old systems are allowed until cutover but must be reflected in the behavior ledger if they change required parity.
