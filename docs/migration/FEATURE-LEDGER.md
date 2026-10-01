# Feature Ledger

Status: Phase 0 working document.

Purpose: exhaustive inventory of every meaningful capability across the pinned reference source vault.

## Required fields

| Field | Meaning |
|---|---|
| ID | Stable Masanawa migration ID |
| Domain | Canonical Masanawa domain |
| Feature | Human-readable capability |
| Source | Source repository |
| Source refs | Files/docs/tests that prove behavior |
| Maturity | prototype / working / production-oriented |
| Class | A preserve / B redesign / C retire |
| Donor role | primary / secondary / reference |
| Masanawa destination | canonical package/service |
| Dependencies | capabilities/data/providers |
| Behavior IDs | links to BEHAVIOUR-LEDGER |
| Data IDs | links to DATA-LEDGER |
| Integration IDs | links to INTEGRATION-LEDGER |
| License note | relevant provenance/license |
| Status | migration lifecycle |
| Evidence | tests/PRs/commits after implementation |
| Notes | conflicts, risks, decisions |

## Domain taxonomy

foundation, identity, relationships, memory, world, decisions, agents, skills, tools, workflows, perception, proactivity, presence, avatar, channels, social, commerce, studio, plugins, learning/evaluation, security, operations, observability, infrastructure, developer experience.

## Current normalized inventory

