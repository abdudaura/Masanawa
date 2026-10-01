# Source Map — ChatWithStars

Pinned revision: `3ab02704118ce3d8f38a423c9a52e9d44a705aeb` (`platform-unification`)

Status: Phase 0 Pass 1 source map complete; runtime/migration deep-mine started. Calls/automation/studio/Ops still need deeper extraction.

## Scale and shape

The pinned tree contains roughly 2,226 files across 380 directories. Important top-level areas include:

- `apps/admin` — operator/admin application and acceptance/reconciliation controls.
- `services/runtime` — main conversational/control runtime.
- `services/calls` — voice/call transport runtime and recovery logic.
- `services/automation` — social/content scheduling and automation.
- `services/media-studio` — image/video/voice/lipsync/continuity production system.
- `services/certification` — certification/evidence-related service boundary.
- `packages/contracts` — typed shared contracts.
- `supabase/migrations` — long-running operational schema history and important behavior clues.
- `infra` — Modal/RunPod and deployment/GPU infrastructure.
- `src` — fan/public web.
- `docs` — canonical product/architecture and operational contracts.

Deep-mine inventory found:
- ~513 files under `services/runtime/src`;
- ~57 files under `services/calls/src`;
- ~381 Supabase migrations.

## Canonical source authority

Read `docs/PLATFORM-FOCUS.md` first. It supersedes older `BLUEPRINT.md`.

Its product model establishes:
- company-operated persistent fictional characters;
- versioned identity/appearance/voice;
- evolving life/world state;
- private fan relationship memory;
- shared character relationships/world events;
- skills and company tools;
- paid task execution;
- social publishing;
- studio/media production;
- company Ops.

## Major source subsystems observed

### Identity, scoped continuity and handoff
Evidence:
- `docs/PLATFORM-FOCUS.md`
- `services/runtime/src/star-handoff.ts`
- `services/runtime/src/star-handoff-privacy.test.ts`
- `services/runtime/src/star-cross-channel-continuity.test.ts`
- Star ownership/relationship migrations.

Important invariants now verified from source:
- named handoff transfers a bounded summary/entities/task/preferences envelope;
- handoff explicitly declares `privateMemoryIncluded: false`;
- only deterministic eligible destination can begin named handoff;
- destination must differ from source;
- only the active destination may return/complete the handoff;
- durable completion evidence must match the inherited task ID;
- evaluation/JEV replay attachment is detached from live transfer so evaluation failure does not roll back the handoff;
- transcripts, memories and commitments are Star-owned before bounded context limits are applied;
- cross-Star context fails closed by removing global fact memory and summary;
- preferences such as language/modality are per-Star relationship state;
- web/WhatsApp/Telegram all persist learned turns into the shared lifecycle;
- semantic memory search carries active Star scope.

This is stronger than merely saying "fan memory is isolated"; Masanawa needs ownership-aware continuity and handoff contracts.

### Life/world engine
Evidence:
- `services/runtime/src/star-life-engine.ts`
- `20260928011428_star_life_engine_idempotency.sql`
- life-engine tests.

Observed behavior:
- only active Stars with published, valid, 100%-complete identity Constitutions participate;
- routine slots use the character's configured timezone;
- invalid timezone falls back to UTC;
- event engine keys include Star + local date + routine-slot ID for idempotency;
- routine events carry availability, narrative state, active goal, story arc and coarse location;
- events have visibility, importance, start/end and decay times;
- expired engine events are retired;
- overlapping worker ticks are suppressed by an in-process guard.

Masanawa should preserve deterministic/idempotent world-tick behavior while replacing process-local locking with durable multi-worker-safe claims if horizontally scaled.

### Memory lifecycle
Evidence:
- `services/runtime/src/memory-lifecycle.ts`
- star memory ownership/scoped search migrations.

Observed concepts:
- read-time expiry;
- sensitivity classification;
- importance decay;
- constraint memories have a higher importance floor;
- inactive/reconciled memories are filtered out of runtime context;
- memory scope is applied before continuity limits.

Masanawa should not copy regex-based sensitivity classification as final architecture; preserve the behavioral requirement through a policy service.

### Skills, tools and expertise
Evidence:
- `docs/SKILL-TOOL-ROUTING.md`
- `services/runtime/src/skill-contract.ts`
- `services/runtime/src/agent-skills.ts`
- admin certification routes and rehearsal tests.

Skill Contract v2 source validation establishes:
- activation + negative activation;
- required/optional inputs;
- typed exact entities;
- workflow stages;
- clarification/confirmation;
- capabilities/tools/integrations;
- approvals;
- pricing;
- idempotency;
- handoff targets;
- completion/partial completion;
- recovery;
- customer promises/prohibited claims;
- quality signals;
- tests;
- certification.

