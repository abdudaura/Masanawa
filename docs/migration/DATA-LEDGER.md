# Data Ledger

Inventory semantic state concepts before designing tables. Do not mirror donor schemas mechanically.

## Current semantic inventory

| ID | Concept | Source(s) | Scope | Mutability | Sensitivity | Canonical owner | Migration need | Notes |
|---|---|---|---|---|---|---|---|---|
| D-IDN-001 | Character | CWS, N.E.K.O, CyberVerse | organization/world | mutable metadata | public/internal | identity | redesign | canonical persistent entity |
| D-IDN-002 | CharacterIdentityVersion/Constitution | CWS | character | append/versioned | internal/public projection | identity | preserve | voice/appearance/personality/bio/disclosure |
| D-IDN-003 | VoiceReference | CWS, N.E.K.O, CyberVerse | character | versioned | biometric-like/sensitive asset | identity | redesign | canonical reference, not provider config |
| D-IDN-004 | Appearance/AvatarReference | all | character | versioned | asset metadata | identity | redesign | renderer-independent |
| D-REL-001 | UserCharacterRelationship | CWS, N.E.K.O | user+character | mutable | private | identity/memory | preserve+redesign | relationship state and policies |
| D-REL-002 | CharacterRelationshipPreference | CWS | user+character | mutable | private | identity/memory | preserve | language/modality must stay character-scoped |
| D-HND-001 | CharacterHandoff | CWS | conversation+source+destination | durable lifecycle | private/internal | workflows | preserve | bounded context, active/returned/completed |
| D-HND-002 | HandoffCompletionEvidence | CWS | handoff+task | append | internal/private | workflows | preserve | must match inherited task |
| D-CON-001 | Conversation/Session | all | user+character+channel | mutable/append | private | runtime | redesign | separate durable conversation from live presence |
| D-CON-002 | Turn/Message | all | conversation | append | private | runtime | preserve semantic | modality/provenance |
| D-MEM-001 | RecentMemory | N.E.K.O | user-character/session | mutable derived | private | memory | redesign | bounded projection |
| D-MEM-002 | Fact | N.E.K.O | scoped memory | lifecycle | private/shared depending scope | memory | redesign | atomic observation + event time |
| D-MEM-003 | Reflection | N.E.K.O | scoped memory | lifecycle/versioned | private/shared depending scope | memory | redesign | evidence-backed synthesis |
| D-MEM-004 | PersonaKnowledge | N.E.K.O | character/relationship | lifecycle/versioned | private/internal | memory/identity | redesign | must not override authored Constitution silently |
| D-MEM-005 | MemoryEvidence | N.E.K.O | memory record | append/decay projection | private/internal | memory | redesign | reinforcement/disputation |
| D-MEM-006 | MemoryRecallIndex | N.E.K.O/OpenJarvis | derived | rebuildable | mirrors source sensitivity | memory | redesign | BM25/vector/etc derived |
| D-MEM-007 | MemoryOutbox/EventCursor | N.E.K.O | character/partition | mutable operational | internal | memory/events | redesign | durable replay/idempotency |
| D-MEM-008 | MemoryPolicyMetadata | CWS | memory | mutable/versioned policy | internal | memory/security | redesign | expiry, sensitivity, importance, category |
| D-WLD-001 | CharacterLifeState | CWS | character/world | mutable | shared/internal | world | preserve | separate from relationship memory |
| D-WLD-002 | WorldEvent | CWS | world | append | shared/internal | world | preserve | authoritative fictional event |
| D-WLD-003 | Routine/StoryArc/Commitment | CWS | character/world | mutable | shared/internal | world | preserve | scheduler inputs |
| D-WLD-004 | LifeEngineOccurrenceKey | CWS | character+date+routine | durable uniqueness | internal | world | preserve concept | idempotency across ticks |
| D-CAP-001 | CapabilityDefinition | CWS/OpenJarvis | platform | versioned | internal | tools | redesign | atomic capability |
| D-CAP-002 | ToolDefinition/Version | CWS/OpenJarvis | platform/tenant | versioned | internal | tools | redesign | schemas/risk/provider requirements |
| D-CAP-003 | ToolReadiness | CWS | tenant/provider | mutable derived | internal | tools | preserve | auth/health/capacity |
| D-SKL-001 | SkillDefinition | CWS/OpenJarvis | platform | versioned | internal | skills | redesign | canonical manifest |
| D-SKL-002 | SkillVersion | CWS/OpenJarvis | skill | immutable/versioned | internal | skills | preserve+redesign | workflow/governance |
| D-SKL-003 | SkillDependency | OpenJarvis | skill graph | versioned | internal | skills | redesign | tool/subskill/capability edges |
| D-SKL-004 | CharacterExpertiseBinding | CWS | character+skill | mutable/versioned | internal/public projection | skills/identity | preserve | role/certification/readiness |
| D-AGT-001 | AgentTrace | OpenJarvis | execution | append | internal/sensitive | telemetry | redesign | model/tool/skill outcome |
| D-DEC-001 | DecisionRecord | CWS JEV | turn/task | append | internal/private | decisions | preserve | schema/version/confidence/outcome |
| D-TSK-001 | Task | CWS/CyberVerse | user+character | durable mutable | private/internal | workflows | preserve+redesign | richer CWS lifecycle |
| D-TSK-002 | TaskEvent | CyberVerse/CWS | task | append | internal/private | workflows/events | preserve | ordered/reconnectable |
| D-TSK-003 | Artifact | CyberVerse/CWS | task | append/versioned | private/public depending task | workflows/storage | preserve concept | content + metadata/provenance |
| D-WF-001 | WorkflowInstance | CWS | task | durable mutable | internal | workflows | preserve | deterministic state |
| D-WF-002 | Approval | CWS | task/action | append/state | sensitive | workflows/security | preserve | actor/evidence |
| D-WF-003 | IdempotencyRecord | CWS | side-effect boundary | durable | internal | workflows/tools | preserve | replay safety |
| D-WF-004 | OutboundDeliveryEvidence | CWS | work+channel | append/unique | private/internal | workflows/events | preserve | prevents duplicate resend |
| D-COM-001 | Quote/Order | CWS | user/task | durable | financial/private | commerce | preserve | price validity |
| D-COM-002 | Payment | CWS | order | durable | financial | commerce | preserve | provider refs/state |
| D-COM-003 | LedgerEntry | CWS | account/tenant | append-only | financial | commerce | preserve | canonical money evidence |
| D-COM-004 | ProviderAttempt/Receipt | CWS | transaction | append | financial/internal | commerce | preserve | reconciliation |
| D-COM-005 | ReconciliationRecord | CWS | transaction | append/state | financial/internal | commerce | preserve | uncertain outcome handling |
| D-COM-006 | ProviderEventInboxItem | CWS | provider+event key | durable lifecycle | financial/internal | commerce | preserve | claim/retry/failure/backoff |
| D-COM-007 | ProviderAcceptance/HealthSnapshot | CWS | provider | history/derived | internal | commerce/ops | preserve | live/sandbox/cutover/readiness |
| D-SOC-001 | SocialAccount | CWS | character+channel | mutable | credentials separate | social | preserve concept | vault ref, health, cadence |
| D-SOC-002 | PlannedPost/PublishAttempt/Receipt | CWS | social account | durable | public/internal | social | preserve | outbox lifecycle |
| D-STD-001 | MediaProject/Script/Storyboard/Shot | CWS | character/project | versioned | internal | studio | preserve concept | produced-media state |
| D-STD-002 | RenderJob/Asset/Provenance | CWS | project | append/state | internal/public | studio | preserve | reproducibility |
| D-RTC-001 | PresenceSession | CyberVerse/CWS | user+character | ephemeral with durable metadata | private | presence | redesign | separate from conversation |
| D-RTC-002 | AvatarSessionMetadata | CyberVerse | presence | ephemeral | internal | presence | redesign | provider-specific details isolated |
| D-PLG-001 | PluginManifest/Installation | N.E.K.O | tenant/platform | mutable/versioned | internal | plugin system | redesign | permissions/provenance |
| D-OPS-001 | ProviderHealth/Acceptance | CWS/OpenJarvis | provider | mutable/history | internal | ops/telemetry | preserve concept | production readiness |
| D-MEM-009 | CognitionWorkAttempt/DeadLetter | N.E.K.O | memory partition/work item | durable lifecycle | internal | memory/workflows | redesign | bounded retries and liveness progression |
| D-MEM-010 | MemoryIngestEvent | N.E.K.O | turn+relationship | append | private | memory/events | redesign | foreground durable handoff to async cognition |
| D-PRO-001 | ProactiveSourceHistory | N.E.K.O | user-character/proactivity policy | durable | private/internal | proactivity | redesign | repetition/cooldown across restarts |
| D-PRO-002 | ProactiveDeliveryState | N.E.K.O | user-character/channel | durable mutable | private/internal | proactivity | redesign | unanswered/backoff/delivery state |
| D-PLG-002 | PluginRuntimeIntent | N.E.K.O | plugin installation | durable mutable | internal | plugin system | preserve concept | explicitly stopped/running/autostart intent |
| D-PLG-003 | PluginCallChain | N.E.K.O | execution | ephemeral/trace | internal | plugin system/telemetry | redesign | recursion/depth enforcement |
| D-PER-001 | ActivityPrivacyState | N.E.K.O | device/session | ephemeral | sensitive | perception | redesign | visible/private/unavailable |
| D-RTC-003 | PlaybackEpoch | CyberVerse | presence session | monotonic/ephemeral+trace | internal | presence | redesign | rejects stale feedback/output across turns |
| D-RTC-004 | MediaSyncState | CyberVerse | presence session+epoch | ephemeral | internal | presence | redesign | bounded AV delay/gap/buffer state |
| D-RTC-005 | PresencePipelineGeneration | CyberVerse | presence session | monotonic/ephemeral | internal | presence/runtime | redesign | prevents late pipeline cleanup races |
| D-TSK-004 | TaskEventSequence | CyberVerse | task | append-only monotonic | internal/private | workflows/events | preserve concept | reconnect cursor |
| D-WRK-001 | WorkerExecutionContext | CyberVerse | task+character | bounded ephemeral config | sensitive | agents/workers | redesign | role workspace and allowlists |
| D-WRK-002 | WorkerCancellation/LeaseState | CyberVerse | task execution | lifecycle | internal | agents/workers | redesign | explicit cancel, timeout, process cleanup |
| D-AVT-001 | AvatarWarmupPolicy | CyberVerse | avatar provider/deployment | configuration | internal | providers/presence | redesign | global/distributed/timeout policy |
| D-SOC-003 | SocialReviewDecision | CWS | tenant+planned post | append/state | internal/public content | social | preserve | approve/reject/caption override/operator |
| D-SOC-004 | SocialSchedulePolicy | CWS | destination/tenant | versioned config | internal | social/proactivity | redesign | cadence, quiet window, timezone |
| D-STD-003 | ContinuityState | CWS | character/project/shot | versioned state | internal | studio | preserve concept | clothing, props, physical/location state, prior frame refs |
| D-STD-004 | QualityGateResult | CWS | render job | append per attempt | internal | studio | preserve | checks/verdict/reasons/reviewer transition |
| D-STD-005 | RenderAttempt | CWS | render job | append | internal | studio | preserve | provider, attempt, output, failure/requeue/review |
| D-OPS-002 | AcceptanceEvidence | CWS | tenant+capability+release/provider | append/expiry | internal | ops/telemetry | preserve | configured/readiness distinct from observed live journey |
| D-OPS-003 | OperationalIncident | CWS | tenant+domain resource | durable lifecycle | internal | ops | redesign | stale/failure/needs-attention with safe action |
| D-OPS-004 | KillSwitch | CWS | organization/feature scope | durable mutable | sensitive | ops/security | preserve concept | global emergency pause preserving lower-scope settings |
| D-OPS-005 | FinancialAdjustment | CWS | financial account/contact | append-only request/evidence | financial | ops/commerce | preserve | direction, amount, reason, reference, actor |
| D-AUD-001 | AuditEvent | CWS/OpenJarvis/N.E.K.O | org | append-only | sensitive | events/security | preserve concept | immutable actor/action trail |
| D-AGT-002 | AgentWorkspace | OpenClaw, Letta, elizaOS | agent/character | durable | private/internal | agents/runtime | redesign | execution workspace is not canonical character identity |
| D-CHN-001 | ChannelAccountBinding | OpenClaw | agent/character+channel account | durable mutable | sensitive | gateway | redesign | explicit inbound routing and account isolation |
| D-DEV-001 | DeviceNode | OpenClaw, elizaOS | user/device | durable registration + ephemeral presence | highly sensitive | gateway/perception | redesign | capabilities, trust, availability and permissions |
| D-SKL-005 | SkillSourceInstallation | OpenClaw/OpenJarvis | workspace/tenant | versioned | internal | skills | redesign | source, revision, scope, trust/verification |
| D-MEM-011 | ActionSensitiveMemoryMetadata | OpenClaw | scoped memory | mutable/versioned | private/internal | memory/security | redesign | authority, expiry, safe-to-act condition, prohibition |
| D-MEM-012 | MemoryConsolidationCandidate | OpenClaw/N.E.K.O | scoped memory | lifecycle | private/internal | memory | redesign | dreaming/reflection/promotion candidate |
| D-MEM-013 | SharedAgentMemory | Letta | explicit shared scope | durable | private/shared by policy | memory | redesign | never implicit across users/characters |
| D-RTC-006 | PresenceWorkerJob | LiveKit Agents | session/worker | lifecycle | internal/private | presence | redesign | worker dispatch separate from domain task |
| D-WLD-005 | SimulationTick/WorldTransaction | AI Town/CWS | world | append/transactional | shared/internal | world | redesign | deterministic shared-state mutation |
| D-WF-005 | WorkflowCheckpoint | Microsoft Agent Framework | workflow | append/versioned | internal/private | workflows | redesign | restart/time-travel/human-in-loop state |
| D-PLG-004 | PluginComponentRegistration | elizaOS/OpenClaw/N.E.K.O | plugin+tenant | versioned | internal | plugin system | redesign | canonical registered skills/tools/providers/events/views |
| D-GW-001 | ExternalGatewayBridge | OpenClaw | tenant/trust-boundary | durable config + ephemeral health | sensitive | gateway | redesign | optional bridge only; not canonical runtime |
| D-DEV-002 | DevicePairingSetup | OpenClaw | user/org/device | durable lifecycle | sensitive | gateway/security | redesign | setup id, expiry, completion vs delivery-uncertain |
| D-DEV-003 | DeviceToken | OpenClaw | device | rotatable/revocable | secret | security | redesign | scoped role/access bounds |
| D-SKL-006 | ManagedSkillRevision | OpenClaw | skill | immutable revision | internal | skills | redesign | content hash + support files + executable bits |
| D-SKL-007 | SessionSkillSelection | OpenClaw | runtime session | durable/session-scoped | internal | skills/runtime | redesign | selected skill IDs/revisions pinned per session |
| D-APR-001 | ApprovalRecord | OpenClaw/CWS | action/workflow | pending->terminal | sensitive | workflows/security | preserve+redesign | first-answer-wins canonical result |
| D-AUT-001 | CurrentAuthorityAssertion | OpenClaw | mutation execution | ephemeral/derived | sensitive | security | redesign | revalidation immediately before delayed mutation |
| D-DLF-001 | ClientPresentationProfile | AIRI | character+client/user | versioned preferences | private/internal | identity/client | redesign | renderer/display preferences separate from canonical authored identity |
| D-DLF-002 | PortableCharacterPackage | AIRI/CCv3 | import/export artifact | immutable package | potentially sensitive assets | identity/import | redesign | untrusted input until validated/reviewed |
| D-AVT-002 | AvatarAssetReference | AIRI/CWS/CyberVerse | character identity version | versioned | asset/provenance | identity/avatar | redesign | renderer-neutral asset reference |
| D-AVT-003 | AvatarRendererSession | AIRI | presence/client | ephemeral | internal | client/avatar | redesign | renderer target/motion/expression/lipsync state |
| D-PLG-005 | PluginCapabilityState | AIRI | plugin session+capability | lifecycle | internal | plugin runtime | redesign | announced/ready/degraded/withdrawn |
| D-PLG-006 | PluginPermissionGrant | AIRI | extension/module | durable/versioned | security-sensitive | plugin runtime/security | redesign | concrete actions/keys after host intersection |
| D-PLG-007 | PluginCleanupDebt | AIRI | extension session | durable until settled | internal | plugin runtime | redesign | independent runtime/assets cleanup completion |
| D-VOICE-001 | VoiceInputBinding | AIRI | device/client session | ephemeral lifecycle | sensitive | client/presence | redesign | stream+provider mode+generation identity |
| D-CUA-001 | ComputerUseRunEvidence | AIRI | task/run | append | highly sensitive | tools/telemetry | redesign | approvals, screenshots, audit, tool evidence |
| D-PRS-001 | PresenceTransportBinding | LiveKit | presence session | ephemeral + external refs | private/internal | presence | redesign | room/participant/track IDs map to canonical user/character but never replace them |
| D-PRS-002 | TurnPolicy | LiveKit/Pipecat | presence session/activity | versioned runtime policy | internal | presence | redesign | detector/endpoint/interruption/speculation settings |
| D-PRS-003 | PresenceActivityHandoff | LiveKit | one presence session | ephemeral lifecycle | internal | presence | redesign | transferable STT/media resources; distinct from CharacterHandoff |
| D-PRS-004 | RemoteAvatarBinding | LiveKit/CyberVerse | presence session | ephemeral + provider refs | internal | presence/providers | redesign | generated-avatar participant, join state and cleanup |
| D-PRS-005 | PresenceRecordingPolicy | LiveKit + Masanawa | tenant/user/session | durable policy + runtime projection | highly sensitive | security/presence | redesign | consent/redaction categories compile to framework recording options |

