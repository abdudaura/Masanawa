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
| D-AUD-001 | AuditEvent | CWS/OpenJarvis/N.E.K.O | org | append-only | sensitive | events/security | preserve concept | immutable actor/action trail |

Phase 0 must continue mapping donor-specific stores/tables/files into these canonical concepts or explicit retirement.
