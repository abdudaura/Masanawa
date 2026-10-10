# Masanawa — Architecture, data and integration contract 1.1
**Target architecture, revised 2026-10-10 against actual `main` source.** Extend the existing monorepo (Node 24 / pnpm 12 / TypeScript 7 / Vitest 5 / PostgreSQL 18 / Flutter). Do not start a second platform, a microservice fleet or a second database. BLUEPRINT is the product authority, SCREENS defines the UI bindings and DELIVERY defines execution.

## 1. Topology (affordable, modular)
```text
apps/mobile (Flutter, consumer) ─┐
apps/admin_mobile (Flutter)      ─┼─ HTTPS + one authenticated WSS ─▶ services/gateway (TS, modular monolith)
                                 │                                    │  modules/* (auth, masana, feed, videos,
                                 │                                    │  chats, calls, rooms, subscriptions, gwani,
                                 │                                    │  moderation, finance, notifications, admin)
                                 │                                    ▼
                                 │                     PostgreSQL 18 (one cluster, schema-per-owner package)
                                 │                       events.outbox / inbox (existing durable job journal)
                                 │                                    ▲
                                 │                     services/worker (TS) jobs/* — leases, retries, budgets
                                 │                     services/presence (Python, LiveKit agent) — fan↔Masana calls
                                 ▼
                     S3-compatible private object store (original images/audio only; signed URLs)
External adapters (server-side only): Gemini (text + Live voice), LiveKit, FCM, Google Play Developer API + RTDN,
Flutterwave (via fixed-IP relay only if whitelisting requires it), NOWPayments, YouTube Data API + WebSub,
TikTok Display API + embed player, Meta Graph (Page video) + embedded player.
```
- **Deploy units:** 3 always-on processes (gateway, worker, presence) plus managed Postgres and object storage. Railway hosts dev and staging. Scaling is horizontal on gateway and worker, which are stateless (leases live in PG). Presence scales by LiveKit agent workers. No Kubernetes, no Redis requirement, and no Kafka. Postgres `LISTEN/NOTIFY` and outbox polling are enough to well beyond launch scale. Add Redis only for measured hot paths such as rate-limit counters or feed caches.
- **Credentials** live only on the server. Models never get DB admin access, payment credentials, a shell or unbounded spend. Every tool an agent calls goes through the same authorized service layer a staff user would use, with the agent's service principal and autonomy level.
- **Railway:** `masanawa-gateway` auto-deploys from `main` on the Git source. Before any merge to `main`, inspect the deploy hooks and the startup migration command (`services/gateway/src/migrate.ts`). Data-bearing deploys require a verified backup and a tested restore first.

## 2. Code organization (feature-first, inside existing roots)
```text
apps/mobile/lib/src/app/                      # AF00: bootstrap, router, shell, DI, theme wiring
apps/mobile/lib/src/features/{account,home_feed,videos,masana,chats,calls,rooms,subscriptions,gwani,wallet,bills,crypto,notifications}/
apps/mobile/lib/src/shared/{design,media,transport,cache,l10n,widgets}/
apps/admin_mobile/lib/src/app/                # AF00: admin shell, RBAC-filtered drawer
apps/admin_mobile/lib/src/features/{overview,masana_studio,content_studio,missions,rooms,plans,external_videos,fans_memory,moderation,finance,operations}/
services/gateway/src/modules/<domain>/{routes,service,contract}.ts + *.test.ts
services/gateway/src/modules/index.ts         # registry: one export line per module (append-only)
services/worker/src/jobs/<domain>/*.ts          services/worker/src/jobs/index.ts (append-only)
packages/<domain>/{src,migrations}/             # domain logic + SQL migrations owned by that package
adapters/storage/postgres/src/<domain>/         # repositories (SQL), integration tests
tests/e2e/<journey-id>/                         # journey tests J01–J20
```
**Domain packages.** Packages marked new are created by their lane:

