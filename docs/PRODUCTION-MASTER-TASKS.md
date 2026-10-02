# Masanawa Production Master Task Ledger

Status: canonical progress ledger.

## Tracking rule

Masanawa production is tracked as **150 numbered milestone tasks**. Tasks are not equal in effort, so the number is a deterministic tracker rather than a linear percent-complete estimate. A task becomes COMPLETE only when its acceptance evidence is merged to `main`. New discoveries should be absorbed into the relevant task acceptance criteria whenever possible so numbering remains stable.

## Current position

Merged `main` satisfies Tasks **001-057**.

**Current: Task 058 of 150 — Establish environment/config/deployment contract conventions and validate them with env-schema checks.**

Task 057 implementation head `fbdd51b0b113f8d40c625086d0a851c3de60a7f0` passed Foundation CI run 394. PR #51 merged as `5395b29c1bfa5705d447152d3ff3c606c0658ed6`; merged-main Foundation CI run 395 passed on that exact merge commit.

Task 056 implementation head `b17d4ba53d23abb9abf40aa7800b1c461dc9fa90` passed Foundation CI run 386. PR #49 merged as `ed119581974cfb146da0b6e0a5e119eda8731df8`; merged-main run 387 passed. Supplemental acceptance hardening PR #50 merged as `b07565a315c35dc1ef840c89845ccfd2836c2da4`; merged-main run 391 passed.

Task 055 implementation head `931fef83ae1a014c6872d0e5bfc0cab815307e44` passed Foundation CI run 383. PR #48 merged as `434f64c6ff0ca1061d3e8ecd163daf4b591962d0`; merged-main Foundation CI run 384 passed on that exact merge commit.

Status: `[x]` COMPLETE, `[ ]` PLANNED.

## Tasks 001-010 — Product, source and architecture truth

- [x] **001** Establish Masanawa as the canonical greenfield platform rather than a donor-repo merger.
- [x] **002** Freeze the reference-source landscape and donor provenance model.
- [x] **003** Complete feature/behaviour/data/integration source forensics.
- [x] **004** Define the canonical product vision and complete target capability families.
- [x] **005** Define the canonical domain model and one-truth ownership rules.
- [x] **006** Define package boundaries and forbidden dependency directions.
- [x] **007** Define service boundaries and coarse deployable topology.
- [x] **008** Define canonical event, data and persistence architecture.
- [x] **009** Define security/authority/privacy architecture and golden journeys.
- [x] **010** Lock donor ownership decisions and ADR governance.

## Tasks 011-020 — Engineering foundation

- [x] **011** Establish pnpm/TypeScript monorepo and strict compiler baseline.
- [x] **012** Establish canonical IDs, typed errors, time and shared contracts.
- [x] **013** Establish PostgreSQL 18 canonical storage and migration discipline.
- [x] **014** Establish Fastify service bootstrap and typed service contracts.
- [x] **015** Establish web and Ops application shells.
- [x] **016** Establish workload/service authentication foundation.
- [x] **017** Establish event/outbox/audit/idempotency operation foundation.
- [x] **018** Establish telemetry/observability contract foundation.
- [x] **019** Establish test harnesses, PostgreSQL integration tests and CI.
- [x] **020** Establish architecture-boundary tests and dependency enforcement.

## Tasks 021-030 — Character identity and world

- [x] **021** Implement Tenant/User/Character canonical identity.
- [x] **022** Implement immutable/versioned Character Constitution.
- [x] **023** Implement appearance, voice and expertise identity references.
- [x] **024** Implement private User-Character Relationship model.
- [x] **025** Implement World generation/input/step foundation.
- [x] **026** Implement CharacterLifeState and governed canon events.
- [x] **027** Implement routines, story arcs and commitments.
- [x] **028** Implement Character/World interactions and typed evidence.
- [x] **029** Implement pause/restart/catch-up and world recovery.
- [x] **030** Close non-spatial Identity/World privacy and acceptance gates.

## Tasks 031-040 — Memory and cognition foundation

- [x] **031** Implement canonical MemoryRecord, scope and revision model.
- [x] **032** Implement immutable evidence/provenance and verbatim source preservation.
- [x] **033** Enforce relationship/private/shared/world/task memory isolation.
- [x] **034** Implement correction, lifecycle, tombstone and purge semantics.
- [x] **035** Implement durable extraction custody/liveness/dead-letter handling.
- [x] **036** Implement lexical/vector/entity/temporal rebuildable projections.
- [x] **037** Implement authorized hybrid retrieval and ranking boundaries.
- [x] **038** Implement bounded context compilation.
- [x] **039** Implement reflection/consolidation/compaction admission.
- [x] **040** Close held-out memory evaluation and acceptance gate.

