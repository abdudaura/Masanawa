# Phase 0B Source Coverage Matrix

Status: ACTIVE
Started: 2026-10-01

Purpose: prove that every meaningful capability in all 17 pinned repositories is classified A/B/C and routed to exactly one canonical Masanawa destination.

This matrix is coverage bookkeeping, not a substitute for the Feature/Behaviour/Data/Integration ledgers. A root is complete only when its meaningful descendants are represented by ledger IDs or explicitly classified C/reference-only.

## Coverage states

- `queued` — root inventoried, descendant classification not yet proven;
- `partial` — major capabilities ledgered, exhaustive descendant proof incomplete;
- `covered` — meaningful descendants mapped to ledger IDs/A-B-C or explicit exclusion;
- `reference-only` — no production capability migration; reason recorded.

Generated/dependency/build metadata roots may be excluded after inspection, but not silently ignored.

## 17-source inventory

| Source | Pinned meaningful roots/modules | Existing Phase 0 evidence | Phase 0B state |
|---|---|---|---|
| ChatWithStars | apps, data, deploy, infra, packages, public, scripts, services, src, supabase | IDN/REL/HND/WLD/DEC/SKL/TOL/LRN/SEC/TSK/COM/SOC/STD/CHN/OPS/CALL + SUB/PRV/KNO/GRP/MSN/CRT/TEL/CVI/LEG/DEP/DAT | covered |
| OpenJarvis | configs, deploy, desktop, examples, frontend, rust, src, tests | AGT/SKL/TOL/SCH/LRN/security/integration rows | partial |
| N.E.K.O | app, brain, config, deps, frontend, knowledge, launcher_core, local_server, main_logic, main_routers, memory, plugin, specs, tests, utils | MEM/PLG/PRO/PER/CUA rows | partial |
| CyberVerse | frontend, inference, infra, models, proto, server, tests | RTC/AVT/TSK/WRK behavior/data/integration rows | partial; GPL clean-room |
| AIRI | apps, bucket, engines, integrations, packages, plugins, server, services | DLF/AVT/PLG/RTC/CUA + integration rows | partial |
| LiveKit Server | cmd, deploy, pkg, test | RTC transport/session integration + ADR-0006 | partial |
| LiveKit Agents TS | agents, examples, plugins, tests | RTC session/turn/avatar rows + ADR-0006 | partial |
| LiveKit Agents Python | livekit-agents, livekit-plugins, examples, tests | maturity/provider reference under ADR-0006 | partial |
| Pipecat | evals, examples, src, tests | RTC pipeline/interruption rows + ADR-0006 | partial |
| Letta | .github + root landing metadata only | historical/landing provenance in LETTA map | reference-only |
| Letta Code | bin, hooks, python, src, vendor | MEM working-context/revision/conflict/shared attachment rows | partial |
| Mem0 | cli, integrations, mem0-ts, mem0, server, skills, tests | MEM extraction/retrieval/entity/temporal/evaluation rows | partial |
| AI Town | convex, data, src | WLD simulation/generation/spatial/interaction rows + ADR-0009 | partial |
| elizaOS | packages, plugins | AGT/PLG component/service/model/provider rows + ADR-0008 | partial |
| Microsoft Agent Framework | declarative-agents, dotnet, go, python | WFL/SKL middleware/checkpoint/HITL rows + ADR-0008 | partial |
| OpenClaw | apps, config, crates, custodian-skills, extensions, packages, qa, security, skills, src, test, ui | GW/DEV/SKL/AGT/MEM/PLG/security rows + ADR-0004/0007/0008 | partial |
| OpenClaw Agent Skills | scripts, skills | SKL-011, EVL-001, DEV-004 + behaviors | partial |

## Required sweep order

The sweep is intentionally not limited to the original four donors.

1. ChatWithStars
2. OpenJarvis
3. N.E.K.O
4. CyberVerse
5. AIRI
6. LiveKit Server
7. LiveKit Agents TypeScript
8. LiveKit Agents Python
9. Pipecat
10. Letta landing repository
11. Letta Code
12. Mem0
13. AI Town
14. elizaOS
15. Microsoft Agent Framework
16. OpenClaw
17. OpenClaw Agent Skills

