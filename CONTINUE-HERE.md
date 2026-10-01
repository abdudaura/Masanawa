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
16. `docs/migration/LICENSE-LEDGER.md`
17. relevant files under `docs/migration/sources/`.

## Current phase

**Phase 0A — Landscape Expansion and donor selection.**

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

## Immediate next work

Do not return to the old four-source coverage-proof plan yet.

1. Compare Letta + Mem0 + N.E.K.O + OpenClaw for memory architecture and record the memory ADR.
2. Compare OpenJarvis + elizaOS + Microsoft Agent Framework + OpenClaw for agent runtime, skills, plugins and workflows.
3. Compare AI Town + ChatWithStars for world simulation.
4. Produce remaining explicit donor decisions/ADRs and freeze provisional subsystem ownership.
5. Only then continue Phase 0B exhaustive source coverage and A/B/C classification across the complete reference vault.

## Memory comparison questions

The next pass must decide:
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

Masanawa's existing type+scope privacy model remains non-negotiable.

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
- CyberVerse GPL code is reference-only by default.
- Nothing is migrated without ledger evidence.

## Definition of done for Phase 0A

Phase 0A finishes only when:
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