| ID | Domain | Feature | Source | Class | Donor role | Masanawa destination | Status |
|---|---|---|---|---|---|---|---|
| IDN-001 | identity | versioned character identity/Constitution | ChatWithStars | A | primary | packages/identity | analysed |
| IDN-002 | identity | stable voice/appearance locks | ChatWithStars | A | primary | packages/identity | analysed |
| IDN-003 | identity | configurable companion/persona character fields | N.E.K.O | B | secondary | packages/identity | discovered |
| REL-001 | relationships | private user-character relationship memory | ChatWithStars | A | primary | packages/memory + identity | analysed |
| REL-002 | relationships | per-character language/modality preferences | ChatWithStars | A | primary | packages/identity + memory | analysed |
| HND-001 | relationships | bounded named-character handoff envelope | ChatWithStars | A | primary | packages/workflows + runtime | analysed |
| HND-002 | relationships | return-to-source and completion-with-durable-evidence | ChatWithStars | A | primary | packages/workflows | analysed |
| WLD-001 | world | shared character life state/events | ChatWithStars | A | primary | packages/world | analysed |
| WLD-002 | world | routines/story arcs/character relationships | ChatWithStars | A | primary | packages/world | analysed |
| WLD-003 | world | timezone-aware idempotent life-engine routine events | ChatWithStars | A | primary | packages/world + workers | analysed |
| DEC-001 | decisions | typed bounded JEV decision fabric | ChatWithStars | A | primary | packages/decisions | analysed |
| DEC-002 | decisions | shadow/replay/language-gated decisions | ChatWithStars | A | primary | packages/decisions + telemetry | discovered |
| AGT-001 | agents | pluggable agent strategies | OpenJarvis | B | primary | packages/agents | analysed |
| AGT-002 | agents | common agent context/result contract | OpenJarvis | B | primary | packages/agents | discovered |
| AGT-003 | agents | foreground persona/background specialist | CyberVerse | B | primary pattern | packages/agents + services/runtime | analysed |
| AGT-004 | agents | scheduled/continuous monitoring agents | OpenJarvis | B | secondary | packages/agents + proactivity | discovered |
| AGT-005 | agents | browser/computer-use execution | N.E.K.O | B | secondary | packages/tools | discovered |
| SKL-001 | skills | SkillManager/discovery architecture | OpenJarvis | B | primary | packages/skills | analysed |
| SKL-002 | skills | versioned certification/risk/expertise | ChatWithStars | A | primary governance | packages/skills | analysed |
| SKL-003 | skills | skills callable through Tool adapter | OpenJarvis | B | primary | packages/skills + tools | analysed |
| SKL-004 | skills | dependency graph/cycle/depth validation | OpenJarvis | A | primary | packages/skills | discovered |
| SKL-005 | skills | external skill import/source resolvers/provenance | OpenJarvis | B | primary | packages/skills | discovered |
| SKL-006 | skills | expertise bindings and character handoff routing | ChatWithStars | A | primary | packages/skills + identity | analysed |
| SKL-007 | skills | Skill Contract v2 negative activation/typed entities/idempotency/paid confirmation gates | ChatWithStars | A | primary governance | packages/skills | analysed |
| TOL-001 | tools | common atomic tool executor/interface | OpenJarvis | B | primary | packages/tools | discovered |
| TOL-002 | tools | tool risk/readiness/idempotency/reconciliation metadata | ChatWithStars | A | primary governance | packages/tools | analysed |
| PRV-001 | infrastructure | provider-neutral inference engine | OpenJarvis | B | primary | packages/providers | analysed |
| PRV-002 | infrastructure | model/provider health and discovery | OpenJarvis | B | primary | packages/providers | analysed |
| PRV-003 | infrastructure | local/cloud hardware-aware inference routing | OpenJarvis | B | secondary | packages/providers | discovered |
| MEM-001 | memory | layered cognitive memory pipeline | N.E.K.O | B | primary taxonomy | packages/memory | analysed |
| MEM-002 | memory | user isolation from shared world state | ChatWithStars | A | primary privacy | packages/memory | analysed |
| MEM-003 | memory | bounded recent memory + summary compression | N.E.K.O | B | primary | packages/memory | analysed |
| MEM-004 | memory | atomic facts + dedup/archive | N.E.K.O | B | primary | packages/memory | analysed |
| MEM-005 | memory | reflection synthesis/evidence lifecycle | N.E.K.O | B | primary | packages/memory | analysed |
| MEM-006 | memory | durable persona promotion/contradiction merge | N.E.K.O | B | secondary | packages/memory + identity | analysed |
| MEM-007 | memory | explicit hybrid memory recall tool | N.E.K.O | B | primary retrieval | packages/memory + tools | analysed |
| MEM-008 | memory | replayable memory outbox/event reconciliation | N.E.K.O | A | secondary reliability | packages/memory + events | analysed |
| MEM-009 | memory | expiry/sensitivity/importance decay/constraint floor at recall | ChatWithStars | B | secondary policy | packages/memory + security | analysed |
| PRO-001 | proactivity | proactive/time-aware interaction | N.E.K.O | B | primary | packages/proactivity | analysed |
| PRO-002 | proactivity | candidate/source/decision/generation/delivery separation | N.E.K.O | B | primary | packages/proactivity | discovered |
| PER-001 | perception | screen/browser/computer perception/action | N.E.K.O | B | primary | packages/perception + tools | discovered |
| PLG-001 | plugins | process-isolated plugin lifecycle | N.E.K.O | B | primary packaging | plugin SDK/runtime | analysed |
| PLG-002 | plugins | external protocol Adapter concept | N.E.K.O | B | secondary | services/gateway + plugins | discovered |
| PLG-003 | plugins | plugin marketplace/release/hosted UI | N.E.K.O | B | secondary | apps/ops + plugin SDK | discovered |
| LRN-001 | learning/evaluation | skill-tagged traces and optimization overlays | OpenJarvis | B | primary | packages/telemetry + skills | analysed |
| LRN-002 | learning/evaluation | candidate optimization with few-shot/description overlays | OpenJarvis | B | primary | packages/skills | discovered |
| LRN-003 | learning/evaluation | certification/rehearsal before production promotion | ChatWithStars | A | primary governance | testing + skills | analysed |
| SEC-001 | security | capability/file/SSRF/injection/rate-limit security primitives | OpenJarvis | B | secondary | packages/security | discovered |
| SEC-002 | security | deterministic authorization for consequential actions | ChatWithStars | A | primary | security + workflows | analysed |
| RTC-001 | presence | WebRTC realtime digital-human session | CyberVerse | B | primary architecture | services/presence | analysed |
| RTC-002 | presence | barge-in/interruption | CyberVerse | A | primary behavior | services/presence | discovered |
| RTC-003 | presence | provider-separated ASR/TTS/realtime-LLM/avatar chain | CyberVerse | B | primary | services/presence + providers | analysed |
| RTC-004 | presence | voice-only mode independent of avatar | CyberVerse | A | primary | services/presence | discovered |
| RTC-005 | presence | live visual input to realtime persona | CyberVerse | B | primary | services/presence + perception | discovered |
| TSK-001 | workflows | realtime background task events/artifacts | CyberVerse | B | secondary UX | packages/workflows + presence | analysed |
| TSK-002 | workflows | reconnectable ordered task event stream | CyberVerse | A | secondary reliability | workflows + events | analysed |
| TSK-003 | workflows | rich durable task lifecycle | ChatWithStars | A | primary | packages/workflows | analysed |
| TSK-004 | workflows | durable outbound delivery evidence before resend | ChatWithStars | A | primary reliability | packages/workflows + events | analysed |
| COM-001 | commerce | quote/payment/approval/reconcile/receipt | ChatWithStars | A | primary | packages/commerce + workflows | analysed |
| COM-002 | commerce | append-only ledger/derived balance model | ChatWithStars | A | primary | packages/commerce | analysed |
| COM-003 | commerce | provider inbox/retry/cutover/acceptance controls | ChatWithStars | A | primary | commerce + ops | analysed |
| COM-004 | commerce | production sandbox-provider rejection and retired-provider exclusion | ChatWithStars | A | primary | commerce + security | analysed |
| SOC-001 | social | durable character social publishing | ChatWithStars | A | primary | services/social | analysed |
| SOC-002 | social | scheduling/review/destination/token-vault automation | ChatWithStars | A | primary | services/social | discovered |
| STD-001 | studio | produced media pipeline | ChatWithStars | A | primary | services/studio | analysed |
| STD-002 | studio | identity/continuity/reference management | ChatWithStars | A | primary | services/studio + identity | discovered |
| STD-003 | studio | provider-neutral render queue/adapters | ChatWithStars | B | primary | services/studio + providers | discovered |
| AVT-001 | avatar | multi-form avatar abstraction | N.E.K.O | B | primary breadth | clients + providers | discovered |
| AVT-002 | avatar | realtime generated-human renderer | CyberVerse | B | primary generated-human | services/presence + providers | analysed |
| AVT-003 | avatar | avatar warmup/silent-idle/sync behavior | CyberVerse | A | primary behavior | services/presence | discovered |
| CHN-001 | channels | web/WhatsApp/Telegram share same character/runtime state | ChatWithStars | A | primary | gateway + channel adapters | analysed |
| CHN-002 | channels | broad optional channel adapter ecosystem | OpenJarvis | C/B per channel | reference | gateway adapters | discovered |
| OPS-001 | operations | provider/skill acceptance and operator control | ChatWithStars | A | primary | apps/ops | discovered |
| CALL-001 | presence | call readiness state separates operational/degraded/action-required | ChatWithStars | A | secondary reliability | services/presence | analysed |
| CALL-002 | presence | staged soft recovery before hard renderer/browser recovery | ChatWithStars | A | secondary reliability | services/presence | analysed |
| CALL-003 | presence | incoming accept waits for provider call materialization | ChatWithStars | A | secondary reliability | services/presence | analysed |
| CALL-004 | presence | reconnect preserves login while relink intentionally clears dedicated call profile | ChatWithStars | A | secondary operations | services/presence | analysed |
| CALL-005 | presence | outbound timeout preserves provider/renderer diagnostics | ChatWithStars | B | secondary observability | services/presence + telemetry | analysed |
| CALL-006 | presence | live audio normalization/peak limiting and graceful hangup tool | ChatWithStars | B | secondary UX | services/presence | analysed |
| SEC-003 | security | imported-skill trust tiers, script opt-in and symlink rejection | OpenJarvis | A/B | secondary | packages/security + skills | analysed |
| SEC-004 | security | SSRF private/metadata/DNS-failure fail-closed validation | OpenJarvis | A | secondary | packages/security | analysed |
| AGT-006 | agents | loop guards for repeated calls/poll budgets/context growth | OpenJarvis | A/B | primary execution | packages/agents | analysed |
| AGT-007 | agents | cost/token execution budgets | OpenJarvis | B | primary execution | packages/agents + telemetry | analysed |
| PRV-004 | infrastructure | explicit engine selection never silently substitutes; default fallback health/model-aware | OpenJarvis | A | primary | packages/providers | analysed |
| LRN-004 | learning/evaluation | minimum-evidence optimization and non-mutating overlay output | OpenJarvis | A/B | primary | skills + telemetry | analysed |
| SCH-001 | proactivity | once/interval/timezone-aware cron scheduled execution lifecycle | OpenJarvis | B | secondary | packages/proactivity + workflows | analysed |
| MEM-010 | memory | poison-input dead-letter/liveness progression across background cognition | N.E.K.O | A | primary reliability | packages/memory + workflows | analysed |
| MEM-011 | memory | foreground turn persistence before asynchronous memory cognition | N.E.K.O | A | primary reliability | packages/memory + events | analysed |
| MEM-012 | memory | automatic context renderer separate from explicit recall query | N.E.K.O | B | primary architecture | packages/memory | analysed |
| PLG-004 | plugins | hot-reload preserves explicit stopped intent and rejects shutdown-race resurrection | N.E.K.O | A | primary lifecycle | plugin runtime | analysed |
| PLG-005 | plugins | typed plugin event/entry SDK with call-chain limits | N.E.K.O | B | primary | plugin SDK | analysed |
| PRO-003 | proactivity | persistent source/repetition history across restarts | N.E.K.O | A/B | primary | packages/proactivity | analysed |
| PRO-004 | proactivity | conservative atomic state persistence under load/cancellation failure | N.E.K.O | A | primary reliability | packages/proactivity + events | analysed |
| PER-002 | perception | privacy-state abstraction for OS activity signals | N.E.K.O | B | primary | packages/perception | analysed |
| PER-003 | perception | restricted/sanitized computer-use action runtime with exclusive desktop lease | N.E.K.O | A/B | primary safety | packages/tools + perception | analysed |
| VID-001 | security | optional speaker/owner voice identity activation and enrollment | N.E.K.O | B | primary | packages/security + services/presence | analysed |
| EMB-001 | avatar | embodied interaction events with dedupe-ranked memory eligibility | N.E.K.O | B | primary | packages/perception + memory | analysed |
| RTC-006 | presence | playback/turn epoch media synchronization and stale-feedback rejection | CyberVerse | A | primary behavior | services/presence | analysed |
| RTC-007 | presence | bounded AV sync correction, gap skipping and media-path reset | CyberVerse | A/B | primary behavior | services/presence | analysed |
| RTC-008 | presence | optional avatar with continuous idle/speech renderer synchronization | CyberVerse | A/B | primary behavior | services/presence | analysed |
| RTC-009 | presence | generation-safe conversational pipeline cancellation/completion | CyberVerse | A | primary behavior | services/presence + runtime | analysed |
| TSK-005 | workflows | terminal task/artifact immutability | CyberVerse | A | secondary reliability | packages/workflows | analysed |
| TSK-006 | workflows | atomic ordered task-event progression and reconnect catch-up | CyberVerse | A | secondary reliability | packages/workflows + events | analysed |
| AGT-008 | agents | role-isolated background worker context with allowlisted tools/skills/packages/env | CyberVerse | A/B | primary background-worker pattern | packages/agents + workers | analysed |
| AGT-009 | agents | immediate foreground acknowledgment before background task execution | CyberVerse | B | primary UX | packages/agents + runtime | analysed |
| AVT-004 | avatar | renderer warmup policy including distributed capability/timeout | CyberVerse | B | primary generated-human | services/presence + providers | analysed |
| SOC-003 | social | tenant-scoped durable ingestion/publish queue with redeploy dedupe | ChatWithStars | A | primary | services/social + workflows | analysed |
| SOC-004 | social | manual review/approve/reject workflow with cross-tenant isolation | ChatWithStars | A | primary | services/social + apps/ops | analysed |
| SOC-005 | social | cadence/quiet-window/destination-specific scheduling policy | ChatWithStars | B | primary | services/social + proactivity | analysed |
| STD-004 | studio | idempotent render queue with bounded regeneration and human review | ChatWithStars | A | primary | services/studio + workflows | analysed |
| STD-005 | studio | continuity state derived from actual rendered output and prior-frame references | ChatWithStars | A/B | primary | services/studio + identity/world | analysed |
| STD-006 | studio | explicit audio/voice/lipsync fit plan with provider-neutral backend stages | ChatWithStars | B | primary | services/studio + providers | analysed |
| OPS-003 | operations | production acceptance-evidence state distinct from configuration/readiness | ChatWithStars | A | primary | apps/ops + telemetry | analysed |
| OPS-004 | operations | privacy-safe operational incidents and JEV aggregate evidence | ChatWithStars | A | primary | apps/ops + telemetry | analysed |
| OPS-005 | operations | durable emergency kill switches independent of browser state | ChatWithStars | A | primary | apps/ops + security | analysed |
| OPS-006 | operations | audited bounded financial adjustments | ChatWithStars | A | primary | apps/ops + commerce | analysed |
| OPS-002 | operations | trace/evaluation visibility | OpenJarvis + ChatWithStars | B | combined | apps/ops + telemetry | analysed |
| GW-001 | channels | unified local-first Gateway/control plane for sessions/tools/events/channels | OpenClaw | B | selected architectural donor | services/gateway | analysed |
| CHN-003 | channels | per-agent channel/account bindings and isolated workspaces/session stores | OpenClaw | B | primary routing donor | gateway + identity/runtime | analysed |
| DEV-001 | perception | device nodes for voice/camera/screen/device-local actions | OpenClaw | B | primary device-node donor | gateway + perception + tools | analysed |
| SKL-008 | skills | scoped skill roots/precedence/gating/install/update/verify/workshop distribution | OpenClaw | B | primary distribution donor | packages/skills | analysed |
| MEM-013 | memory | action-sensitive memory + compaction flush + background dreaming | OpenClaw | B | secondary donor | packages/memory | analysed |
| MEM-014 | memory | pluggable memory engines and provenance-rich memory wiki | OpenClaw | B | secondary donor | packages/memory + plugins | analysed |
| AGT-012 | agents | active-run steer/followup/collect/interrupt queue semantics | OpenClaw | B | secondary runtime donor | packages/agents + runtime | analysed |
| SEC-005 | security | workspace attestation and fail-safe missing-workspace handling | OpenClaw | A/B | secondary security donor | packages/security + runtime | analysed |
| DLF-001 | avatar | persistent digital-life client across web/desktop/avatar/game contexts | AIRI | B | selected architectural donor | apps/clients + avatar | analysed |
| DLF-002 | avatar | Live2D/VRM embodied character runtime | AIRI | B | primary embodiment donor | avatar providers/clients | analysed |
| RTC-014 | presence | AgentSession/Worker/job abstraction over production WebRTC | LiveKit Agents | B | selected session donor | services/presence | analysed |
| RTC-010 | presence | semantic turn detection and multi-provider STT/LLM/TTS/realtime/avatar plugins | LiveKit Agents | B | selected realtime session donor | presence + providers | analysed |
| RTC-011 | presence | composable frame/pipeline processors for voice/video/control | Pipecat | B | secondary policy/pipeline donor | services/presence | analysed |
| AGT-013 | agents | multi-agent handoff/fan-out/sidecar/shared-bus realtime composition | Pipecat | B | secondary presence donor | agents + presence | analysed |
| MEM-015 | memory | bounded working/core blocks + revisioned editable durable memory + explicit shared attachments | Letta Code | B | selected working-context/revision donor | packages/memory | analysed |
| MEM-016 | memory | temporal/entity-aware multi-signal retrieval and memory evaluation | Mem0 | B | selected extraction/retrieval/evaluation donor | packages/memory + telemetry | analysed |
| WLD-004 | world | transactional shared-state simulation engine for autonomous characters | AI Town | B | major candidate | packages/world + workers | discovered |
| AGT-010 | agents | TypeScript AgentRuntime with actions/providers/evaluators/services/events | elizaOS | B | major candidate | packages/agents + providers | discovered |
| PLG-006 | plugins | TypeScript plugin model registering actions/providers/evaluators/services/routes/events/views | elizaOS | B | major candidate | plugin SDK/runtime | discovered |
| DEV-002 | perception | native device bridges/browser/desktop automation behind permissions | elizaOS | B | candidate | perception + tools | discovered |
| WF-006 | workflows | durable graph workflows with checkpoint/restart/time-travel/HITL | Microsoft Agent Framework | B | major candidate | packages/workflows | discovered |
| AGT-011 | agents | sequential/concurrent/handoff/group multi-agent orchestration | Microsoft Agent Framework | B | candidate | packages/agents + workflows | discovered |
| INT-001 | agents | A2A/MCP interoperability patterns | Microsoft Agent Framework + LiveKit/OpenClaw | B | reference | gateway + providers | discovered |
| GW-002 | channels | channel admission/access gates separated from destination binding | OpenClaw | A | primary behavior donor | services/gateway + security | analysed |
| DEV-003 | perception | durable device pairing/token lifecycle with uncertain-delivery reconciliation | OpenClaw | A | primary device donor | gateway + security | analysed |
| DEV-004 | perception | remote node invoke with pre-execution-only retry semantics | OpenClaw | A | primary device donor | gateway + tools | analysed |
| APR-001 | security | durable first-answer-wins approval registry with current-authority revalidation | OpenClaw | A | secondary approval donor | workflows + security | analysed |
| SKL-009 | skills | immutable managed skill revisions with optimistic edit conflict and session pinning | OpenClaw | A/B | primary distribution donor | packages/skills | analysed |
| SEC-006 | security | one-trust-domain Gateway model unsuitable as public multi-tenant boundary | OpenClaw | C/A | explicit non-adoption constraint | services/gateway + security | analysed |
| PLG-007 | plugins | managed-operation cancellation/current-authority/node-idleness lifecycle | OpenClaw | B | candidate | plugin runtime + security | analysed |
| MEM-017 | memory | active recall clamped by parent effective tool authority and fail-soft on recall failure | OpenClaw | A | secondary memory donor | packages/memory + tools | analysed |
| PRV-005 | infrastructure | optional published @openclaw/ai provider implementation behind Masanawa IntelligenceProvider | OpenClaw | B | direct-dependency candidate | packages/providers | analysed |
| SEC-007 | security | explicit separation of sandbox location, tool allow/deny policy and elevated exec | OpenClaw | A/B | behavior donor | packages/security + tools | analysed |
| DLF-003 | avatar | shared Stage contract across web/desktop/mobile character surfaces | AIRI | B | primary client donor | apps/clients + contracts | analysed |
| AVT-005 | avatar | renderer-neutral model-driver lifecycle with target ownership/release | AIRI | B | primary embodiment donor | avatar providers/clients | analysed |
| IDN-004 | identity | validated Character Card V3/AIRI pack interoperability import | AIRI | B | interoperability donor | packages/identity + clients | analysed |
| PLG-008 | plugins | capability lifecycle announced/ready/degraded/withdrawn | AIRI | B | strong secondary donor | plugin runtime | analysed |
| PLG-009 | plugins | least-privilege permission intersection and parent-extension ceiling | AIRI | A | strong security donor | plugin runtime + security | analysed |
| PLG-010 | plugins | extension session cleanup ownership with independent runtime/asset debt | AIRI | A/B | strong lifecycle donor | plugin runtime | analysed |
| RTC-013 | presence | serialized microphone/ASR binding lifecycle with stale-callback isolation | AIRI | A | primary client-lifecycle donor | clients + services/presence | analysed |
| PER-004 | perception | deterministic/browser-DOM/desktop computer-use lane separation with approval/audit | AIRI | B | secondary execution donor | tools + perception | analysed |
| PRV-006 | infrastructure | runtime-neutral client inference/provider definitions | AIRI | B | secondary provider donor | packages/providers | analysed |
| RTC-015 | presence | distributed rooms/participants/tracks/TURN/SIP WebRTC transport | LiveKit Server | B | selected transport donor | services/presence | analysed |
| RTC-016 | presence | detector-aware endpointing/interruption policy with handoff-stable overrides | LiveKit Agents | A/B | selected session donor | services/presence | analysed |
| RTC-017 | avatar | remote/generated avatar participant lifecycle and join/playback metrics | LiveKit Agents | B | selected remote-avatar donor | services/presence + providers | analysed |
| RTC-018 | presence | explicit interruptible media/control frames and deterministic TTS ordering | Pipecat | A/B | secondary behavior donor | services/presence | analysed |
| RTC-019 | presence | decomposed turn-start/turn-stop/speculative-finalization strategies | Pipecat | B | secondary turn-policy donor | services/presence | analysed |

