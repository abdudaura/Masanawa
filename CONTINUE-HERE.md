# Continue Here

This is the mandatory handoff entry point for every new Masanawa implementation session.

## Mission

Build Masanawa as one clean canonical platform from the strongest validated capabilities found across the pinned reference source vault.

Do not recreate donor project boundaries. Do not begin application feature implementation while Phase 0 remains open.

## Mandatory read order

1. `README.md`
2. `docs/VISION.md`
3. `docs/ARCHITECTURE.md`
4. `docs/TECHNOLOGY.md`
5. `docs/SOURCE-OWNERSHIP.md`
6. `docs/REWRITE-PLAN.md`
7. `docs/migration/LANDSCAPE-EXPANSION.md`
8. `docs/migration/SOURCE-LOCK.md`
9. `references/README.md`
10. `references/SOURCES.md`
11. `docs/migration/FORENSICS-METHOD.md`
12. `docs/migration/FEATURE-LEDGER.md`
13. `docs/migration/BEHAVIOUR-LEDGER.md`
14. `docs/migration/DATA-LEDGER.md`
15. `docs/migration/INTEGRATION-LEDGER.md`
16. relevant files under `docs/migration/sources/`.

`docs/migration/LICENSE-LEDGER.md` is compliance/provenance metadata and is **not** part of architectural feature selection.

## Current phase

**Phase 0B — Exhaustive source coverage and A/B/C classification.**

Phase 0A donor selection is closed at the revisions pinned in `docs/migration/SOURCE-LOCK.md`. See `docs/migration/PHASE-0A-CLOSURE-AUDIT.md`.

The earlier four-donor assumption has been intentionally reopened before architecture freeze because broader 2026 open-source projects may provide stronger subsystem skeletons.

### Completed before landscape expansion

- Foundation architecture and technology decisions.
- Exact pinned revisions for the original donors.
- Phase 0 forensic method and normalized migration ledgers.
- ChatWithStars deep pass: character ownership/handoffs, cross-channel continuity, life engine, memory policy, Skill Contract v2, provider/commerce recovery, durable delivery idempotency and call-runtime readiness/race/recovery.
- OpenJarvis deep pass: skill parser/import/dependency/manager, SkillTool adapter, engine discovery/fallback, tool confirmation, SSRF/security, agent loop/budget guards, traces/learning overlays and scheduler semantics.
- N.E.K.O deep pass: memory lifecycle/liveness/dead-letter, foreground persistence, automatic-vs-explicit recall, process-isolated plugin lifecycle/hot reload, proactive-state persistence/repetition control, restricted computer use, optional speaker identity and embodied-interaction memory.
- CyberVerse deep pass: playback epochs/stale-feedback rejection, RTP/AV sync, audio-only mode, avatar idle/speech synchronization, pipeline-generation races, terminal task/event/artifact semantics, reconnectable task events, foreground ACK/background-worker UX, worker allowlists/cancellation/timeouts and avatar warmup policy. CyberVerse remains GPL-clean behavior reference only.
- Remaining ChatWithStars deep pass: tenant-safe social automation/review/cadence/redeploy dedupe, media-studio continuity/render/quality/lipsync, Ops acceptance evidence, privacy-safe observability, emergency kill switches and audited financial adjustments.
- OpenClaw Phase 0A adoption pass complete: Gateway/channel/device-node architecture, one-trust-domain security mismatch, device pairing/reconciliation, durable approvals/current-authority checks, skill distribution/revision/session pinning, session/subagent behavior, steering, tool/plugin policy and memory-authority rules. ADR-0004 records that OpenClaw is the primary Gateway architectural donor but not Masanawa's kernel or public multi-tenant security boundary.
- AIRI Phase 0A adoption pass complete: selected as primary digital-life/embodiment client donor. Captured Stage abstraction, Live2D/VRM/multi-renderer model-driver lifecycle, CCv3/AIRI package import boundary, plugin capability/permission/cleanup semantics, serialized voice-input lifecycle and computer-use lane separation. ADR-0005 explicitly keeps canonical identity/memory/provider/business truth outside AIRI client state.
- Realtime presence Phase 0A comparison complete: LiveKit Server selected for production WebRTC transport, LiveKit Agents TypeScript selected as the primary realtime-session donor, Pipecat retained as a secondary frame/pipeline donor, AIRI retained for embodiment clients, and CyberVerse retained as GPL-clean behavior reference for synchronization/race/audio-only/task UX. ADR-0006 fixes the boundary.
- Memory Phase 0A comparison complete: `packages/memory` selected as sole canonical memory authority; N.E.K.O selected for cognitive lifecycle, Mem0 for extraction/retrieval/evaluation, Letta Code for bounded working context + revision/conflict semantics, and OpenClaw for action-sensitive/compaction/provenance behavior. Canonical PostgreSQL records precede rebuildable vector/lexical/entity/temporal projections. ADR-0007 fixes the boundary. The pinned `letta-ai/letta` repo is a landing/historical pointer; implementation evidence comes from Letta Code.
- Agent runtime/skills/plugins/workflows Phase 0A comparison complete: OpenJarvis selected as structural agent/skills/tools donor, elizaOS as TypeScript component/plugin donor, Microsoft Agent Framework as durable graph/checkpoint/HITL workflow donor, OpenClaw for steering/revision/current-authority semantics, and ChatWithStars for certification plus deterministic business side-effect truth. ADR-0008 fixes canonical ownership in `packages/agents`, `packages/skills`, `packages/plugins`, `packages/tools` and `packages/workflows`.
- AI Town + ChatWithStars world simulation comparison complete: AI Town selected as primary simulation-mechanics donor (ordered inputs, monotonic tick/step time, generation conflict rejection, transactional commits, autonomous/spatial mechanics, liveness); ChatWithStars selected as primary life/canon/governance donor (Constitution gating, routines/story arcs, provenance/visibility, immutable approved canon, tenant/privacy separation). `packages/world` is sole canonical world/life authority. ADR-0009 fixes the boundary.

