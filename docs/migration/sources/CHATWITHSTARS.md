# Source Map — ChatWithStars

Pinned revision: `3ab02704118ce3d8f38a423c9a52e9d44a705aeb` (`platform-unification`)

Status: Phase 0 Pass 1 source map complete; deeper feature/behavior/data extraction remains active.

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

### Identity and world
Evidence:
- `docs/PLATFORM-FOCUS.md`
- `packages/contracts/src/star-constitution.test.ts`
- runtime identity/persona files and migrations.

Important concepts:
- immutable character ID/slug;
- versioned identity pack/Constitution;
- voice and appearance locks;
- life state separate from private fan memory;
- shared character-to-character world;
- explicit world events/ticks.

### Skills, tools and expertise
Evidence:
- `docs/SKILL-TOOL-ROUTING.md`
- `services/runtime/src/agent-skills.ts`
- `services/runtime/src/agent-skill-mapping.ts`
- admin skill certification routes.

Important concepts:
- Capability -> Tool -> Skill -> Expertise hierarchy;
- versioned skill definitions;
- agent/character skill bindings;
- risk and required integrations;
- certification/readiness;
- data-driven expert routing;
- bounded handoff context;
- durable workflows rather than prompt-only skills.

### JEV decision fabric
Evidence:
- canonical JEV architecture docs;
- `services/runtime/src/jev-*`;
- provider/config and tests.

Important concept: typed bounded decisions are separate from permissions, execution and financial truth.

### Durable work and commerce
Evidence:
- `docs/PLATFORM-FOCUS.md`;
- extensive provider/payment migrations and tests;
- Flutterwave acceptance/cutover/reconciliation tests;
- runtime payment/provider inbox modules.

Canonical task lifecycle in platform focus:
`draft -> clarifying -> quoted -> awaiting_payment -> queued -> working -> awaiting_approval -> executing -> reconciling -> completed`
with terminal alternatives.

Important behaviors:
- quote before payment;
- preserve exact user entities;
- approval at high-impact boundary;
- idempotency at side-effect boundaries;
- persist receipts;
- reconcile uncertain outcomes before retry;
- append-only financial ledger concepts.

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
- numerous tests around call readiness, incoming/outgoing state, race handling, recovery, voice delivery and provider state.

This subsystem must be mined deeply because tests encode significant reliability behavior not captured by product docs.

### Studio/media
Evidence:
- `services/media-studio`;
- engines for story, scene planning, continuity, character reference, render queue, voice, dubbing, lipsync, export and quality gates;
- provider interface plus Comfy/Kling/Hailuo/Runway/Veo references.

Important concepts:
- produced media is distinct from live conversation;
- identity consistency and continuity;
- explicit render lifecycle;
- provider replaceability;
- audio timing/lipsync/assembly;
- provenance and quality gating.

### Ops and acceptance
Evidence:
- `apps/admin`;
- provider acceptance/cutover routes;
- reconciliation/financial adjustment tests;
- skill/agent management.

Masanawa should preserve the operational idea that capability availability is evidence-driven and visible to operators.

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

- older `BLUEPRINT.md` reflects a previous product model and is historical only;
- VTPass is explicitly retired from active runtime;
- historical project names/boundaries have been undergoing unification and must not be recreated.

## Phase 0 follow-up

Deep-mine:
1. `services/runtime` by domain;
2. `services/calls` test invariants;
3. Supabase migrations by semantic domain;
4. `services/automation`;
5. `services/media-studio`;
6. admin/Ops acceptance and recovery behaviors;
7. channel and provider inventories.
