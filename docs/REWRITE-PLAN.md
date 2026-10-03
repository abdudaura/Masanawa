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

Status: complete. Phase 0B, Phase 1, Phase 2, the non-spatial Phase 3 core, Phase 4 Memory, Phase 5 Tools/Providers and Phase 6 Skills are closed; current active work is Phase 7 Agent runtime.

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

Status: complete. Closure audit: `PHASE-2-CLOSURE-AUDIT.md`.

Implement pnpm monorepo, strict TypeScript, contracts, IDs/errors/config, events, Fastify service bootstrap, Next.js shells, PostgreSQL migrations, auth/service auth, OpenTelemetry, test harnesses, architecture-boundary CI.

## Phase 3 — Identity and world

Status: non-spatial core complete. Closure audit: `PHASE-3-NONSPATIAL-CLOSURE-AUDIT.md`.
Optional spatial WorldSpace/location/pathing remains a separately gated deferred slice behind
`WorldPolicy.spatialEnabled`; it does not block Phase 4.

Implemented canonical Character, versioned Constitution, voice/appearance refs, expertise metadata, relationships, life state, world events/routines, canon governance, interactions, pause/recovery and typed evidence publication.

Gate passed against CWS + selected world-simulation donor behaviors for the non-spatial boundary.

## Phase 4 — Memory

Status: complete. Implementation record: `PHASE-4-MEMORY.md`. Closure audit:
`PHASE-4-MEMORY-ACCEPTANCE.md`.

Canonical scoped memory, lifecycle/revision/evidence, governed publication/tombstone,
durable extraction custody, rebuildable lexical/vector/entity/temporal retrieval,
held-out evaluation, bounded context compilation, reflection/consolidation and
compaction-flush admission are implemented and acceptance-gated.

Final closure:
- acceptance implementation head `d48b17ff9c4bcb91d51d88bf78da7a1e6c9f597a`
  passed Foundation CI run 313;
- final closure documentation head `d67c9332431a7a8ce428e426f93ea61f34b7d798`
  passed Foundation CI run 316;
- PR #36 merged as `e960b3f5dfe4d7b7470ddea604187420451498ce`.

## Phase 5 — Tools and providers

Status: complete. Implementation record: `PHASE-5-TOOLS-PROVIDERS.md`.

Implemented capability registry, versioned Tool/Provider contracts, fail-closed
selection/readiness, consequential execution, durable Operation reconciliation,
receipts/replay, typed Provider failures, privacy-safe telemetry and encrypted scoped
provider credential custody.

Final merge:
- PR #45 merged as `0fe123e18a9163386c4ab10331139265ce26b64e`;
- Foundation CI run 369 passed on that exact merged `main` commit.

## Phase 6 — Skills

Status: complete. Closure audit: `PHASE-6-CLOSURE-AUDIT.md` — PASS.
Task 070 PR #76 merged as `34aa6f9d19f9b0c92527fabe3a750052009398d2`; exact merged-main Foundation CI run 451 passed.

Implement the selected unified skill architecture after OpenJarvis/OpenClaw/MAF comparison: manifest/contract, manager, parser/import, dependencies, execution/SkillTool, provenance/trust, governance/certification/readiness and trace metadata.

Product constraint: Skill definitions remain execution-edge neutral. A Skill asks for
Tools/capabilities and must not hard-code a cloud API or Android path; future Device
Providers described in `AGENT-PHONE-EMBODIMENT.md` must be selectable through the same
Tool/Provider architecture.

## Phase 7 — Agent runtime

Status: in progress. Task 071 CharacterSession is complete; current Task 072 is AgentRun identity, lineage and durable trace references.
Record: `PHASE-7-AGENT-RUNTIME.md`. Later runtime strategies remain later milestones.

Implement AgentStrategy, AgentContext/Result, provider abstraction, orchestration/research/background strategies, budgets/guards and character-aware context.

## Phase 8 — Decisions and workflows

Rebuild JEV plus deterministic workflow framework, approvals, checkpoint/restart, idempotency, outbox, human-in-loop and reconciliation.

## Phase 9 — Gateway and channels

Implement canonical gateway/channel routing using the selected OpenClaw/eliza/CWS patterns. Web, WhatsApp, Telegram and device/channel adapters all resolve into one identity/runtime/memory/task system.

This phase must include canonical Device registration/pairing, capability publication and
Character-to-Device assignment contracts required by the Agent Phone direction.

## Phase 10 — Proactivity and perception

Implement schedules/routines/promises/intents, trigger engine, quiet-hours/frequency/privacy gates and permissioned multimodal PerceptionEvents/device-node inputs.

## Phase 11 — Realtime presence and embodiment

Implement selected LiveKit/Pipecat/CyberVerse/AIRI architecture: WebRTC, full-duplex audio/video, turn detection/barge-in, realtime model/STT/TTS adapters, avatar provider and foreground persona/background work.

Implement the Android Agent Device runtime and admit device capabilities through the
canonical Provider path. Integrate OmniSIP behind the telephony DeviceCapability
boundary rather than making it a second runtime or identity system.

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
13. Assigned Agent Phone -> real inbound/outbound cellular call -> same Character and
    relationship continuity -> canonical Operation receipt/reconciliation.
14. Cloud/device Provider choice -> same Skill/Tool contract -> no duplicated identity,
    memory or workflow truth.

## Reference rule

Donor code lives under `references/sources/` only as pinned Git submodules. It is reference material, never a hidden Masanawa dependency.