Additional hard guards:
- unknown capabilities rejected;
- v2 requires negative activation, tests and certification;
- side-effect capability classes require idempotency rules;
- paid skills require confirmation rules.

This is a key Masanawa governance donor.

### JEV decision fabric
Evidence:
- JEV architecture docs;
- `services/runtime/src/jev-*`;
- provider/config/tests.

Important concept: typed bounded decisions are separate from permissions, execution and financial truth.

### Durable work and delivery idempotency
Evidence:
- durable-work/runtime tests;
- `durable-whatsapp-idempotency.test.ts`;
- worker/lease/conflict-key migrations.

Important source invariant:
- scheduled WhatsApp work checks durable outbound evidence before re-sending;
- an already-recorded delivery is recovered as completed rather than duplicated.

Masanawa should generalize this from WhatsApp to every outbound side-effect transport.

### Commerce and provider safety
Evidence:
- `docs/PLATFORM-FOCUS.md`;
- `services/runtime/src/provider-production-safety.test.ts`;
- `billing-reconciler.ts`;
- `flutterwave-inbox-retry.ts`;
- provider/payment migrations.

Verified source behaviors:
- production commerce rejects sandbox provider paths unless explicitly overridden;
- retired VTPass code must not remain as an active fallback;
- provider audit/read capabilities are distinguished from customer transaction capability;
- expired billing and stale funding provisioning are reconciled periodically;
- failed/retryable provider webhook events are claimed through durable DB state;
- webhook replay has bounded timeout and failure state recording;
- provider retries are not just process-memory retries.

The migration history also shows provider quote freshness, liquidity health, catalogue snapshots, fee ledgers, retry backoff/claims, verified recovery, cutover checks and live-read acceptance.

### Social automation
Evidence:
- `services/automation`;
- posting cadence/review queue/tenancy/token-vault/sleep-window tests;
- destination/source/publisher code.

Deep pass findings:
- queue/source/destination/posted state is tenant-scoped and the same external source/destination IDs may coexist across tenants;
- review mode is explicit: `review -> pending` on approval, `review -> rejected` on rejection; rejected/other terminal states cannot be re-approved accidentally;
- cross-tenant approval behaves as not-found rather than revealing another tenant's queue row;
- manual caption override is persisted at approval;
- publish candidates exclude review/rejected states;
- cadence can be global or destination-specific;
- queue ordering is newest-published-first with unknown dates last;
- a fresh process on the same database must neither re-enqueue nor re-post already known/published media;
- equal sleep-window start/end means no quiet window; wrap-around windows are timezone-aware;
- token vault encryption/decryption is idempotent and credentials are not treated as plain destination data.

Masanawa should generalize these into SocialPlan/PublishAttempt/ReviewDecision/ChannelCredentialRef with database-backed idempotency and tenant isolation.

### Calls/voice
Evidence:
- `services/calls`;
- call readiness, incoming/outgoing state, race, recovery, renderer-safety, delivery and provider-state tests.

Dedicated first behavior pass completed. Important requirements:
- readiness is not a single boolean: operational, degraded-but-attemptable and action-required states are distinct;
- diagnostic heartbeat staleness alone must not disable a connected engine whose primitives were previously verified;
- explicit diagnostics proving primitives unavailable must block readiness;
- pairing remains available without restart loops;
- hard recovery is escalation only after repeated soft-repair failures and sustained degradation;
- hard recovery never interrupts pairing or active/setup calls;
- incoming acceptance tolerates the race where signalling arrives before the provider call object appears;
- resident/authorized incoming control must not accidentally fall through to a competing direct accept path;
- reconnect and relink are distinct: reconnect preserves the dedicated login and keeps the HTTP gateway alive, while relink explicitly logs out/removes only the call-device browser profile;
- renderer stabilization must not race provider/WPP injection during startup/restart;
- outbound timeout preserves offer phase and provider-call state for diagnostics;
- provider state supports native CallStore compatibility when public wrappers are absent;
- live audio includes normalization/peak limiting/fade handling;
- voice identity/language is selected contextually at session start rather than hard-coded.

Still deep-mine call session state machine, Gemini Live orchestration, audio bridge implementation and resident/direct transport boundaries.

### Studio/media
Evidence:
- `services/media-studio`;
- render queue, continuity, quality gate, voice/dubbing/lipsync/export engines;
- provider interface plus Comfy/Kling/Hailuo/Runway/Veo references.