## Tasks 041-050 — Tools, Providers and consequential effects

- [x] **041** Implement canonical versioned Tool registry/contracts.
- [x] **042** Implement canonical versioned Provider registry/contracts.
- [x] **043** Implement capability/readiness/selection semantics.
- [x] **044** Implement authorized Tool execution and Operation admission.
- [x] **045** Implement idempotency and consequential side-effect reconciliation.
- [x] **046** Implement durable receipts and replay semantics.
- [x] **047** Implement typed Provider failure/dispatch-certainty model.
- [x] **048** Implement privacy-safe Provider execution telemetry.
- [x] **049** Implement scoped encrypted Provider credential custody/rotation/revocation.
- [x] **050** Close Phase 5 acceptance and merged-main CI gate.

## Tasks 051-058 — Production structure hardening

- [x] **051** Audit repository topology against the Product North Star and lock the production target structure.
- [x] **052** Introduce first-class canonical Devices ownership for Device/Capability/Character assignment contracts.
- [x] **053** Remove ambiguous empty service ownership placeholders and reaffirm Gateway/Worker/Presence/Ops topology.
- [x] **054** Standardize package/service implementation templates and enforce them in architecture tests.
- [x] **055** Standardize adapter topology/registration and prohibit adapter-to-adapter hidden orchestration.
- [x] **056** Expand test taxonomy with security/recovery/load/chaos suites and CI gate conventions.
- [x] **057** Establish repository-wide public API/versioning/deprecation conventions.
- [ ] **058** Establish production configuration/environment schema, secret-reference and deployment-layout conventions.

## Tasks 059-070 — Skills

- [ ] **059** Implement canonical Skill and immutable SkillVersion schemas.
- [ ] **060** Implement Skill manifest validation and import format.
- [ ] **061** Implement capability requirements and Tool references.
- [ ] **062** Implement Skill dependency graph and cycle/conflict validation.
- [ ] **063** Implement Skill execution planning/composition.
- [ ] **064** Implement SkillTool/subskill execution boundaries.
- [ ] **065** Implement Skill provenance, trust and publisher metadata.
- [ ] **066** Implement risk/capability classification.
- [ ] **067** Implement rehearsal/certification evidence.
- [ ] **068** Implement readiness/eligibility and revision pinning.
- [ ] **069** Implement trace metadata and deterministic failure semantics.
- [ ] **070** Pass Skills acceptance tests including cloud/device-provider neutrality.

## Tasks 071-082 — Agent runtime

- [ ] **071** Implement CharacterSession canonical runtime contract.
- [ ] **072** Implement AgentRun identity, lineage and durable trace references.
- [ ] **073** Implement AgentStrategy interface and provider-neutral inference boundary.
- [ ] **074** Implement Character-aware context compiler using Identity/Memory/World.
- [ ] **075** Implement tool/skill selection orchestration.
- [ ] **076** Implement run budgets, token/cost/time/tool guards.
- [ ] **077** Implement foreground conversational strategy.
- [ ] **078** Implement research/multi-step strategy.
- [ ] **079** Implement background/delegated specialist strategy.
- [ ] **080** Implement run cancellation, supersession and stale-result protection.
- [ ] **081** Implement AgentRun telemetry/evidence and operator diagnostics.
- [ ] **082** Pass agent-runtime golden journey and provider/model replacement tests.

## Tasks 083-096 — Decisions, tasks and durable workflows

- [ ] **083** Implement bounded typed Decision/JEV contracts.
- [ ] **084** Implement Workflow and immutable WorkflowVersion graph model.
- [ ] **085** Implement WorkflowRun and Task canonical state.
- [ ] **086** Implement transactional task admission/outbox.
- [ ] **087** Implement atomic task checkout/lease/fencing.
- [ ] **088** Implement heartbeats, stale-run adoption and crash recovery.
- [ ] **089** Implement versioned checkpoints and compatibility validation.
- [ ] **090** Implement retries/backoff and dead-letter/needs-attention.
- [ ] **091** Implement human-in-loop pending requests and approvals.
- [ ] **092** Implement schedules/occurrences and durable timers.
- [ ] **093** Integrate Tool Operations/receipts/reconciliation into workflow truth.
- [ ] **094** Implement workflow cancellation/compensation/supersession semantics.
- [ ] **095** Implement workflow/run cost and operator visibility.
- [ ] **096** Pass restart/no-duplicate-side-effect workflow acceptance suite.

## Tasks 097-108 — Gateway, channels and Device control plane