This inventory is intentionally incomplete. Source-specific map documents identify the next deep-mining areas.


### Phase 0A memory comparison additions

| ID | Domain | Capability | Source | Class | Donor role | Masanawa destination | Status |
|---|---|---|---|---|---|---|---|
| MEM-018 | memory | ADD-oriented asynchronous extraction with related-memory lookup and dedup | Mem0 | B | primary extraction donor | packages/memory | analysed |
| MEM-019 | memory | semantic + BM25 + entity + temporal retrieval fusion and reranking | Mem0 | B | primary retrieval donor | packages/memory | analysed |
| MEM-020 | memory | explicit expiration distinct from decay and deletion | Mem0 | B | specialist lifecycle donor | packages/memory | analysed |
| MEM-021 | memory | bounded always-visible working memory blocks distinct from durable memory | Letta Code | B | primary working-context donor | packages/memory | analysed |
| MEM-022 | memory | serialized memory writes + stale-safe conflict repair/revision semantics | Letta Code | B | primary concurrency donor | packages/memory + workflows | analysed |
| MEM-023 | memory | canonical scope authorization before extraction lookup/retrieval | Masanawa synthesis (CWS + donors) | A | canonical invariant | packages/memory + security | selected |
| MEM-024 | memory | rebuildable vector/lexical/entity/temporal projections over canonical records | Masanawa synthesis + Mem0 | B | canonical architecture | packages/memory | selected |