Phase 0 must continue mapping donor-specific stores/tables/files into these canonical concepts or explicit retirement.


### Phase 0A memory comparison additions

| ID | Canonical concept | Source | Scope | Lifecycle | Sensitivity | Destination | Treatment | Notes |
|---|---|---|---|---|---|---|---|---|
| D-MEM-014 | MemoryRecord | Masanawa synthesis/N.E.K.O/Mem0 | explicit tenant+character+relationship/shared/world | append+versioned lifecycle | mirrors source; often private | memory | canonical | typed content, provenance, confidence, event/validity time, lifecycle |
| D-MEM-015 | MemoryScope | CWS + Mem0 scope discipline | tenant/character/relationship/shared/world/task | durable/versioned policy | security-sensitive | memory/security | canonical | authorization input, never inferred from embedding similarity |
| D-MEM-016 | MemoryRevision | Letta Code + N.E.K.O | memory record | append-only revision chain | mirrors record | memory | redesign | optimistic/version guarded; stale workers cannot overwrite newer state |
| D-MEM-017 | MemoryTemporalProjection | Mem0 | memory record | rebuildable | mirrors record | memory | redesign | event time/type/precision/validity for temporal retrieval |
| D-MEM-018 | MemoryEntityProjection | Mem0 | authorized memory record | rebuildable | mirrors record | memory | redesign | entity links/boosts; graph is not canonical truth |
| D-MEM-019 | WorkingMemoryBlock | Letta Code | character+relationship/session purpose | ephemeral/compiled | private/internal | memory/runtime | redesign | bounded always-visible projection, not identity or durable truth |
| D-MEM-020 | MemoryTombstone | Masanawa synthesis | memory record | durable logical deletion | sensitive/audit | memory | canonical | separate from expiry and physical purge |
| D-MEM-021 | MemoryRetrievalEvidence | Mem0/OpenClaw | query/session | append telemetry | private/internal | memory/telemetry | redesign | query, eligible scopes, signals, selected record IDs, provenance/cost |