Deep pass findings:
- render queue is durable/idempotent by episode+turn key; completed jobs are not silently re-rendered unless force is explicit;
- worker claims queued work, records running/done/needs_review/requeued/failed and attempt/error metadata;
- rendered output, not plan-time guesses, becomes continuity evidence;
- previous rendered end frame may become the next turn's reference input;
- every clip is quality-gated before acceptance;
- deterministic checks include duration/frozen-video-style validation, with optional VLM judgment;
- model/VLM grading failure can degrade rather than permanently block every render;
- render/gate retries are bounded; exhaustion moves work to human review rather than infinite regeneration;
- continuity state tracks character clothing/physical mutations, props, locations and prior shot history;
- continuity state is persisted in both human-readable/project state and production DB in the legacy implementation;
- lipsync/audio fit is planned explicitly before execution and supports provider-neutral backends; GPU-dependent stages can stop in an `awaiting_backend` state;
- audio dubbing produces timed subtitle/voice manifests.

Masanawa should keep one canonical StudioProject/Shot/RenderJob/ContinuityState/QualityReview model in PostgreSQL/object storage; legacy per-project JSON/SQLite files are not canonical.

### Ops and acceptance
Evidence:
- `apps/admin`;
- acceptance health/operations, financial adjustment, observability and kill-switch tests;
- provider cutover/reconciliation/skill certification routes.

Deep pass findings:
- readiness distinguishes `live_journey_observed`, `ready_unexercised`, `dependency_unconfigured` and `live_consequential_acceptance_required`;
- missing/stale acceptance evidence for an otherwise ready capability becomes an operator warning, while an unconfigured optional dependency or a consequential journey awaiting approved exercise is guidance rather than a false incident;
- acceptance guidance explicitly says not to manufacture real customer/provider transactions merely to satisfy evidence;
- Ops surfaces active handoffs, skill dependency/action failures, stale provider/order/refund/provisioning states and privacy-safe JEV aggregate evidence;
- JEV Ops intentionally exposes aggregate disagreement/calibration/latency, not raw private state packets or hidden reasoning;
- audited financial adjustments require bounded amount, allowed direction, reason and external/case reference;
- emergency group/global stop uses a durable service-side transactional RPC and does not rewrite individual modes in the browser;
- versioned policy changes preserve already-issued user terms rather than retroactively mutating them.

Masanawa should make AcceptanceEvidence, Incident, OperatorAction and KillSwitch first-class Ops concepts.

## Schema-history signals requiring deeper mapping

Important migration families discovered:
- character core v1-v9;
- memory lifecycle and Star-scoped memory ownership/search;
- agent foundation/version/bindings/work ownership;
- unified Skill Contract v2 and skill bindings;
- named Star handoff/return/completion evidence;
- Star rehearsal job queue/leases/idempotency/supersession;
- life-engine idempotency;
- money ledger;
- wallet/funding identities and atomic cycles;
- provider event inbox/retry/cutover/liquidity/catalogue/fees;
- refund and payout lifecycle;
- conversation brain/session/posture state.

These are evidence that important production behavior lives in migrations, not only TypeScript source.

## Integration surface observed

From `.env.example` and source tree:
- Supabase/PostgreSQL;
- Gemini;
- TypeSafe/JEV;
- Flutterwave;
- Modal;
- RunPod;
- Telegram;
- Facebook;
- GitHub automation;
- Cloudflare/Astro/Railway deployment assumptions.

Provider-specific deployment assumptions are not canonical Masanawa architecture.

## Known legacy/deprecated paths

- older `BLUEPRINT.md` is historical only;
- VTPass is explicitly retired from active runtime;
- historical project names/boundaries must not be recreated.

## Phase 0A world comparison decision

Compared against AI Town at its pinned revision. ChatWithStars is selected as Masanawa's primary donor for governed life/canon semantics, while AI Town is selected for simulation-engine mechanics.

ChatWithStars behaviors retained in `packages/world`:
- Constitution-gated automatic life generation;
- immutable identity versus evolving canon versus conversation-local separation;
- timezone routines, goals, story arcs, narrative state, availability and coarse location;
- authored/life-engine/imported provenance and visibility;
- draft/approved/retired lifecycle with immutable approved canon;
- deterministic routine occurrence keys;
- tenant isolation and private-fan/shared-world separation.

Its process-local `running` overlap guard is explicitly not sufficient for Masanawa horizontal workers; ADR-0009 replaces it with durable generation/claim semantics adapted from AI Town.

See `docs/migration/WORLD-SIMULATION-ADOPTION-BOUNDARY.md`.

## Phase 0 follow-up

Runtime identity/handoff/life/memory/skill/provider first pass is underway.

Still deep-mine:
1. `services/calls` test invariants;
2. remaining runtime workflow/agent/reliability modules;
3. Supabase migrations into explicit Data Ledger mapping;
4. `services/automation`;
5. `services/media-studio`;
6. admin/Ops acceptance and recovery;
7. channel/provider details.