### Phase 0A runtime/skills/plugins/workflow comparison additions

| ID | Domain | Capability | Source | Class | Donor role | Masanawa destination | Status |
|---|---|---|---|---|---|---|---|
| AGT-014 | agents | bounded strategy-based agent execution envelope with loop/tool/cost/token guards | OpenJarvis | A/B | selected structural runtime donor | packages/agents | selected |
| AGT-015 | agents | typed component runtime with staged routing, provider composition and service lifecycle | elizaOS | B | selected TypeScript component donor | packages/agents + plugins | selected |
| SKL-009 | skills | canonical manager/parser/dependency/executor/SkillTool/import/provenance architecture | OpenJarvis | A/B | selected structural skill donor | packages/skills | selected |
| SKL-010 | skills | progressive disclosure, composable sources, resources/scripts and path-safe reads | Microsoft Agent Framework | A/B | secondary skill donor | packages/skills | selected |
| PLG-011 | plugins | typed action/provider/evaluator/service/model/route/event component registration | elizaOS | B | selected component-model donor | packages/plugins | selected |
| PLG-012 | plugins | host-owned package resolution/install with fail-closed kernel loading | elizaOS | A | selected supply-chain boundary | packages/plugins + ops | selected |
| WFL-001 | workflows | typed graph orchestration with fan-out/fan-in/conditional edges and convergence guard | Microsoft Agent Framework | A/B | selected orchestration donor | packages/workflows | selected |
| WFL-002 | workflows | graph-signature checkpoint lineage with executor/edge/pending-human state | Microsoft Agent Framework | A | selected recovery donor | packages/workflows | selected |
| WFL-003 | workflows | restored execution revalidates current authority and reconciles side-effect receipts | Masanawa synthesis (MAF+CWS+OpenClaw) | A | canonical invariant | packages/workflows + security | selected |