### Phase 0A runtime/skills/plugins/workflow additions

| ID | Canonical concept | Source | Scope | Lifecycle | Sensitivity | Destination | Treatment | Notes |
|---|---|---|---|---|---|---|---|---|
| D-AGT-003 | AgentRun | OpenJarvis/elizaOS/OpenClaw | tenant+character+relationship/session | ephemeral with durable trace | private/internal | agents/runtime | redesign | strategy, effective capabilities, budgets, provider policy, trace ID |
| D-SKL-008 | SkillVersion | OpenJarvis/OpenClaw/CWS | tenant/global skill | immutable published version | internal | skills | canonical | manifest, graph, provenance, certification/readiness |
| D-SKL-009 | SkillRevisionSelection | OpenClaw | run/session | pinned | internal | skills/runtime | canonical projection | selected immutable skill versions for reproducible execution |
| D-PLG-008 | PluginManifest | elizaOS/OpenClaw | installed extension | versioned | internal/security-sensitive | plugins | canonical | declared components/dependencies/capabilities/supply-chain provenance |
| D-PLG-009 | PluginServiceInstance | elizaOS | runtime/tenant | ephemeral lifecycle | internal | plugins/runtime | redesign | admission/start/drain/stop state; never business truth |
| D-WF-006 | WorkflowDefinitionVersion | Microsoft AF + CWS | tenant/platform | immutable version | internal | workflows | canonical | typed graph + signature + policy metadata |
| D-WF-007 | WorkflowRun | Microsoft AF + CWS | tenant/workflow | durable lifecycle | private/internal | workflows | canonical | current status, definition version, principal/purpose refs |
| D-WF-008 | WorkflowCheckpoint | Microsoft AF | workflow run | append/lineage | private/internal | workflows | canonical | committed state, executor/edge state, pending requests, iteration |
| D-WF-009 | WorkflowHumanRequest | Microsoft AF | workflow run | pending->answered/expired | sensitive | workflows | canonical | approval/clarification/HITL request with durable response evidence |
| D-WF-010 | SideEffectReceipt | CWS/OpenClaw | workflow operation | append/terminal/reconciled | sensitive | workflows/domain | canonical | idempotency key, provider ref, ambiguous/reconciled outcome |