A later source may add a stronger behavior but does not silently reopen Phase 0A ownership.

## Per-root proof format

For each meaningful root/module, record:
- source path;
- purpose;
- representative implementation/tests;
- Feature Ledger IDs;
- Behaviour Ledger IDs;
- Data Ledger IDs where state exists;
- Integration Ledger IDs where external systems exist;
- A/B/C classification;
- canonical Masanawa destination;
- acceptance/parity evidence;
- license/provenance treatment;
- coverage state.

## Exclusion rules

The following may be marked non-capability after inspection:
- CI/editor metadata;
- generated lockfiles;
- screenshots/static marketing assets;
- build output;
- vendored third-party code already represented by its upstream integration;
- examples that introduce no behavior beyond already-classified production code.

Tests are never ignored merely because they are tests: they are evidence for behavior and parity.

## Completion gate

Phase 0B is complete only when every row above is `covered` or deliberately `reference-only`, and every meaningful root has descendant proof. A source-level `partial` status cannot close Phase 0.

## ChatWithStars root sweep

Pinned revision: `3ab02704118ce3d8f38a423c9a52e9d44a705aeb`.

| Root | Classification / ledger coverage | Canonical treatment | State |
|---|---|---|---|
| `apps/admin` | OPS-001/003-006, SKL-002/007, COM-*, SUB-001, PRV-001, CRT-001 plus admin acceptance tests | rebuild as `apps/ops`; UI/API is not domain truth | covered |
| `data` | DAT-001 | fixtures/reference only after provenance/privacy review | covered |
| `deploy` | DEP-001 | deployment recipes only; no domain/runtime ownership | covered |
| `infra` | DEP-001 + I-GPU-001/002 | provider/deployment adapters where still selected | covered |
| `packages/contracts` | IDN-001/002, agent/voice contracts plus LEG-001 legacy compatibility | split into canonical Masanawa package contracts; legacy names do not survive | covered |
| `public` | DAT-001 | static/SEO/reference media; no canonical state | covered |
| `scripts` | schema/security/canonical-boundary checks support SEC/OPS; seed/eval/setup scripts support DAT/RTC | retain behavior as migration/CI/operator tooling where applicable | covered |
| `services/automation` | SOC-001/003-005, security/token-vault integrations | `services/social` + workflows/providers; Python service boundary does not survive by default | covered |
| `services/calls` | CALL-001..006 + presence integrations | fold behavior behind canonical PresenceSession/CharacterSession; donor WhatsApp browser runtime is not a second presence authority | covered |
| `services/certification` | LRN-003, OPS-003, provider acceptance | certification/acceptance tooling; not a permanent standalone runtime | covered |
| `services/media-studio` | STD-001..006, DAT-001 | `services/studio`; generated project/export artifacts are fixtures, not architecture | covered |
| `services/runtime` | existing IDN/REL/HND/WLD/DEC/SKL/TOL/MEM/LRN/SEC/TSK/COM/CHN rows plus SUB-001, PRV-001, KNO-001, GRP-001, MSN-001, CRT-001, TEL-001, CVI-001 | capabilities split into canonical domain packages/services; monolithic donor runtime does not survive | covered |
| `src` | LEG-001 plus retained fan-facing behavior, identity/chat/voice/payment/channel evidence | old Astro application is retired as an architectural boundary; parity requirements migrate to future Masanawa client surfaces | covered |
| `supabase/functions` | legacy profile update/voice-chat behavior under LEG-001/IDN/CHN | no parallel function-owned domain truth | covered |
| `supabase/migrations` | primary schema/history evidence for identity, relationships, memory, world, workflows, commerce, social, ops | semantic concepts map through Data Ledger; migration filenames/schema are not copied blindly | covered |

### ChatWithStars sweep result

All meaningful top-level roots now have an explicit Phase 0B disposition. New previously underrepresented domains were added as SUB-001, PRV-001, KNO-001, GRP-001, MSN-001, CRT-001, TEL-001 and CVI-001. Legacy/deployment/fixture boundaries are explicitly classified with LEG-001, DEP-001 and DAT-001.

The source is therefore **covered at root/module level**. Individual descendant behavior can still add parity detail later, but no top-level ChatWithStars subsystem is unclassified.