### Phase 0A world simulation comparison additions

| ID | Domain | Capability | Source | Class | Donor role | Masanawa destination | Status |
|---|---|---|---|---|---|---|---|
| WLD-005 | world | ordered-input monotonic tick/step simulation with bounded catch-up | AI Town | B | selected simulation-mechanics donor | packages/world + workers | selected |
| WLD-006 | world | generation/CAS overlap rejection and transactional simulation commit | AI Town | A/B | selected concurrency donor | packages/world + workers | selected |
| WLD-007 | world | autonomous actor interaction/activity/conversation state machines | AI Town | B | primary simulation behavior donor | packages/world + agents | selected |
| WLD-008 | world | optional spatial map/pathfinding/collision/location-history simulation | AI Town | B | optional spatial donor | packages/world | selected |
| WLD-009 | world | governed authored/engine canon with visibility, provenance and immutable approval lifecycle | ChatWithStars | A | selected canon/governance donor | packages/world + ops | selected |
| WLD-010 | world | policy-controlled pause/resume/catch-up/recovery semantics | AI Town + Masanawa synthesis | B | combined liveness donor | packages/world + workers | selected |
| WLD-011 | world | canonical world/life authority separated from identity, memory, workflow and presence truth | Masanawa synthesis | A | canonical invariant | packages/world | selected |