### Phase 0A canonical world/life-state additions

| ID | Canonical concept | Source | Scope | Lifecycle | Sensitivity | Destination | Treatment | Notes |
|---|---|---|---|---|---|---|---|---|
| D-WLD-006 | World | AI Town + CWS + Masanawa | tenant/world | durable/versioned policy | shared/internal | world | canonical | stable world identity; not donor game document |
| D-WLD-007 | WorldPolicy | Masanawa synthesis | world | versioned | internal/security-sensitive | world | canonical | simulation mode, catch-up, canon admission, spatial/proactivity policy |
| D-WLD-008 | WorldActorState | AI Town + CWS | world+character | mutable projection | shared/internal | world | canonical projection | activity, availability, semantic/spatial location; identity remains external |
| D-WLD-009 | WorldEvent | CWS + AI Town | tenant/world/character | append + governed lifecycle | public/shared/internal/private by policy | world | canonical | provenance, visibility, effective/recorded time, canon status |
| D-WLD-010 | WorldInteraction | AI Town | world+actors | append | shared/internal | world | canonical evidence | encounter/conversation/activity evidence; not private relationship memory |
| D-WLD-011 | SimulationInput | AI Town + Masanawa | world | ordered durable lifecycle | varies | world | canonical | monotonic sequence/idempotency key, admitted/rejected/completed outcome |
| D-WLD-012 | WorldGeneration | AI Town | world | monotonic | internal | world | canonical concurrency token | CAS/lease authority for simulation commits |
| D-WLD-013 | SimulationStep | AI Town | world+generation | append/transactional | internal | world | canonical evidence | from/to simulation time, processed input range, outcome/event refs |
| D-WLD-014 | WorldSpace | AI Town | world | versioned | shared/internal | world | optional canonical module | map/scene/topology; absent for non-spatial worlds |
| D-WLD-015 | LocationProjection | AI Town + CWS | actor/world | mutable + history | shared/internal | world | canonical projection | coordinate or semantic/coarse location with effective time |
| D-WLD-016 | CanonAdmission | CWS + Masanawa | world event/proposal | draft->approved/retired or auto-policy | internal | world/ops | canonical | records authored/engine/model provenance and policy/approval evidence |