- [ ] **097** Implement durable ingress admission/dedupe and normalized subject envelope.
- [ ] **098** Implement deterministic Tenant/User/Relationship/Character routing.
- [ ] **099** Implement CharacterSession command/streaming gateway APIs.
- [ ] **100** Implement channel binding/account lifecycle model.
- [ ] **101** Implement WhatsApp adapter end-to-end.
- [ ] **102** Implement Telegram adapter end-to-end.
- [ ] **103** Implement email/webhook extensible channel pattern.
- [ ] **104** Implement Device registration and secure pairing.
- [ ] **105** Implement DeviceCapability publication/readiness/health.
- [ ] **106** Implement CharacterDeviceAssignment and capability policy.
- [ ] **107** Implement device credential generation/revocation and reconnect control plane.
- [ ] **108** Pass cross-channel continuity and Device replacement/revocation journeys.

## Tasks 109-118 — Proactivity and perception

- [ ] **109** Implement normalized permission-scoped PerceptionEvent.
- [ ] **110** Implement text/file/document perception admission.
- [ ] **111** Implement device microphone/camera/screen perception contracts.
- [ ] **112** Implement notification/device-state/location sensor contracts.
- [ ] **113** Implement proactive trigger model for schedules/events/conditions.
- [ ] **114** Implement promises, commitments and follow-up triggers.
- [ ] **115** Implement quiet hours, frequency, privacy and relationship policy.
- [ ] **116** Implement routine/world-event proactive integration.
- [ ] **117** Implement perception-to-memory promotion governance.
- [ ] **118** Pass governed offline/online proactivity and privacy acceptance suite.

## Tasks 119-130 — Realtime presence and Agent Phone embodiment

- [ ] **119** Implement canonical PresenceSession and CharacterSession bridge.
- [ ] **120** Integrate LiveKit WebRTC transport.
- [ ] **121** Implement realtime STT/LLM/TTS and direct-live provider seams.
- [ ] **122** Implement semantic turn detection, interruption/barge-in and playback generations.
- [ ] **123** Implement renderer-neutral avatar/presentation provider.
- [ ] **124** Build minimal Masanawa Android Agent Device runtime.
- [ ] **125** Implement signed DeviceOperation local custody/offline queue/receipt replay.
- [ ] **126** Integrate OmniSIP as Android telephony Device Provider.
- [ ] **127** Implement real inbound/outbound cellular call Character routing.
- [ ] **128** Implement SMS/USSD Device capabilities.
- [ ] **129** Implement approved mobile app/browser/notification automation capabilities.
- [ ] **130** Pass real-device, connectivity-loss, call ambiguity and device-replacement acceptance suite.

## Tasks 131-138 — Social, commerce and studio

- [ ] **131** Implement canonical social identity/account binding and content state.
- [ ] **132** Implement social draft/approval/publish/outbox/receipt/retry journey.
- [ ] **133** Implement deterministic quote/payment/ledger/fulfillment domain.
- [ ] **134** Implement payment reconciliation/refund/adjustment/receipt journeys.
- [ ] **135** Implement Studio project/artifact/provenance domain.
- [ ] **136** Implement script/storyboard/render/voice/lipsync production workflow.
- [ ] **137** Enforce Character identity consistency across social/media/commerce.
- [ ] **138** Pass social, commerce and studio production golden journeys.

## Tasks 139-144 — Plugins, evaluation and governed learning

- [ ] **139** Implement Plugin manifest/component/capability/lifecycle model.
- [ ] **140** Implement plugin trust/permissions/versioning/uninstall behavior.
- [ ] **141** Implement external MCP/A2A/protocol bridge pattern where justified.
- [ ] **142** Implement trace/evaluation datasets and regression harness.
- [ ] **143** Implement candidate optimization/learning pipeline with promotion gates.
- [ ] **144** Pass plugin isolation and no-silent-self-mutation acceptance tests.

## Tasks 145-150 — Production hardening, launch and cutover

- [ ] **145** Complete production security review, abuse cases, tenant isolation and secret-leak testing.
- [ ] **146** Complete performance/load/backpressure/realtime-latency/fleet capacity validation.
- [ ] **147** Complete observability/SLOs/alerts/runbooks/incident and reconciliation operations.
- [ ] **148** Complete backup/restore/DR, migration, rollback, data export/deletion and credential/device recovery drills.
- [ ] **149** Run all golden journeys in production-like pilot, resolve parity ledger and prove rollback/cutover readiness.
- [ ] **150** Production release: cut over canonical Masanawa, verify post-release health, and close the first complete-generation acceptance audit.

## Completion meaning

Task 150 means the first complete Masanawa generation has proven persistent Character identity, scoped memory, capable Skills/Tools/Providers, resilient Agent runtime and Workflows, multi-channel continuity, governed proactivity/perception, realtime presence, real Agent Phone embodiment, social/commerce/studio journeys, extension safety, security/recovery/observability and a production pilot with rollback evidence.

After Task 150, future items are product evolution rather than unfinished first-generation platform construction.