| Package | Status | Owns |
|---|---|---|
| `contracts` | existing | versioned DTOs and error codes, shared by gateway and Flutter codegen |
| `identity` | existing | tenants, users, sessions linkage, characters (agent identity), account deletion |
| `security` | existing | platform sessions, credentials, approvals, staff roles (extend) |
| `events` | existing | outbox/inbox leases, audit, idempotency, receipts, reconciliation. **This is the only job journal.** |
| `agents` | existing | agent configs, runs, platform-agent defaults (Gwani) |
| `memory` | existing | records, revisions, evidence, tombstones, reflections. Fan memory reuses it. |
| `skills` | existing | skill catalog, guides, teaching progress (Room curriculum reuses it) |
| `commerce` | existing | ledger, NGN wallet, billing, crypto. **Only financial authority.** |
| `providers`, `tools`, `postgres` | existing | provider clients, agent tools, PG pool and migration runner |
| `masana` | **new** | character revisions, media, voice profiles, follows, missions, posting slots |
| `feed` | **new** | posts, post media, comments, reactions, saves, counters |
| `external-videos` | **new** | sources, items, sync cursors, ingestion events, review |
| `rooms` | **new** | rooms, membership, lessons, questions, answers, discussion, plans, prices, entitlements |
| `moderation` | **new** | cases, evidence refs, actions, appeals, policy revisions |
| `talks`, `world` | retained | `talks` keeps migrations and history only. `world` is reviewed for canon reuse, then retired (SOURCE-CLEANUP). |

Naming: TypeScript files are `snake_case.ts` by domain. Dart uses `*_screen.dart`, `*_controller.dart`, `*_repository.dart` and `*_model.dart`. No `twin_*`, `talk_*` or `new_*` names in new code.

## 3. Migration system (actual, not conceptual)
- The runner is `runMigrations(pool, platformProductMigrationRoots())` in `@masanawa/postgres` (`adapters/storage/postgres/src/migrations.ts`, `readiness.ts`). Its registry table is **`public.masanawa_schema_migrations(owner, name, sha256)`**, so an applied file is **immutable**: changing it changes the checksum and fails readiness.
- Each owner package keeps `packages/<pkg>/migrations/NNNN_name.sql` and has its own schema (`identity.`, `commerce.`, `events.`, `memory.`, …). New packages register their root in `platformProductMigrationRoots()`. Only the AF00 integrator edits that file.
- Numbering is the next unused 4-digit prefix **within the owner**. Existing duplicates (`commerce/0102_*` ×2, `talks/0007_*` ×2) are applied history and stay. A new CI check rejects new duplicate prefixes.
- **Tables follow the existing convention:** `tenant_id text NOT NULL` first, composite primary keys `(tenant_id, <id>)`, FKs including `tenant_id`, `created_at/updated_at timestamptz`, text IDs generated by the service (prefixed ULID, e.g. `post_01J…`), money in `bigint` minor units with an ISO currency, and state columns with `CHECK` constraints.
- **Forward-only.** Retiring a feature means (1) a deny at route, socket and job level, (2) a migration that revokes write grants or adds a `CHECK` / trigger rejecting new rows, (3) read-only retention, and (4) dropping only after export, ledger reconciliation and owner approval. **The repo has no `database/migrations` folder**, so do not create one. Seeds are code (`packages/masana/src/seed/*`), staging-gated and idempotent.
- Every migration PR must pass three checks: **fresh** (empty PG18 → all), **upgrade** (restored snapshot of the current staging schema → all) and **checksum** (no applied file changed).

## 4. Data model (new and extended tables)
The list below is normative for names and keys. Columns beyond keys, states and indexes are left to the lane.

**masana.**
- `character_revisions(tenant_id, character_id, revision)`: bible JSON, voice_profile_id, state `draft|approved|retired`. FK to `identity.characters`. A unique partial index enforces one `approved` revision per character.
- `character_media(tenant_id, media_id)`: kind `portrait|banner|cover`, object_key, rights_note, approved_by.
- `follows(tenant_id, fan_user_id, character_id)` primary key. Index on `(tenant_id, character_id, created_at)`.
- `missions(tenant_id, mission_id)`: character_id, week_start, objective, autonomy_level, budget_minor, state.
- `posting_slots(tenant_id, character_id, weekday, local_time, tz)`.
- `mission_runs(tenant_id, run_id)`: mission_id, step, events.operation_id, cost_minor, state.