### Phase 0B ChatWithStars forensic additions

| ID | Canonical concept | Source | Scope | Lifecycle | Sensitivity | Destination | Treatment | Notes |
|---|---|---|---|---|---|---|---|---|
| D-ENT-001 | EntitlementPolicyVersion | CWS | platform/plan | immutable/versioned | internal | entitlements | preserve concept | trial/subscription allowance policy is versioned, not hard-coded runtime truth |
| D-ENT-002 | ConsumerEntitlementReservation | CWS | platform user + source message | reserved->delivered/released/blocked | private/billing | entitlements/workflows | preserve | reservation before response delivery prevents double-consumption; stale reservations release |
| D-PRV-001 | PrivacyErasureRequest | CWS | authenticated subject | requested->confirmed->executed | highly sensitive | privacy/security | preserve+redesign | exact confirmation/actor evidence; no guessed identity |
| D-PRV-002 | PrivacyRetentionProjection | CWS | erased subject/financial records | durable minimized record | financial/audit | privacy+commerce | preserve | receipt/reconciliation continuity retained without tenant/contact linkage |
| D-MSN-001 | Mission | CWS | tenant + optional conversation/contact | draft->queued->running/waiting/blocked->terminal | private/internal | workflows/proactivity | preserve concept | objective, constraints, budget, deadline, autonomy mode |
| D-MSN-002 | MissionWorkItem | CWS | mission | queued/leased/running->terminal | private/internal | workflows | preserve+redesign | lease/retry/error/owner notification semantics |
| D-GRP-001 | GroupProfile | CWS | tenant+group/channel | mutable projection | group/private | relationships/world | preserve+redesign | purpose/topics/languages/norms/open threads/confidence |
| D-GRP-002 | GroupPolicy | CWS | tenant+group | versioned mutable | internal | relationships/security | preserve | moderation/proactivity/topics/rate limits separate from inferred profile |
| D-CVI-001 | CivicClaimLifecycle | CWS | tenant+jurisdiction/entity | current/superseded/disputed/stale | public/internal provenance | verticals/civic+knowledge | preserve concept | historical rows retained; answer eligibility is lifecycle-driven |
| D-COM-008 | CreatorPayout | CWS | tenant + payout account | reserved->processing->succeeded/failed/uncertain | financial | commerce/workflows | preserve | idempotency key, reserve ledger, provider transfer, uncertain-state reconciliation |
| D-COM-009 | ConsumerSubscription | CWS | platform user | active/past_due/cancelled/expired | financial/private | entitlements+commerce | preserve concept | billing state separate from capability authorization |
| D-COM-010 | ConsumerUsageReservation | CWS | platform user+message+modality | reserved/delivered/released/blocked | private/billing | entitlements | preserve | delivery-coupled usage accounting |

