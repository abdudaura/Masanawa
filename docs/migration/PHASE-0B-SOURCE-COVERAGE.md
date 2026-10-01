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
| OpenJarvis | configs, deploy, desktop, examples, frontend, rust, src, tests | AGT/SKL/TOL/SCH/LRN + PRV/INT/CON/SBX/OBS/SES/SPH/CLI/RCP/RST | covered |
| N.E.K.O | app, brain, config, deps, frontend, knowledge, launcher_core, local_server, main_logic, main_routers, memory, plugin, specs, tests, utils | MEM/PLG/PRO/PER/CUA + VOI/ACT/CFG/EXT/OBS/AST/AVT/MED/CHN | covered |
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

## OpenJarvis root sweep

Pinned revision: `c4da16e1ca3d21f4cc1905d4200063e564104f0f`.

| Root/module family | Classification / ledger coverage | Canonical treatment | State |
|---|---|---|---|
| `configs` | AGT/SKL/TOL/SCH + RCP-001 | configuration/examples inform schemas and fixtures; donor persona prompts are not Character identity | covered |
| `deploy` | CLI-001/RST-001 | deployment recipes are ops evidence only | covered |
| `desktop` + `frontend` | CLI-001, OBS-001, SPH-001 | UX/ops behavior may migrate; Tauri/React donor shell is not mandatory architecture | covered |
| `examples` | RCP-001 plus connector/scheduler/tool behaviors | parity/reference fixtures; no example becomes a product boundary | covered |
| `rust` | AGT/SKL/TOL/LRN/SCH + PRV-002/INT-001/RST-001 | preserve algorithms/behavior where stronger; no duplicate Rust authority; native acceleration only behind canonical contracts | covered |
| `src/openjarvis/agents` | AGT rows + SES-001 | `packages/agents` | covered |
| `analytics`, `bench`, `evals`, `telemetry`, `traces`, `learning`, `mining` | LRN + OBS-001 | telemetry/evaluation/learning; learning cannot self-promote production truth | covered |
| `channels` | CHN/Gateway comparison evidence | channel adapters behind Masanawa Gateway | covered |
| `connectors` | CON-001 | `packages/connectors` with scoped ingestion | covered |
| `core`, `system`, `intelligence`, `prompt` | AGT + PRV-002 | canonical agent/provider contracts; prompts are compiled inputs, not identity | covered |
| `engine` | PRV-002 | provider/engine adapters behind `packages/providers` | covered |
| `mcp`, `a2a` | INT-001 + I-INT-001/002 | interoperability adapters only | covered |
| `memory` | memory comparison secondary evidence | canonical `packages/memory`; OpenJarvis store is not authority | covered |
| `operators`, `cli`, `daemon`, `server`, `sdk.py` | CLI-001 | operator/SDK surfaces over canonical services | covered |
| `recipes`, `templates`, `workflow` | RCP-001 + workflow rows | templates/imports; durable workflows remain `packages/workflows` | covered |
| `sandbox`, `security` | TOL/security + SBX-001 | platform security/tool execution policy | covered |
| `scheduler` | SCH rows | scheduling trigger into workflows/proactivity, not business truth | covered |
| `sessions` | SES-001 | runtime session state only | covered |
| `skills` | SKL rows | `packages/skills` | covered |
| `speech` | SPH-001 | media/provider adapters | covered |
| `tools` | TOL rows | `packages/tools` | covered |
| `tests` | behavior/parity evidence across every family | retained as evidence source; Masanawa acceptance fixtures derived by behavior | covered |

### OpenJarvis sweep result

Every production module family and top-level root now has an explicit disposition. New cross-cutting coverage records provider engines, interoperability, connectors, sandboxing, observability, runtime sessions, speech/operator surfaces and the Rust/Python duplication boundary.

## N.E.K.O root sweep

Pinned revision: `48ac9243a9d8e75a37d7598548c29017df1c6d2e`.

| Root/module family | Classification / ledger coverage | Canonical treatment | State |
|---|---|---|---|
| `app` | AGT/PLG/MEM + VOI/CFG | donor server/process split is not retained; capabilities enter canonical packages/services | covered |
| `brain` | CUA/PER/PLG + tool execution | bounded computer/browser/plugin task adapters behind tools/security | covered |
| `config` | IDN/PRO/provider settings + CFG-001 | typed config/import defaults only; prompt/character JSON is not canonical Character truth | covered |
| `deps` | AST-001 | vendored wheels/OCR/models require independent provenance; no implicit reuse | covered |
| `frontend/plugin-manager` | PLG-011/012 | plugin Ops/DX surface may be rebuilt; Vue UI is not canonical | covered |
| `frontend/react-neko-chat` | DLF/AVT/VOI/EXT | client interaction reference only; no client-owned domain truth | covered |
| `frontend/pngtuber-packs` | AVT-010/AST-001 | optional embodiment assets after provenance review | covered |
| `knowledge` | AST-001 + memory/knowledge evidence | corpora are reference fixtures only; no bundled knowledge inherited automatically | covered |
| `launcher_core` | CFG/OPS lifecycle | startup/bootstrap behavior only | covered |
| `local_server/survey_server` | OBS-002 | optional consented feedback service; not core | covered |
| `local_server/telemetry_server` | OBS-002 | canonical telemetry contract if retained; donor server not required | covered |
| `main_logic/asr_client`, `voice_input`, `voice_turn`, `voice_identity*` | VOI-001/002 | presence/media provider pipeline; speaker signal not authentication | covered |
| `main_logic/activity`, `proactive_chat`, `topic` | ACT-001 + PRO rows | perception -> policy-gated proactivity | covered |
| `main_logic/core`, realtime/offline clients | agent/presence/provider behavior | canonical agent/presence/provider boundaries | covered |
| `main_logic/watch_together`, mini-game/music/game helpers | EXT-001 | optional extension/plugin/skill experiences | covered |
| `main_routers/characters_router` | IDN + AVT-010 + VOI-002 | imports/configuration feed `packages/identity`; router is not authority | covered |
| `main_routers/game_router` and game/media routers | EXT-001 | optional extensions, not world kernel | covered |
| `main_routers/system_router`, proactive/capture routes | PRO/PER/CUA/ACT | canonical perception/proactivity/security contracts | covered |
| `memory` | MEM rows + ADR-0007 | cognitive lifecycle donor into sole `packages/memory` authority | covered |
| `plugin` | PLG rows + PLG-011/012 | component packaging/isolation/DX donor behind `packages/plugins` | covered |
| `specs` | launcher packaging | build/reference only | covered |
| `tests` | parity evidence for all retained families | behavior evidence; not ignored | covered |
| `utils/cloudsave_runtime`, config/storage | CFG-001 | canonical config/storage adapters | covered |
| `utils/connection` | CHN-010 | Gateway channel adapters | covered |
| `utils/tts`, image generation, audio/media | MED-001 | provider/media adapters only | covered |
| remaining `utils` | security/network/document/storage/language helpers mapped to existing security/provider/knowledge/config families | reuse only behind canonical owners | covered |

### N.E.K.O sweep result

All top-level roots and major descendant families have an explicit disposition. The sweep adds voice-turn endpointing, speaker-evidence boundaries, activity sensing, config/cloud-save migration, plugin distribution/message-plane mechanics, optional experience extensions, telemetry feedback, embodiment/provider adapters and explicit third-party artifact licensing.
