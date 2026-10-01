# Phase 0B Forensic Coverage — N.E.K.O

Pinned revision: Project-N-E-K-O/N.E.K.O@48ac9243a9d8e75a37d7598548c29017df1c6d2e

Status: ACTIVE REMEDIATION

This file replaces the invalid earlier root-only coverage claim.

## Canonical synthesis rule

N.E.K.O contributes strong cognitive-memory, plugin isolation, proactivity, voice-turn, device-activity and computer-use behavior. Masanawa does not preserve N.E.K.O's server/process topology, JSON/file stores as canonical truth, its plugin runtime as a parallel identity/memory/workflow system, its character JSON as canonical Character identity, bundled provider/model assets by default, or its frontend/runtime as mandatory application architecture.

## Descendant capability matrix

| Family | Implementation evidence | Test evidence | Durable/state evidence | A/B/C | Canonical destination | Acceptance/parity gate |
|---|---|---|---|---|---|---|
| Memory foreground durability | app/memory_server/post_turn.py, runtime.py, outbox_infra.py; memory/recent.py, event_log.py, outbox.py | tests/unit/test_memory_server_cache_settle.py + memory outbox/event tests | recent/original-event/outbox state | A | packages/memory + events/workflows | completed Turn + ingest event durable before async cognition; stale/deleted recent-history identity aborts downstream mismatch |
| Memory liveness/dead-letter | memory server evidence/refine loops + cursors/outbox | test_memory_liveness_dead_letter.py | attempt/progress/dead-letter state | A | memory/workflows | poison item cannot stall partition forever; terminal repeated failure advances liveness while preserving needs-attention evidence |
| Facts/reflections/persona pipeline | memory/facts.py, fact_dedup.py, reflection/**, persona/**, evidence.py | fact/reflection/persona/evidence tests | fact/reflection/persona artifacts | B | memory | evidence-backed extraction/promotion retained; per-character storage replaced by scoped canonical MemoryRecord/Scope |
| Automatic context vs explicit recall | memory/recall.py, recall_render.py, hybrid_recall.py, persona rendering | recall/render/hybrid/embedding-fallback tests | derived retrieval/index state | A/B | memory | automatic bounded context compiler distinct from user/tool recall; retrieval failure degrades without broader-scope exposure |
| Memory subject/identity/trust | memory/identity.py, subject_identity.py, speaker_trust.py, trust_store.py, user_directives.py | identity/trust/directive tests | donor trust/directive state | C/B | identity/security/memory | donor subject IDs never become canonical Masanawa identity |
| Embedding/reflection model assets | memory/_embeddings/**, endpoint/speaker model manifests | asset-manifest/distribution/real-model tests | model files/manifests | C/B | providers/model registry | each artifact independently licensed/provenanced |
| Plugin host/process isolation | plugin/core/host.py, communication.py, zmq_transport.py, plugin/server/lifecycle.py | plugin lifecycle/reload/install tests | runtime intent, registry, config | A/B | packages/plugins runtime | crash/reload/stop isolated; intentionally stopped plugin never resurrects; shutdown rejects new starts |
| Plugin hot replacement/install transaction | plugin/server/application/plugins/installation_transactions/**, hot_reload_service.py, operation_lock.py, source_switch.py | plugin installation/reload/ownership tests | D-PLG-020 | A/B | plugins + workflows/security | preflight failure preserves healthy version; replacement serialized; rollback/ownership evidence retained |
| Plugin message plane | plugin/message_plane/**, plugin/core/message_plane_transport.py, messaging handlers/plane bridge | plugin messaging/RPC/pubsub tests | D-PLG-021 trace only | A/B | plugins/events | typed validation, bounded call chain, deadlock/circular calls fail explicitly; messages never become domain truth |
| Plugin SDK | plugin/sdk/** plugin/adapter/shared runtime/contracts | SDK/plugin tests | package-local state | B | plugin SDK | plugins register canonical tools/skills/providers/events only; cannot own identity/memory/workflow truth |
| Plugin CLI/distribution | plugin/neko_plugin_cli/**, server plugin_cli/install-source services | CLI build/check/install/release tests | package/build/source metadata | B/C | developer tooling + plugins | source/provenance/validation retained; marketplace does not imply production trust |
| Agent server capability bridges | app/agent_server/** incl browser_use/computer_use/mcp/openclaw/user_plugin channels | agent server/capability tests | runtime tracker only | C/B | agents/tools/gateway adapters | bridges translate into canonical capability/tool contracts; donor server not retained |
| Computer-use safety | brain/computer-use channel + restricted execution helpers | tests/unit/test_computer_use_hardening.py + capture lifecycle/bridge tests | exclusive device lease/evidence | A/B | tools + perception/security | restricted action language/AST; arbitrary imports/reflection blocked; input cleanup guaranteed before completion; desktop serialized |
| ASR provider runtime | main_logic/asr_client/runtime.py, lifecycle.py, provider_policy.py, delivery.py, workers/** | ASR runtime/provider/worker tests | D-ASR-001 | B | presence + providers | provider-neutral voice candidate lifecycle; provider workers behind ADR-0010; stale result cannot deliver |
| Endpointing/VAD | main_logic/asr_client/endpointing/** | 18 endpointing tests incl real-model/build/distribution | D-ASR-002 | A/B | presence | endpoint reason/evidence preserved; model assets independently licensed |
| Speaker-shadow recognition | main_logic/asr_client/speaker_shadow/** | 9 speaker-shadow tests + authority test | speaker evidence trace | C/B | security/presence | recognition is advisory evidence, never authentication authority |
| Voice-input lifecycle | main_logic/voice_input/** | voice input/wake-word tests | active binding/suppression ephemeral state | A/B | presence/client | binding generation serialized; suppression/enrollment cleanup safe; stale callbacks cannot reactivate closed binding |
| Voice identity/security | main_logic/voice_identity_service/** + app/main_server/voice_identity_runtime.py | 32 voice identity tests | D-SPK-001/002 | B with A safety | security + presence | policy revision guards stale work; enrollment cancellation restores input and wipes sensitive state; recognition never sole auth |
| Voice turn/activity evidence | main_logic/voice_turn/** | voice-turn activity tests | ephemeral turn evidence | B | presence | turn evidence supports endpoint/policy decisions but not durable identity |
| Proactivity domain | main_logic/proactive_chat/candidate_selection.py, sources.py, decisions.py, generation.py, delivery.py, state.py, service.py | 27 proactive tests | D-PRO-001/002 | A/B | proactivity | source/candidate/decision/generation/delivery separate; anti-repeat/backoff survives restart; user/privacy/frequency policy gates contact |
| Activity/focus perception | main_logic/activity/** | activity guess/signal/narration/followup tests | D-ACT-001 | B with A privacy | perception | visible/private/unavailable state preserved; private/unavailable cannot be silently enriched into proactive context |
| Main conversation runtime | main_logic/core/** turn/streaming/tool-calling/context/focus/TTS/ASR | core/runtime integration tests | ephemeral session/context | C/B | CharacterSession/agents/presence | orchestration ideas only; no donor manager becomes canonical runtime |
| Realtime/offline omni clients | omni_realtime_client/** and omni_offline_client/** | realtime/offline/proactive tests | provider session state | C/B | presence provider adapters | provider protocol/session behavior behind selected LiveKit/Masanawa boundary |
| TTS/media | main_logic/tts_client/**, utils/tts/**, image generation/audio helpers | TTS/media tests | provider config/cache | C/B | providers/media | interface/reference unless provider independently selected |
| Character runtime/config | config/characters/**, character fields/defaults/prompts, app/main_server/character_runtime.py | character runtime/config/avatar tests | JSON/config files | C/B | identity import/reference | useful fields import into versioned identity; donor files never Character truth |
| Avatar/embodiment | frontend React chat/avatar modules, PNGTuber packs, avatar routers/importers | 39 avatar tests + interaction-memory contract | client state/assets | B/C | clients/embodiment + identity | renderer behavior selectively retained; identity/appearance refs canonical; assets separately licensed |
| Embodied event -> memory | avatar interaction payload/memory paths | test_avatar_interaction_memory_contract.py + payload/local interaction tests | memory candidates with dedupe rank | A/B | perception -> memory | only direct event facts eligible; generated chatter excluded; bounded duplicate strengthening allowed |
| Watch-together/media experience | main_logic/watch_together/** + game/router frontend | 25 watch-together tests | session/media state | C/B | optional extension/plugin/skill | optional experience cannot become world/session/memory authority |
| Mini-game/music extensions | mini_game SDK, game routers, proactive invites/music recommenders | game/frontend tests | optional extension state | C/B | optional extensions | same canonical identity/session/tool boundaries |
| Cloud/config lifecycle | utils/cloudsave_runtime/** + config manager/router | 10 cloudsave tests | D-CFG-001/002 | A/B | config/storage | staged/fenced migration; stale/partial restore cannot replace newer verified config |
| QQ/OneBot connection adapters | utils/connection/** | connection/router tests | adapter/session config | C/B | Gateway adapters | reference unless independently selected; must pass Gateway/ADR-0010 certification |
| Generic LLM clients | utils/llm_client/** + plugin model gateway | provider/client tests | provider config/history/cache | C/B | providers | collapse into canonical provider registry; duplicated donor clients not preserved |
| Telemetry/survey local servers | local_server/telemetry_server/** + survey_server/** | telemetry/survey tests | local feedback/metrics data | C/B | telemetry/feedback | optional consented telemetry/feedback only |
| Knowledge/corpora | knowledge/** | knowledge tests where present | corpus files | C | fixtures/reference | no bundled knowledge imported without provenance/content rights |
| Vendored dependencies | deps/rapidocr_pillow/** and bundled model assets | distribution/artifact tests | vendored binaries/models | C | none/direct upstream evaluation | independent license/provenance mandatory |
| Routers/API surface | main_routers/** characters/game/system/workshop/config | router tests | donor stores | C/B | apps/services adapters | API organization not canonical; routes call package owners only |
| Launcher/bootstrap | launcher_core/** + app entry/preload/process utilities | startup/lifecycle tests | local process/config | C/B | deployment/client bootstrap | operational behavior only |
| Frontend/plugin manager | frontend/plugin-manager/** + react-neko-chat/** | 114 frontend tests | client state | C/B | future clients/Ops | UI behavior/reference; donor shells are not architecture |
| Specs/docs/config changelog/prompts/surveys | specs/** + config/** + docs | behavior-backed tests where present | declarative/reference artifacts | C/B | imports/fixtures/docs | prompts/config are not identity authority |
| Full test tree | tests/** (1200 files) | itself | fixtures/temp data | evidence | acceptance/parity design | tests remain behavior evidence even for retired implementations |

## Strong merge decisions

### Memory is cognitive machinery, not storage authority
Adopt lifecycle/evidence/liveness/context-vs-recall behavior and rebuild on ADR-0007 scoped PostgreSQL records.

### Plugin runtime is packaging and isolation only
Retain isolation, hot-reload safety, message-plane validation, call-chain limits and transactional replacement. Plugins register canonical components and never own parallel memory/identity/workflow truth.

### Voice identity remains optional evidence
Speaker recognition is not sufficient authentication. Scores/profile matches are security evidence combined with explicit policy and stronger authentication for consequential operations.

### Activity/proactivity remain privacy-separated
Device/system signals first become permission-scoped PerceptionEvents. Proactivity consumes only admitted projections. A model cannot infer around a private or unavailable state.

### Optional experiences do not expand the kernel
Watch-together, games and music are examples of embodied character experiences implemented as skills/plugins/extensions over canonical contracts.

## License/provenance

Repository code is Apache-2.0 at the pinned revision, but bundled OCR/model/corpus/binary assets keep their own licenses. Model manifests and THIRD_PARTY_NOTICES are evidence, not permission to redistribute every artifact.

## Closure evidence

**COVERED at pinned revision.**

- `neko-file-family-manifest.json` accounts for all 4,947 pinned files with zero unresolved paths.
- `neko-integration-disposition-manifest.json` dispositions 121 concrete ASR/TTS/LLM/channel/model-gateway/realtime/image/Steam integration files; structural contracts may migrate, concrete adapters remain C/B unless independently selected and certified.
- `NEKO-PLUGIN-AUTHORITY.md` maps plugin registry/runtime/config/message/storage/approval/UI/provider state to canonical Masanawa owners and forbids the plugin server becoming a second platform kernel.
- the descendant matrix above attaches implementation, tests, state, A/B/C treatment, canonical destination and behavioral parity gates for retained families.
- third-party model/OCR/corpus/binary assets remain independently licensed/provenanced and are not implicitly adopted.

This closure is revision-specific. Changing the N.E.K.O pin reopens file, integration, asset and plugin-authority verification.