### Phase 0A OpenClaw Agent Skills additions

| ID | Domain | Capability | Source | Class | Donor role | Masanawa destination | Status |
|---|---|---|---|---|---|---|---|
| SKL-011 | skills | canonical-source skill bundle with validated frontmatter, colocated resources/scripts and generated-snapshot provenance | OpenClaw Agent Skills | B | authoring/distribution convention donor | packages/skills + developer tooling | selected |
| EVL-001 | learning/evaluation | source-blind behavior validation against explicit contracts | OpenClaw Agent Skills | A/B | acceptance-test donor | testing/evaluation | selected |
| DEV-004 | developer experience | redacted transcript provenance, bounded handoff and repeatable operational helper workflows | OpenClaw Agent Skills | B | developer-workflow donor | developer tooling | selected |

### Phase 0B ChatWithStars coverage additions

| ID | Domain | Feature | Source | Class | Donor role | Masanawa destination | Status |
|---|---|---|---|---|---|---|---|
| SUB-001 | subscriptions | plan/trial/entitlement lifecycle separated from capability authorization | ChatWithStars | A/B | domain behavior donor | packages/entitlements + commerce | analysed |
| PRV-001 | privacy | user data inventory/export/delete with scoped canonical deletion policy | ChatWithStars | A | domain/privacy donor | packages/privacy + apps/ops | analysed |
| KNO-001 | knowledge | tenant/user-scoped knowledge ingestion, extraction and grounded retrieval | ChatWithStars | B | domain behavior donor | packages/knowledge + providers | analysed |
| GRP-001 | groups | durable group/community membership and thread continuity without collapsing private relationships | ChatWithStars | A/B | domain behavior donor | packages/relationships + gateway | analysed |
| MSN-001 | autonomy | bounded missions/commitments with Constitution/policy authority and evaluation evidence | ChatWithStars | B | domain behavior donor | packages/workflows + proactivity | analysed |
| CRT-001 | creator | creator/tenant provisioning, service configuration and payout/account boundaries | ChatWithStars | B | domain behavior donor | packages/tenancy + commerce + apps/ops | analysed |
| TEL-001 | commerce | telecom/bill-service catalog, order, fulfilment, receipt and reconciliation lifecycle | ChatWithStars | A/B | vertical commerce donor | packages/commerce + providers | analysed |
| CVI-001 | civic | evidence-grounded jurisdiction/case/public-information workflows with explicit source/truth lifecycle | ChatWithStars | B | optional vertical donor | packages/verticals/civic + knowledge/workflows | analysed |
| LEG-001 | legacy | old Astro fan/creator/admin surface and compatibility contracts retained only as behavior/data migration evidence | ChatWithStars | C | historical reference | no runtime destination; extract parity fixtures only | selected |
| DEP-001 | deployment | donor-specific Railway/Cloudflare/Modal/RunPod wrappers are deployment evidence, not canonical architecture | ChatWithStars | C/B | operations reference | deploy + provider adapters only where selected | selected |
| DAT-001 | fixtures | checked-in star/profile/media/project data are fixtures/reference assets, not canonical runtime state | ChatWithStars | C/B | fixture/reference | seed/test fixtures after provenance/privacy review | selected |

### Phase 0B OpenJarvis coverage additions

