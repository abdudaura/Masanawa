# Phase 0B Forensic Coverage — CyberVerse

Pinned revision: Lynpoint/CyberVerse@13a6a95b47e5e6f0809683458767746ad54d7d7f

Status: COVERED AT PINNED REVISION

CyberVerse contributes realtime/presence/task/provider capabilities selected on architectural merit. Masanawa preserves the useful behavior and rewrites it behind canonical contracts where direct implementation reuse is unsuitable.

## Descendant capability matrix

| Family | Implementation/test evidence | State evidence | A/B/C | Canonical Masanawa destination | Clean-room acceptance |
|---|---|---|---|---|---|
| Direct WebRTC pacing/gap/AV correction | server/internal/direct/* + pacing/audio_delay/rtp_gap/negotiation tests | playback/sync state only | A/B | services/presence | generation-scoped AV feedback, bounded correction, real-gap clock advancement, cross-generation reset |
| LiveKit adapter | server/internal/livekit/* tests | room/token adapter state | C/B | services/presence | LiveKit is adopted independently from upstream; CyberVerse only informs observable adapter behavior |
| Media segmentation | server/internal/mediapeer/* tests | segment buffers | C/B | presence/media | segment duration/pacing behavior independently specified |
| Presence orchestration | server/internal/orchestrator/* tests | session/playback/avatar runtime state | A/B | services/presence | audio-only validity, idle/speech supersession, voice sync, startup/visual input and provider degradation |
| Background tasks | server/internal/agenttask/* + store/API tests | task/event/artifact SQLite schema | A/B | packages/workflows + events/storage | ordered events, reconnect cursors, terminal immutability, path-safe artifacts; donor schema retired |
| Inference client contracts | server/internal/inference/* | provider handles only | B | packages/providers | independent typed provider operations under ADR-0010 |
| Inference services/registry | inference/core/* + services/* | provider config/runtime | B | packages/providers | ASR/LLM/TTS/realtime/avatar capabilities remain separable |
| Concrete inference plugins | inference/plugins/**/* | provider-specific sessions/config | C | independent provider adapters only if separately selected | no CyberVerse implementation copied |
| Persona/subagent runtime | inference/plugins/voice_llm/persona/**/* | in-memory task/subagent state | B | agents/workflows | foreground acknowledgement/background worker pattern only; worker never Character identity |
| RAG engine/vector backend | inference/rag/* | Chroma/Milvus per-character projections | B | packages/knowledge + providers | source replacement, normalized relevance, provenance; vector store remains rebuildable projection |
| Pi bridge | inference/pi_bridge/* | bridge process/session | C | gateway/agents reference | no direct dependency; protocol behavior only if independently useful |
| API server | server/internal/api/* tests | donor stores | C/B | apps/services | API organization retired; observable validation behaviors can inform canonical services |
| WebSocket hub/origin | server/internal/ws/* tests | connection registry | B | gateway/presence/security | admission/origin/reconnect behavior reimplemented independently |
| Recording | server/internal/recording/* tests | media files/metadata | B | presence/telemetry/privacy | recording is explicit policy-controlled projection |
| Character store | server/internal/character/* tests | donor local character state | C | packages/identity import/reference | donor Character schema/store is not canonical |
| Provider-specific avatar/video clients | vidus1/xunfeiavatar/baidu paths + tests | provider config/session | C | packages/providers if independently selected | no adoption from CyberVerse copy |
| Frontend | frontend/src/**/* | Vue client stores | C/B | future clients | UI behavior/reference only; no client-owned truth |
| Proto/generated code | proto/* + server/internal/pb + inference/generated | GPL protocol schema/generated code | C | none | do not copy schemas; independently design Masanawa contracts |
| Infra/config | infra/**/* | provider/deploy configuration | C | deploy/provider reference | no architecture ownership |
| MuseTalk embedded tree | models/MuseTalk/**/* | upstream source/model artifacts | C/reference | independent upstream evaluation | local embedded LICENSE indicates MIT source, but CyberVerse copy is not adopted; weights/dependencies separately reviewed |
| SoulX-LiveAct embedded tree | models/SoulX-LiveAct/**/* | upstream source/model artifacts | C | none until upstream review | no local LICENSE in pinned tree; rights not established |
| FlashHead embedded tree | models/flash_head/**/* | upstream source/model artifacts | C | none until upstream review | no local LICENSE in pinned tree; rights not established |
| Tests | tests/**/* + Go/inference/frontend tests | fixtures | evidence | clean-room acceptance suite | observable behavior only |

## Rewrite and parity artifacts

- cyberverse-file-family-manifest.json accounts for all 532 pinned files with zero unresolved paths.
- cyberverse-integration-disposition-manifest.json dispositions all discovered concrete provider/channel/avatar/inference integration files.
- CYBERVERSE-MODEL-PROVENANCE.md separates embedded upstream model rights from CyberVerse's GPL license.
- CYBERVERSE-CLEANROOM-SPEC.md is the migration-facing behavioral specification used when independently implementing selected capabilities.

## State disposition

CyberVerse durable state is evidence only:
- SQLite task/event/artifact state -> canonical packages/workflows/events/storage;
- local character state -> packages/identity import/reference only;
- vector/RAG state -> rebuildable knowledge projections;
- session/media state -> services/presence runtime only;
- frontend stores -> projections only.

No CyberVerse database, directory layout or generated schema survives as canonical Masanawa storage.

## Integration disposition

Concrete ASR/LLM/TTS/realtime/avatar/provider clients are reference-only unless separately selected. LiveKit itself is evaluated/adopted from its upstream repositories, not through CyberVerse. All future provider activation is governed by ADR-0010.

## Provenance boundary

Feature selection is independent of provenance. Valuable CyberVerse behavior remains A/B. Implementation teams use Masanawa-owned contracts and parity tests; direct third-party reuse, if any, is handled separately as compliance metadata.

## Closure

There are no unresolved CyberVerse source families at the pinned revision.

Coverage is complete for Phase 0B at this pin. Changing the source pin reopens forensic coverage; adopting a new concrete third-party implementation separately reopens provenance review.