**feed.**
- `posts(tenant_id, post_id)`: character_id, kind `text|image|audio`, kind_version, body, language, related_room_id NULL, bible_revision, state `draft|in_review|scheduled|published|taken_down`, publish_at, idempotency_key UNIQUE. The publisher must be a Masana, enforced by FK to `identity.characters` plus a `kind='platform_masana'` check through a trigger. Index on `(tenant_id, state, publish_at DESC)`.
- `post_media(tenant_id, post_id, ordinal)`: media_id, kind `image|audio|cover`, duration_ms, transcript, width/height.
- `comments(tenant_id, comment_id)`: post_id, parent_comment_id, author_user_id **or** author_character_id (XOR check), body, state `visible|held|hidden|removed`, author_anonymized boolean.
- `reactions(tenant_id, post_id, user_id)` primary key with a reaction kind. `saves(tenant_id, user_id, post_id)` primary key.
- `post_counters(tenant_id, post_id)`: reactions, comments, saves, plays. Updated by the worker from outbox events, not on the request path.

**external_videos.**
- `sources(tenant_id, source_id)`: provider `youtube|tiktok|facebook`, provider_channel_id, sync_mode `auto|manual`, authorization_ref, state. UNIQUE `(tenant_id, provider, provider_channel_id)`.
- `items(tenant_id, item_id)`: UNIQUE `(tenant_id, provider, provider_video_id)`. Columns include title, thumbnail_url, published_at, duration, embed_kind, embeddable, region_restrictions, review_state `pending|approved|hidden|unavailable` and last_verified_at.
- `sync_cursors(tenant_id, source_id)` and `ingestion_events(tenant_id, event_id)`, with the raw notification hash for dedupe.
- **No video bytes are ever stored.**

**rooms.**
- `rooms(tenant_id, room_id)`: slug, profession_title, owner_character_id, languages, plan_mode `free|paid`, state. A check enforces title ≠ owner display name. A trigger validates the owner is a Masana.
- `room_cohosts(tenant_id, room_id, character_id)`.
- `memberships(tenant_id, room_id, user_id)`: state `active|left|banned|muted_until`, joined_at. Index on `(tenant_id, user_id)`.
- `lessons(tenant_id, lesson_id)`: room_id, kind `lesson|announcement`, body, media, state, publish_at.
- `questions(tenant_id, question_id)`: room_id, user_id, body, dedupe_cluster_id, state `queued|answering|answered|needs_staff|rejected`, idempotency_key UNIQUE, queued_at. Index on `(tenant_id, state, queued_at)`.
- `answers(tenant_id, answer_id)`: question_id or cluster_id, character_id, bible_revision, body, state.
- `discussion_replies(tenant_id, reply_id)`: parent kind/id, user_id, body, moderation state.
- `plans(tenant_id, plan_id)`: room_id, period `month|year`.
- `price_versions(tenant_id, plan_id, version)`: amount_minor, currency, store_product_id, effective_at. Immutable.
- `entitlements(tenant_id, user_id, room_id)`: plan_id, price_version, state `active|grace|on_hold|past_due|expired|cancelled|refunded`, period_end, store_purchase_token_hash, last_verified_at.
- `store_notifications(tenant_id, notification_id)`: dedupe of Play RTDN messages.

**moderation.**
- `cases(tenant_id, case_id)`: reporter_user_id, target kind/id, category, state `open|investigating|action_proposed|awaiting_review|actioned|dismissed|appealed|closed`, sla_due_at.
- `evidence_refs`, `actions(tenant_id, action_id)` with kind, reversible boolean, proposed_by agent|staff, approved_by and an expires_at for temporary actions, `appeals(tenant_id, appeal_id)` and `policy_revisions`.

**Extended existing:**
- `memory.records` gains `scope='fan_relationship'` with `(character_id, subject_user_id)` and a consent state. The existing tombstones serve deletion.
- `identity.users` gains `display_name`, `avatar_media_id`, `birth_year_verified` and `role_flags`.
- `security` gains `staff_roles(tenant_id, user_id, role)`.
- `agents` gains `autonomy_levels(tenant_id, character_id, capability, level)`.
- `events.outbox` is used for **all** jobs.
- Chats reuse the existing agent session and message tables (`agents.character_sessions`, mobile shell). A check, applied by migration, makes one participant a fan user and the other a Masana `character_id`.
- `calls.sessions` (in `agents`): fan_user_id, character_id, livekit_room, state, started/ended, billed_seconds.

