# Masanawa Greenfield Rewrite Plan

## Completion philosophy

No source feature is migrated because a directory was copied or a similar feature exists. A capability is complete only when represented in the ledgers, designed in Masanawa terms, implemented in the canonical subsystem and verified through parity/acceptance gates.

## Classification

- A — preserve behavior: critical behavior requiring parity evidence.
- B — preserve capability, redesign implementation.
- C — explicit reference/retirement with rationale.

Lifecycle:
`discovered -> analysed -> designed -> contracted -> implemented -> unit-tested -> parity-tested -> integrated -> production-verified -> complete`.

## Phase 0A — Landscape expansion and donor selection

Status: complete. Phase 0B is also closed; current active work is Phase 1 architecture specification.

Inputs: all pinned submodules in `references/sources/` and `migration/SOURCE-LOCK.md`.

Tasks:
- build source maps for the expanded donor set;
- mine implementation/tests, not README claims only;
- seed Feature/Behaviour/Data/Integration ledgers;
- compare overlapping candidate architectures;
- verify license/provenance constraints;
- select provisional structural donors per subsystem.

Mandatory comparisons are documented in `migration/LANDSCAPE-EXPANSION.md`.

Gate: foundation subsystems have evidence-backed donor decisions rather than assumptions.

## Phase 0B — Exhaustive source forensics

Status: complete. Closure audit: `migration/PHASE-0B-CLOSURE-AUDIT.md`.

Completed deep mining across selected and secondary donors.

Outputs:
- FEATURE-LEDGER;
- BEHAVIOUR-LEDGER;
- DATA-LEDGER;
- INTEGRATION-LEDGER;
- LICENSE-LEDGER;
- explicit donor decisions for every overlap.

Method:
- inspect architecture docs, source, tests, migrations/config and deployment;
- include hidden failure/recovery behavior;
- trace state concepts and provider assumptions;
- deduplicate only after source-specific extraction;
- classify every meaningful capability A/B/C.

Gate: every meaningful reference capability is assigned a Masanawa destination or explicit retirement and repository-wide coverage proof finds no unexplained production subsystem.

## Phase 1 — Architecture specification

Status: complete. Closure audit: `PHASE-1-CLOSURE-AUDIT.md`.

Finalize domain model, package boundaries, events, data/security, service contracts, ADRs and golden journeys. Phase 0 is closed; no production feature porting begins until this architecture gate passes.

## Phase 2 — Foundation

Status: active.

Implement pnpm monorepo, strict TypeScript, contracts, IDs/errors/config, events, Fastify service bootstrap, Next.js shells, PostgreSQL migrations, auth/service auth, OpenTelemetry, test harnesses, architecture-boundary CI.

## Phase 3 — Identity and world

Implement canonical Character, versioned Constitution, voice/appearance refs, expertise metadata, relationships, life state, world events/routines and context compiler.

Gate against CWS + selected world-simulation donor behaviors.

## Phase 4 — Memory

Implement type+scope memory, lifecycle, retrieval, evidence/reflection, correction/supersession, compaction, privacy isolation and liveness/dead-letter behavior.

Gate against CWS privacy plus selected N.E.K.O/Letta/Mem0/OpenClaw behaviors.

## Phase 5 — Tools and providers

Implement capability registry, Tool contract/executor, provider registry, credentials, readiness/health, idempotency/retry/reconciliation and execution security.

## Phase 6 — Skills

Implement the selected unified skill architecture after OpenJarvis/OpenClaw/MAF comparison: manifest/contract, manager, parser/import, dependencies, execution/SkillTool, provenance/trust, governance/certification/readiness and trace metadata.

## Phase 7 — Agent runtime

Implement AgentStrategy, AgentContext/Result, provider abstraction, orchestration/research/background strategies, budgets/guards and character-aware context.

## Phase 8 — Decisions and workflows

Rebuild JEV plus deterministic workflow framework, approvals, checkpoint/restart, idempotency, outbox, human-in-loop and reconciliation.

## Phase 9 — Gateway and channels

Implement canonical gateway/channel routing using the selected OpenClaw/eliza/CWS patterns. Web, WhatsApp, Telegram and later device/channel adapters all resolve into one identity/runtime/memory/task system.

## Phase 10 — Proactivity and perception

Implement schedules/routines/promises/intents, trigger engine, quiet-hours/frequency/privacy gates and permissioned multimodal PerceptionEvents/device-node inputs.

## Phase 11 — Realtime presence and embodiment

Implement selected LiveKit/Pipecat/CyberVerse/AIRI architecture: WebRTC, full-duplex audio/video, turn detection/barge-in, realtime model/STT/TTS adapters, avatar provider and foreground persona/background work.

## Phase 12 — Commerce, social and studio

Rebuild CWS production domains: financial ledger/reconciliation/receipts, social outbox/publishing and identity-consistent media production.

## Phase 13 — Learning and plugins

Implement trace/evaluation, candidate optimization, rehearsal/certification, plugin SDK and external skill/plugin ecosystem. Production never self-mutates directly.

## Phase 14 — Full parity and cutover

Requirements:
- 100% ledger resolution;
- all A parity verified;
- all B accepted replacements;
- all C explicit retirements;
- golden journeys, security/load/recovery and production pilot passing;
- rollback proven.

Only then retire ChatWithStars as an active platform implementation.

## Golden journeys

1. Meet character -> converse -> remember -> return -> appropriate proactive follow-up.
2. Research -> route -> tools -> sourced result -> memory.
3. Live call -> speech/avatar -> interruption -> continuation.
4. Commerce -> quote -> payment -> execute -> reconcile -> receipt.
5. World event -> consistent shared state without relationship-memory leakage.
6. Web -> WhatsApp -> call with same relationship/task continuity.
7. Long task -> foreground stays responsive -> background result returns.
8. Cross-character handoff -> bounded context -> completion/return.
9. Social draft -> approval -> publish -> receipt/retry.
10. Studio project -> identity-consistent media -> review -> publish.
11. Device/node perception -> explicit permission -> bounded observation -> safe action.
12. Agent/workflow crash/restart -> durable recovery without duplicate side effects.

## Reference rule

Donor code lives under `references/sources/` only as pinned Git submodules. It is reference material, never a hidden Masanawa dependency.