### Phase 0B provider synthesis additions

| ID | Canonical concept | Source | Scope | Lifecycle | Sensitivity | Destination | Treatment | Notes |
|---|---|---|---|---|---|---|---|---|
| D-PVD-001 | ProviderDefinition | Masanawa synthesis/OpenJarvis/OpenClaw/AIRI | platform | versioned | internal | providers | canonical | capability families, auth schemes, supported operations, provenance |
| D-PVD-002 | ProviderOperationDefinition | Masanawa synthesis/ChatWithStars | provider+capability | immutable/versioned | internal | providers | canonical | effect class, timeout, retry class, idempotency, reconciliation, readiness |
| D-PVD-003 | ProviderCredentialRef | Masanawa synthesis | tenant/org/user/device | rotatable/revocable | secret reference | providers/security | canonical | opaque vault ref + scope/environment/fingerprint metadata only |
| D-PVD-004 | ProviderReadinessEvidence | ChatWithStars Flutterwave + Masanawa | provider+environment+requirement | append/current projection | sensitive/internal | providers/ops | canonical | freshness, observed fingerprint, dependencies, invalidation |
| D-PVD-005 | ProviderAttempt | ChatWithStars/Google/Gemini/JEV/Telegram | workflow operation | append | private/internal | providers/telemetry | canonical | attempt number, request fingerprint, normalized result, redacted error |
| D-PVD-006 | ProviderReceipt | ChatWithStars commerce/social/studio/channel | provider operation | append/unique | varies | providers + owning domain | canonical | definitive external evidence; never replaces domain truth |
| D-PVD-007 | ProviderReconciliation | ChatWithStars Flutterwave + synthesis | ambiguous provider attempt | pending->resolved/needs_attention | sensitive/internal | providers/workflows | canonical | lookup/webhook/poll/operator outcome before retry |
| D-PVD-008 | ProviderAcceptanceEvidence | ChatWithStars Ops | provider+capability+environment | append/expiry | internal | ops/providers | canonical | current end-to-end production journey distinct from config/readiness |

