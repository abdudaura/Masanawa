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

## OpenClaw is a major donor

Do not treat OpenClaw as only a skill source. It must be deep-mined for:

- Gateway/control-plane architecture;
- 20+ channel adapters and account bindings;
- per-agent workspace/session isolation;
- device nodes for microphone/camera/screen/local actions;
- multi-agent routing/team/delegation;
- model/tool/plugin swapping;
- active-run steer/followup/collect/interrupt semantics;
- skill precedence, install/update/verify/workshop/ClawHub distribution;
- local-first credentials/state;
- sandbox/security/approval/operator controls;
- memory search, action-sensitive memory, compaction flush, dreaming and memory-wiki;
- cron/intents and durable automation.

Its Markdown/SQLite personal-assistant storage model is **not** Masanawa's canonical data model.

## Immediate next work

Do not return to the old four-source coverage-proof plan yet.

1. Deep-mine OpenClaw and update all affected ledgers.
2. Deep-mine AIRI for digital-life/embodiment/client architecture.
3. Compare LiveKit Server/Agents + Pipecat + CyberVerse + AIRI for realtime presence/embodiment.
4. Compare Letta + Mem0 + N.E.K.O + OpenClaw for memory architecture.
5. Compare OpenJarvis + elizaOS + Microsoft Agent Framework + OpenClaw for agent runtime, skills, plugins and workflows.
6. Compare AI Town + ChatWithStars for world simulation.
7. Produce explicit donor decisions/ADRs and freeze provisional subsystem ownership.
8. Only then continue Phase 0B exhaustive source coverage and A/B/C classification across the complete reference vault.

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