### Reference source vault added

Masanawa now pins **17 reference repositories** as Git submodules under `references/sources/`:

- ChatWithStars
- OpenJarvis
- N.E.K.O
- CyberVerse
- AIRI
- LiveKit Server
- LiveKit Agents TypeScript
- LiveKit Agents Python
- Pipecat
- Letta Server
- Letta Code
- Mem0
- AI Town
- elizaOS
- Microsoft Agent Framework
- OpenClaw
- OpenClaw Agent Skills

Exact paths, branches, SHAs and licenses are in `docs/migration/SOURCE-LOCK.md` and `docs/migration/LICENSE-LEDGER.md`.

## Completed adoption decisions

### OpenClaw

See `docs/adr/0004-openclaw-adoption-boundary.md` and `docs/migration/OPENCLAW-ADOPTION-BOUNDARY.md`.

Selected as primary Gateway/channel/device-node architectural donor, not Masanawa kernel or public multi-tenant security boundary.

### AIRI

See `docs/adr/0005-airi-digital-life-adoption-boundary.md` and `docs/migration/AIRI-ADOPTION-BOUNDARY.md`.

Selected as primary architectural donor for digital-life clients/embodiment. It does not own canonical Character identity, memory, world/task truth or realtime transport.

### Realtime presence

See `docs/adr/0006-realtime-presence-adoption-boundary.md` and `docs/migration/PRESENCE-ADOPTION-BOUNDARY.md`.

Selected composition:
- LiveKit Server — WebRTC/media transport;
- LiveKit Agents TypeScript — primary live agent-session/turn runtime;
- Pipecat — secondary frame/pipeline processor donor;
- AIRI — client Stage/embodiment;
- CyberVerse — clean-room synchronization/race/audio-only/background-task behavior.

Stable boundary is Masanawa `PresenceSession` + CharacterSession bridge, not donor object models.

### Memory

See `docs/adr/0007-memory-architecture-adoption-boundary.md` and `docs/migration/MEMORY-ADOPTION-BOUNDARY.md`.

Selected composition:
- `packages/memory` — sole canonical authority;
- N.E.K.O — cognitive lifecycle/liveness/reflection donor;
- Mem0 — extraction/hybrid retrieval/entity-temporal/evaluation donor;
- Letta Code — working-context/revision/conflict/shared-attachment donor;
- OpenClaw — action-sensitive/compaction/provenance donor.

No donor memory store or agent/workspace object owns canonical truth.

### Agent runtime, skills, plugins and workflows

See `docs/adr/0008-agent-runtime-skills-plugins-workflows.md` and `docs/migration/RUNTIME-SKILLS-WORKFLOW-ADOPTION-BOUNDARY.md`.

Selected composition:
- OpenJarvis — agent strategy/guards, tools and structural SkillManager/executor;
- elizaOS — TypeScript component/plugin runtime;
- Microsoft Agent Framework — durable graph/checkpoint/HITL workflow semantics;
- OpenClaw — steering/subagent/session policy, skill revision pinning and current-authority checks;
- ChatWithStars — skill governance and deterministic business side-effect/reconciliation rules.

Donor Agent/runtime/checkpoint objects never become Character, memory or business truth.

## Immediate next work

Phase 0A is complete. Phase 0B is in remediation because the first root-level sweeps overstated coverage.

1. Read `docs/migration/PHASE-0B-REMEDIATION.md` before doing any further source sweep.
2. ChatWithStars remediation is complete at the pinned revision:
   - descendant runtime/domain proof: `docs/migration/coverage/CHATWITHSTARS.md`;
   - all 381 migrations accounted for with zero unresolved entries;
   - provider behavior normalized through ADR-0010 and `CHATWITHSTARS-INTEGRATIONS.md`.