### Phase 0B OpenJarvis remediation data concepts

| ID | Canonical concept | Source | Scope | Lifecycle | Sensitivity | Destination | Treatment | Notes |
|---|---|---|---|---|---|---|---|---|
| D-CON-001 | ConnectorSyncCheckpoint | OpenJarvis | tenant+connector source binding | durable mutable | private/internal | connectors/workflows | redesign | cursor, items, last-success watermark, error; source swap resets checkpoint |
| D-CON-002 | IngestedDocumentProvenance | OpenJarvis | tenant+connector document/chunk | append/versioned projection | source-dependent | knowledge | redesign | source/doc/chunk/hash/timestamp/embedding version; canonical source evidence retained |
| D-LRN-001 | LearningSession | OpenJarvis | optimization run | durable lifecycle | internal | telemetry/learning | redesign | trigger, diagnosis/plan, benchmark before/after, cost, autonomy mode, status |
| D-LRN-002 | LearningEditCandidate | OpenJarvis | learning session | proposed->review/staged->accepted/rejected/rolled_back | internal/security-sensitive | learning/skills/ops | redesign | risk tier, target, benchmark delta, approval evidence |
| D-LRN-003 | LearningCheckpoint | OpenJarvis | staged config/skill/tool revision | immutable lineage | internal | learning/versioning | redesign | pre/post revision, session/edit/risk metadata, rollback lineage |
| D-APR-020 | PendingToolAction | OpenJarvis | principal+tool action | pending->approved/denied/expired/executed | sensitive | workflows/security | redesign | donor SQLite status semantics; Masanawa authority/current-policy revalidation still required |
| D-SES-020 | RuntimeSession | OpenJarvis | channel/runtime principal | durable session + bounded history | private | agents/gateway | redesign | never canonical Character/user/relationship identity |
| D-SCH-020 | ScheduledTrigger | OpenJarvis | tenant/workflow | active/paused/cancelled/completed | private/internal | workflows/proactivity | redesign | once/interval/cron + timezone + next run |
| D-SCH-021 | ScheduledRunEvidence | OpenJarvis | scheduled trigger | append | internal | workflows/telemetry | redesign | result/error/start/end evidence |