| ID | Domain | Feature | Source | Class | Donor role | Masanawa destination | Status |
|---|---|---|---|---|---|---|---|
| PRV-002 | providers | engine/provider discovery, hardware-aware local inference and bounded fallback/routing | OpenJarvis | B | selected runtime/provider donor | packages/providers + packages/agents | analysed |
| INT-001 | interoperability | MCP and A2A protocol adapters separated from canonical agent/tool identity | OpenJarvis | B | interoperability donor | gateway/interoperability + packages/tools | analysed |
| CON-001 | connectors | external source/connectors with explicit security, ingestion and normalization boundaries | OpenJarvis | B | connector architecture donor | packages/connectors + knowledge | analysed |
| SBX-001 | security | sandbox/execution boundary distinct from tool allow/deny and consequential-action approval | OpenJarvis | A/B | security architecture donor | security + packages/tools | analysed |
| OBS-001 | telemetry | traces, analytics, benchmarks, evals, energy/cost/latency evidence with redaction | OpenJarvis | B | observability/evaluation donor | telemetry + testing/evaluation | analysed |
| SES-001 | runtime | explicit runtime sessions/continuation/persistence that do not become Character identity or durable workflow truth | OpenJarvis | B | runtime behavior donor | packages/agents + gateway | analysed |
| SPH-001 | media | speech input/output provider abstraction and client playback controls | OpenJarvis | B | secondary media donor | packages/providers/media + clients | analysed |
| CLI-001 | operations | CLI/daemon/server/SDK/operator surfaces over one canonical runtime | OpenJarvis | B | operator/DX donor | apps/ops + SDK/CLI adapters | analysed |
| RCP-001 | workflows | recipes/templates/examples as declarative composition/reference, not parallel domain runtimes | OpenJarvis | C/B | authoring/reference donor | developer tooling + workflow templates | selected |
| RST-001 | runtime | duplicate Rust/Python implementations are implementation alternatives, not two Masanawa authorities | OpenJarvis | C/B | implementation reference | canonical TypeScript contracts; optional native acceleration only behind adapters | selected |

### Phase 0B N.E.K.O coverage additions

| ID | Domain | Feature | Source | Class | Donor role | Masanawa destination | Status |
|---|---|---|---|---|---|---|---|
| VOI-001 | presence | provider-neutral ASR lifecycle with endpointing/VAD, candidate control, warmup, delivery status and worker-failure handling | N.E.K.O | B | realtime input donor | services/presence + providers/media | analysed |
| VOI-002 | identity/presence | optional speaker/voice identity evidence separated from canonical user/Character identity | N.E.K.O | B | secondary identity-signal donor | services/presence + packages/identity | analysed |
| ACT-001 | perception | local activity/focus/system-signal state machine feeding bounded proactive decisions | N.E.K.O | B | selected perception donor | packages/perception + proactivity | analysed |
| CFG-001 | configuration | versioned local configuration/storage migration and staged cloud-save snapshots | N.E.K.O | B | configuration lifecycle donor | packages/config + storage adapters | analysed |
| PLG-011 | plugins | plugin developer CLI/market install-build-validate-release lifecycle with dependency/source inspection | N.E.K.O | B | plugin DX/distribution donor | packages/plugins + developer tooling | analysed |
| PLG-012 | plugins | process/message-plane plugin communication with validated RPC/pubsub/events and deadlock/lifecycle controls | N.E.K.O | A/B | plugin isolation donor | packages/plugins runtime adapters | analysed |
| EXT-001 | extensions | mini-game/watch-together/music/game routes as optional Character experience extensions, not core world/runtime truth | N.E.K.O | C/B | extension reference donor | optional apps/extensions via skills/plugins | selected |
| OBS-002 | telemetry | privacy-bounded local telemetry/survey collection as optional operator/product feedback | N.E.K.O | C/B | telemetry reference | telemetry/feedback with explicit consent | selected |
| AST-001 | assets | vendored OCR, speech/embedding models, corpora and binary wheels require independent artifact/license provenance | N.E.K.O | C/B | artifact reference | provider/model registry only after separate license review | selected |
| AVT-010 | embodiment | Live2D/MMD/PNGTuber import/control and avatar interaction surfaces remain client embodiment adapters | N.E.K.O | B | secondary embodiment donor | clients/embodiment + packages/identity imports | analysed |
| MED-001 | media | provider-neutral TTS/image-generation/media utilities behind canonical provider registry | N.E.K.O | B | provider adapter reference | packages/providers/media | analysed |
| CHN-010 | channels | QQ/OneBot/community connection adapters separated from canonical conversation/Character state | N.E.K.O | B | channel adapter reference | gateway/channel adapters | analysed |

### Phase 0B CyberVerse coverage additions

| ID | Domain | Feature | Source | Class | Donor role | Masanawa destination | Status |
|---|---|---|---|---|---|---|---|
| RTC-020 | presence | direct WebRTC RTP pacing/gap/audio-delay/negotiation behavior independent of LiveKit-room path | CyberVerse | C/B | GPL clean-room behavior reference | services/presence tests/specs | selected |
| INF-001 | providers | typed gRPC inference service boundaries for ASR/LLM/RAG/TTS/avatar/realtime voice | CyberVerse | C/B | GPL clean-room interface reference | packages/providers/media contracts | selected |
| RAG-001 | knowledge | vector/RAG service boundary and knowledge-source management | CyberVerse | C/B | GPL clean-room behavior reference | packages/knowledge + provider adapters | selected |
| AVT-020 | embodiment | avatar warmup, silent/idle runtime, provider catalog and offline-video orchestration | CyberVerse | C/B | GPL clean-room behavior reference | clients/embodiment + services/studio/presence | selected |
| TSK-020 | workflows | reconnectable agent-task store/API with terminal artifact/event semantics | CyberVerse | C/B | GPL clean-room workflow reference | packages/workflows + events | selected |
| MOD-001 | assets | embedded third-party avatar/lipsync/video model source trees require their own licenses and are not reusable through CyberVerse's GPL classification | CyberVerse | C | third-party model reference | no direct import; separate upstream evaluation | selected |

