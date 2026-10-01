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
- tests for cadence, review queues, destinations, auth and publishing;
- social integration environment configuration.

Important capabilities:
- scheduled/continuous ingestion and posting;
- destination abstraction;
- review queues;
- token vault/security;
- retry/error surfacing;
- multi-tenant automation concepts.

### Calls/voice
Evidence:
- `services/calls`;
- tests around call readiness, incoming/outgoing state, race handling, recovery, voice delivery and provider state.

Still requires dedicated behavior-mining pass.

### Studio/media
Evidence:
- `services/media-studio`;
- engines for story, scene planning, continuity, character reference, render queue, voice, dubbing, lipsync, export and quality gates;
- provider interface plus Comfy/Kling/Hailuo/Runway/Veo references.

Still requires dedicated behavior-mining pass.

### Ops and acceptance
Evidence:
- `apps/admin`;
- provider acceptance/cutover routes;
- reconciliation/financial adjustment tests;
- skill/agent management.

Masanawa should preserve evidence-driven production readiness and operator-visible capability health.

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