### Phase 0B N.E.K.O remediation data concepts

| ID | Canonical concept | Source | Scope | Lifecycle | Sensitivity | Destination | Treatment | Notes |
|---|---|---|---|---|---|---|---|---|
| D-ASR-001 | VoiceTurnCandidate | N.E.K.O | presence session + input generation | ephemeral lifecycle + trace | voice/private | presence | redesign | candidate generation, suppression, provider route, delivery state; stale generation cannot commit |
| D-ASR-002 | EndpointingEvidence | N.E.K.O | voice turn | ephemeral/trace | voice-derived | presence/telemetry | redesign | VAD/smart-turn/activity evidence and reason; model artifacts are provider assets, not domain truth |
| D-SPK-001 | SpeakerRecognitionProfile | N.E.K.O | user/device/security profile | durable versioned | biometric/highly sensitive | security/presence | redesign | optional enrollment/profile refs; never sole authentication or Character identity |
| D-SPK-002 | SpeakerRecognitionAttempt | N.E.K.O | presence turn | append/ephemeral trace | biometric/highly sensitive | security/telemetry | redesign | score/profile/policy revision/result; stale activation cannot overwrite current policy |
| D-ACT-001 | DeviceActivitySnapshot | N.E.K.O | device/session | ephemeral/short retention | highly sensitive | perception | redesign | focus/system signals + privacy state; only admitted projection can reach proactivity |
| D-CFG-001 | ConfigurationRevision | N.E.K.O | user/device/client config | immutable revision + current pointer | private/internal | config/storage | redesign | schema/version/source/migration lineage; files are not canonical identity/world truth |
| D-CFG-002 | CloudSaveSnapshot | N.E.K.O | user/device config bundle | staged->verified->current/superseded | private/internal | config/storage | redesign | fencing/staging prevents stale/partial snapshot replacing newer healthy config |
| D-PLG-020 | PluginInstallationTransaction | N.E.K.O | tenant/plugin installation | preparing->validated->replacing->committed/rolled_back | security-sensitive | plugins/workflows | redesign | source ownership, preflight, operation lock, previous healthy version, rollback evidence |
| D-PLG-021 | PluginMessageEnvelope | N.E.K.O | plugin runtime call/event | ephemeral + trace | varies | plugins/events | redesign | typed RPC/pubsub/event, call chain/deadlock metadata; never domain truth |