### Phase 0B provider synthesis additions

| ID | Domain | Feature | Source | Class | Donor role | Masanawa destination | Status |
|---|---|---|---|---|---|---|---|
| PRV-020 | providers | canonical provider operation registry with effect/retry/idempotency/reconciliation/readiness contracts | Masanawa synthesis + ChatWithStars/OpenJarvis/OpenClaw/AIRI | A/B | synthesized architecture | packages/providers | selected |
| PRV-021 | providers | evidence-driven configured/ready/accepted lifecycle with dependency invalidation | ChatWithStars Flutterwave generalized | A/B | strong behavioral donor | packages/providers + apps/ops | selected |
| PRV-022 | providers | ambiguous side-effect reconciliation before retry | ChatWithStars commerce + Telegram generalized | A | strong behavioral donor | packages/providers + workflows | selected |
| PRV-023 | providers | normalized provider attempt/receipt/reconciliation evidence across payment/social/channel/media/model/compute | Masanawa synthesis | B | synthesized architecture | packages/providers + telemetry | selected |

### Phase 0B OpenJarvis remediation additions

| ID | Domain | Feature | Source | Class | Donor role | Masanawa destination | Status |
|---|---|---|---|---|---|---|---|
| LRN-020 | learning/evaluation | evidence-gated spec-search loop: diagnose -> plan -> risk-tier -> stage -> benchmark -> accept/review/rollback | OpenJarvis | B | strong learning-control donor | packages/telemetry + packages/skills + apps/ops | analysed |
| CON-020 | connectors | resumable incremental connector sync with cursor checkpoint and success-watermark separation | OpenJarvis | A/B | strong connector ingestion donor | packages/connectors + packages/knowledge + workflows | analysed |
| APR-020 | security | durable pending-action approval lifecycle plus optional remembered permission rule | OpenJarvis | B | secondary approval UX donor | packages/workflows + security | analysed |
| SES-020 | runtime | cross-channel conversation session persistence and context consolidation separated from durable identity/memory truth | OpenJarvis | B | runtime-session donor | packages/agents + gateway | analysed |
| SCH-020 | workflows | once/interval/timezone-aware cron trigger lifecycle with durable run log | OpenJarvis | B | trigger/scheduler donor | packages/workflows + proactivity | analysed |
| WFL-020 | workflows | lightweight declarative agent/tool/condition/transform/loop graph | OpenJarvis | C/B | composition/reference donor | workflow definition import only; durable runtime remains packages/workflows | selected |
| SEC-020 | security | dangerous-tool confirmation fails closed when interactivity/approval callback is unavailable | OpenJarvis | A | strong tool-safety behavior donor | packages/tools + security/workflows | analysed |
| SEC-021 | security | SSRF guard blocks metadata/private/disguised IPs and fails closed on DNS resolution failure | OpenJarvis | A | strong network-tool safety donor | packages/security | analysed |
| TRC-020 | telemetry | per-run event subscription trace collection with guaranteed unsubscribe and skill/tool metadata | OpenJarvis | A/B | primary trace donor | packages/telemetry | analysed |

### Phase 0B AIRI descendant additions

| ID | Domain | Feature | Source | Class | Donor role | Masanawa destination | Status |
|---|---|---|---|---|---|---|---|
| PLG-030 | plugins | deterministic extension activation planning with dependency/version/runtime validation and provider-first load / consumer-first unload order | AIRI | A/B | strong plugin-lifecycle donor | packages/plugins | analysed |
| PLG-031 | plugins/security | least-privilege permission intersection with parent-extension ceiling for child modules | AIRI | A | strong permission donor | packages/plugins + security | analysed |
| RTC-040 | presence/client | serialized microphone/voice binding replacement with stale-request suppression and cleanup after failed start | AIRI | A | strong client-lifecycle donor | services/presence + clients | analysed |
| AVT-030 | embodiment | renderer/model-driver target ownership with replace-without-release and explicit stop/dispose release | AIRI | A/B | strong embodiment lifecycle donor | clients/embodiment | analysed |
| CUA-030 | computer use | private serialized desktop daemon with route/storage ownership, bounded command grammar and artifact-path validation | AIRI | A/B | strong desktop execution donor | packages/tools + perception/security | analysed |
| MOB-001 | clients | native mobile host WebSocket bridge preserving connection lifecycle independently of web app implementation | AIRI | B | mobile bridge donor | clients/mobile + gateway | analysed |

### Phase 0B LiveKit Server descendant additions

| ID | Domain | Feature | Source | Class | Donor role | Masanawa destination | Status |
|---|---|---|---|---|---|---|---|
| RTC-050 | presence | room/participant/track transport lifecycle with permission-checked publication and bounded participant admission | LiveKit Server | A/B | selected transport donor | services/presence | analysed |
| RTC-051 | presence | bounded migration packet cache preserving continuity during participant/server movement | LiveKit Server | B | transport continuity donor | services/presence | analysed |
| RTC-052 | presence | RTP loss/out-of-order/restart accounting and connection-quality telemetry | LiveKit Server | B | transport telemetry donor | services/presence + telemetry | analysed |
| RTC-053 | presence | routing/node selection and room allocation separated from Character/session domain identity | LiveKit Server | B | selected distributed transport donor | services/presence infrastructure | analysed |
| RTC-054 | presence | TURN/SIP/ingress/egress/service admission as transport capabilities only | LiveKit Server | B/C | infrastructure donor | presence/provider adapters | analysed |