3. OpenJarvis remediation is complete at its pinned revision: descendant evidence, exhaustive Python/Rust manifests, integration dispositions and native parity boundary are under `docs/migration/coverage/`.
4. N.E.K.O remediation is complete at its pinned revision: descendant evidence, exhaustive file manifest, integration dispositions and plugin-authority map are under `docs/migration/coverage/`.
5. CyberVerse remediation is complete at its pinned revision under strict GPL clean-room rules; coverage, manifests, model provenance and clean-room acceptance specs are under `docs/migration/coverage/`.
6. AIRI exhaustive descendant coverage is complete at its pinned revision: 5,697-file manifest, 483 integration dispositions, client-state authority map and descendant behavior matrix are under `docs/migration/coverage/`.
7. LiveKit Server exhaustive descendant coverage is complete at its pinned revision: 429-file manifest, transport integration dispositions and transport invariants are recorded under `docs/migration/coverage/`.
8. LiveKit Agents TypeScript exhaustive descendant coverage is complete: 1,042-file manifest, 522 plugin dispositions, live-session state concepts and turn/interruption/handoff invariants are under `docs/migration/coverage/`.
9. LiveKit Agents Python parity/delta coverage is complete: 1,472-file manifest, 750 plugin dispositions, realtime failover, diarization, evaluation and telemetry privacy deltas are recorded without creating a second runtime.
10. Pipecat exhaustive descendant coverage is complete: 1,820-file manifest, 275 integration dispositions, speculative-turn, interruptibility, context-commit and pause/resume liveness invariants are recorded.
11. **Next:** verify the Letta landing repository is reference-only, then sweep Letta Code exhaustively as the implementation donor.
6. No source may be marked `covered` from root names, filename counts or generic family assertions alone.
7. Every retained capability must have exact implementation/test evidence, durable-state mapping, integration failure semantics, one canonical owner and an observable acceptance/parity gate.

## World simulation comparison — completed

ADR-0009 and `docs/migration/WORLD-SIMULATION-ADOPTION-BOUNDARY.md` decide:
- `packages/world` is the sole canonical world/life authority;
- AI Town supplies simulation-engine mechanics, not canonical domain objects;
- ChatWithStars supplies life-state/canon/governance semantics;
- durable world generations/claims replace process-local overlap locking;
- simulation time, wall-clock time, validity time and recorded time remain distinct;
- spatial simulation is optional;
- private relationship memory cannot mutate shared canon;
- memory, workflows, identity and presence consume world contracts without becoming world authority.

## Memory comparison — completed

ADR-0007 and `docs/migration/MEMORY-ADOPTION-BOUNDARY.md` decide:
- canonical memory record and scope model;
- relationship/private/shared/world separation;
- write/extraction lifecycle;
- provenance/evidence/confidence;
- working-context blocks versus durable memory;
- retrieval, entity/temporal indexing and reranking;
- reflection/consolidation/compaction;
- deletion/retention/tombstones;
- rebuildable vector/graph indexes;
- proactive memory recall versus explicit retrieval;
- evaluation/quality measurement;
- which donor components are safe to reuse directly versus adapt behind `packages/memory`.

Decision: `packages/memory` owns canonical scoped PostgreSQL records, provenance, lifecycle and context compilation. N.E.K.O/Letta Code/Mem0/OpenClaw are bounded donors only. Masanawa's type+scope privacy model remains non-negotiable.

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
- Channels/device nodes are adapters, not alternate brains.
- Characters are domain entities, not prompts or agent classes.
- Providers/models/UIs never own business truth.
- Consequential side effects require deterministic validation, authorization, idempotency, reconciliation and audit.
- Private relationship memory never silently becomes shared character/world truth.
- Reference submodules are never production imports.
- No donor repository becomes a hidden runtime boundary.
- Licensing/provenance never decides feature survival. Useful donor capabilities remain A/B and are independently rewritten when direct reuse is unsuitable.
- Nothing is migrated without ledger evidence.

## Definition of done for Phase 0A — achieved 2026-10-01

Closure evidence: `docs/migration/PHASE-0A-CLOSURE-AUDIT.md`.

Phase 0A finished because:
- every expanded donor has a source map;
- its major relevant capabilities are represented in the ledgers;
- licenses/provenance are verified;
- the required cross-donor comparisons are complete;
- `docs/SOURCE-OWNERSHIP.md` no longer contains unresolved primary-candidate conflicts for foundation subsystems;
- donor decisions are recorded in ADRs where necessary.

## Definition of done for full Phase 0

Every meaningful capability in the pinned reference vault is classified:
- **A — preserve behaviour**
- **B — preserve capability, redesign implementation**
- **C — reference/retire explicitly**

Every retained capability has one canonical Masanawa destination and an acceptance/parity strategy.

## If context is missing

Do not ask the user to repeat previous discussions. The repository, source lock and reference vault are the source of truth.
