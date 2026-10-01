# Continue Here

This is the mandatory handoff entry point for every new Masanawa implementation session.

## Current mission

Build Masanawa from the ground up as one clean platform that delivers the validated union of:
1. `Baatiku/chatwithstars`
2. `open-jarvis/OpenJarvis`
3. `Project-N-E-K-O/N.E.K.O`
4. `Lynpoint/CyberVerse`

Do **not** merge those repositories into this repository. They are source references and architecture donors.

## Mandatory read order

Before changing code:
1. `README.md`
2. `docs/VISION.md`
3. `docs/ARCHITECTURE.md`
4. `docs/TECHNOLOGY.md`
5. `docs/SOURCE-OWNERSHIP.md`
6. `docs/REWRITE-PLAN.md`
7. `docs/migration/SOURCE-LOCK.md`
8. `docs/migration/FORENSICS-METHOD.md`
9. `docs/migration/FEATURE-LEDGER.md`
10. `docs/migration/BEHAVIOUR-LEDGER.md`
11. `docs/migration/DATA-LEDGER.md`
12. `docs/migration/INTEGRATION-LEDGER.md`
13. `docs/migration/LICENSE-LEDGER.md`
14. all four files under `docs/migration/sources/`.

## Current phase

**Phase 0 — Source forensics and completeness inventory.**

### Completed
- Foundation architecture and technology decisions.
- Exact pinned donor revisions.
- Phase 0 forensic method.
- Pass 1 repository source maps for all four donors.
- First normalized expansion of feature, behavior, data and integration ledgers.

### Not yet complete
The ledgers are NOT exhaustive. Do not begin Masanawa application feature implementation yet.

## Immediate next work

Continue Phase 0 Passes 2–6, source by source, using the source-map follow-up sections.

Recommended order:
1. ChatWithStars deep mine: runtime, calls, migrations, automation, studio, Ops.
2. OpenJarvis deep mine: agents, skills/import/security, tools, scheduler, traces/learning, memory.
3. N.E.K.O deep mine: memory tests, plugins, proactivity, character/avatar, perception/computer use, voice.
4. CyberVerse deep mine: WebRTC/media tests, Persona/SubAgent, task store/recovery, avatar sync, visual input.

For each pass, update all affected ledgers and source-map coverage notes in the same PR.

## Non-negotiable rules

- One identity system.
- One memory system.
- One skill system.
- One tool registry.
- One agent execution framework.
- One provider registry.
- One event model.
- One task/workflow engine.
- One world model.
- Channels are adapters, not alternate brains.
- Characters are domain entities, not prompts or agent classes.
- Providers never own domain truth.
- UI never owns business truth.
- Consequential side effects require deterministic validation, authorization, idempotency and auditability.
- Private relationship memory never becomes shared character/world truth accidentally.
- No legacy directory may be copied wholesale.
- No temporary second runtime is allowed.
- CyberVerse GPL code must not be copied into Masanawa core without an explicit licensing ADR and review.
- Nothing is considered migrated without a ledger row and parity/acceptance evidence.

## Definition of done for Phase 0

Phase 0 finishes only when every meaningful subsystem/feature in the four pinned sources is represented in the ledgers and classified:
- **A — preserve behaviour**
- **B — preserve capability, redesign implementation**
- **C — reference/retire explicitly**

Every overlap must have a donor decision and a Masanawa destination.

## If context is missing

Do not ask the user to repeat prior conversations. The repository is the source of truth. Read these docs, inspect the pinned source revisions and continue from the active phase.