## 5. Authorization (server-enforced, tested)
Each item below must return **403 at the REST route, the WebSocket message handler and the job enqueue**. Hiding the UI is not sufficient, and each item needs a negative test:
- a fan creating or editing posts, lessons, Rooms, plans or prices
- a fan messaging or calling any non-Masana target, or any human
- clone, Twin, gift, seat, poll or owner-access endpoints, which now return `410 Gone` or `403` with code `feature_retired`
- a fan reading paid Room content without an `active|grace` entitlement
- a fan spoofing `user_id`, `character_id`, `paid=true` or a price version
- staff acting outside their role
- an agent acting outside its autonomy level or budget

Media goes out through short-lived signed URLs, checked against the post state and Room entitlement. All admin actions write `events.audit_events`.

## 6. AI runtime, memory and autonomy
- **Prompt assembly** (per turn): approved bible revision → claim and editorial boundaries → mission context (publishing only) → retrieved public continuity (top-k) → fan relationship memory for this `(character, fan)` pair only (top-k, consent-checked) → session window → user turn. Per-agent token caps apply.
- **Fan memory pipeline:** after a session idles, the worker extracts candidate facts and preferences with evidence message IDs. A sensitive-category filter drops health, religion, politics, sexuality, financial identifiers and exact location. Remaining items are stored with confidence and a TTL (default 180 days, refreshed on use). Fans can view, delete one or delete all per Masana, and disable memory. The admin "Fans & Memory" view shows **aggregates by default**. Opening an individual fan's memory requires the `fan_data_officer` role, a purpose and an audit entry.
- **Room teacher:** each new question goes through a classifier that checks policy, topic fit and dedupe against open clusters and an FAQ cache. Then comes retrieval over Room lessons, the skills curriculum and prior answers, an answer, and a safety check. The answer is published (L2 FAQ-class) or queued for staff (L1). The queue is fair across Rooms (round-robin by Room, FIFO within a Room) with per-Room budgets. There is **no per-member agent instance**. One student is answered within an SLO (p95 under 5 minutes at L2, under 24 hours at L1).
- **Publishing:** mission → outline → draft → media (image or audio generation, rights QA) → approval per level → `posts.state=scheduled` → a publish job keyed by `post_id` publishes **once** → counters and scorecard.
- **Model tiers:** a small, fast model for classification, dedupe and extraction; a mid model for chat and answers; Live voice only for calls. Model IDs are configured in `agents` and never hard-coded.

## 7. External Videos
- **YouTube (automatic):** staff enter a channel ID. The worker subscribes through WebSub (hub `pubsubhubbub.appspot.com`) with HMAC-verified callbacks and renews the lease. It reconciles daily through the channel's uploads playlist with `playlistItems.list` and `videos.list` (status.embeddable, contentDetails.regionRestriction). Quota budget is under 1,000 units a day per 50 channels. Playback uses the official IFrame player only, with no hidden controls or overlays. Docs: https://developers.google.com/youtube/v3/guides/push_notifications , https://developers.google.com/youtube/v3/docs/playlistItems/list
- **TikTok:** automatic sync works only for creators who OAuth-authorize our approved app with Display API `video.list` (https://developers.tiktok.com/docs/en/display-api-get-started). Otherwise staff paste individual public URLs, and the item is admitted if oEmbed or the embed player verifies it (https://developers.tiktok.com/docs/en/embed-player). Arbitrary accounts are never scraped.
- **Facebook:** automatic sync works only for Pages that grant our reviewed app the required Page permissions through Graph. Otherwise staff manually admit public videos, verified through the embedded video player (https://developers.facebook.com/docs/plugins/embedded-video-player/).
- **Lifecycle:** ingest → normalize → verify embeddable and region → `pending` → staff approve (or auto-approve for trusted `auto` sources at L2) → listed. A deleted, private or unembeddable item becomes `unavailable` and is hidden. Only one player is active at a time, and it pauses or disposes on scroll, background or call. Data saver shows thumbnails only. The player runs in a restricted WebView: provider domains allow-listed, no JS bridge and no arbitrary HTML from admin input.

## 8. Scale, performance and cost guardrails
- Feed: keyset pagination on `(publish_at, post_id)`. For You = followed posts in the last 7 days, plus top engagement-velocity discovery posts, interleaved 3:1. It is computed in SQL with a 60-second per-fan cache, with no ML ranking service. Counters are precomputed.
- Room fan-out: announcements use FCM topics per Room (`room_<id>`). Question answers notify only the asker and any followers of that thread.
- Quotas, defaults adjustable in Admin: 20 Room questions per fan per day, 200 chat turns per fan per day, 30 call minutes per fan per day, and a 5-second comment rate limit.
- Budgets: `generation_budget` per agent per week, plus a global monthly cap. The worker refuses jobs over budget and alerts. These are tracked in Operations: voice minutes, tokens, media egress, provider quota, queue age, sync lag, case backlog, entitlement mismatches.
- Load target before public launch: 10k daily active fans, 500 concurrent chat streams, 50 concurrent calls and 2k questions an hour on staging-sized infrastructure, with measured cost per DAU. There is no "unlimited" claim.

## 9. Subscriptions (Play-first per D1)
Staff create a plan, then a price version mapped to a Play subscription product or base plan. The client runs Play Billing and posts the purchase token. The server verifies it with `purchases.subscriptionsv2.get`, acknowledges, writes the entitlement and subscribes to RTDN (Pub/Sub push to `POST /v1/webhooks/play`), with dedupe. The state machine is ACTIVE / GRACE / ON_HOLD / PAUSED / EXPIRED / CANCELLED / REVOKED (refunded) and maps to `rooms.entitlements.state`. A price increase uses Play's price-change flow with notice and opt-in where required. Old price versions stay immutable. A redirect, a Gwani message or a client flag never grants access. Policy: https://support.google.com/googleplay/android-developer/answer/9858738 , lifecycle: https://developer.android.com/google/play/billing/lifecycle/subscriptions

## 10. Calls
The client requests `POST /v1/calls`. The server checks the target is a Masana with a qualified voice profile, then quota and budget. It creates a LiveKit room and a fan token, and dispatches the `services/presence` agent with metadata `{tenant, call_session_id, character_id}` only. The agent re-reads the session state each turn (the existing pattern) and uses Gemini Live with the character's voice. It stops on hang-up, budget exhaustion or a moderation flag. The old Talk Seat, Host and owner-direction gating is removed. Billing records only minutes, with no charge unless a plan says so.

## 11. API surface (v1, canonical, one implementation each)
- **Public / fan:**
  - Feed: `GET /v1/feed?mode=for_you|following&cursor`, `GET /v1/posts/:id`, `POST|DELETE /v1/posts/:id/reaction`, `GET|POST /v1/posts/:id/comments`, `POST|DELETE /v1/posts/:id/save`, `GET /v1/saved`
  - Videos: `GET /v1/videos?provider&cursor`
  - Masana: `GET /v1/masana?q&profession&language`, `GET /v1/masana/:id`, `POST|DELETE /v1/masana/:id/follow`
  - Chats: `GET /v1/chats`, `POST /v1/chats/:characterId/messages` (idempotency key), WS `chat.stream`
  - Calls: `POST /v1/calls`, `POST /v1/calls/:id/end`
  - Rooms: `GET /v1/rooms?tab=discover|joined&q&lang&plan`, `GET /v1/rooms/:id`, `POST /v1/rooms/:id/join|leave`, `GET /v1/rooms/:id/lessons|questions|discussion`, `POST /v1/rooms/:id/questions`, `POST /v1/rooms/:id/discussion`
  - Subscriptions: `GET /v1/subscriptions`, `POST /v1/rooms/:id/subscription/verify`
  - Gwani and cases: `POST /v1/gwani/messages`, `POST /v1/cases`, `GET /v1/cases/:id`, `POST /v1/cases/:id/appeal`
  - Search and account: `GET /v1/search?q`, `GET|PATCH /v1/me`, `GET|DELETE /v1/me/memory?characterId`, `GET /v1/notifications`
  - Wallet, Bills and Crypto keep the existing commerce routes, which are reconciled and not duplicated.
- **Webhooks:** `/v1/webhooks/play`, `/v1/webhooks/youtube` (WebSub GET challenge and POST), plus the existing payment provider webhooks.
- **Admin** (`/v1/admin/*`, role-checked): characters, revisions, media, missions, slots, posts, review, rooms, lessons, questions, plans, prices, entitlements, video-sources, video-items, cases, actions, appeals, fans-memory (aggregate or audited), finance (existing), ops (flags, kill switches, jobs, budgets).
- Existing routes that serve the same purpose are **adapted, not duplicated**. The lane owner maps old to new paths in its PR description and keeps forwarding aliases only until both apps have migrated.
