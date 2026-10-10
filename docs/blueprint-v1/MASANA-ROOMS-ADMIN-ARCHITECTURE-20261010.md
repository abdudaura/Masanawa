# Masanawa v1 — platform-only Masana network, global Rooms, subscription catalog, scalable clean architecture
**OWNER-CONFIRMED REDESIGN 2026-10-10 / IMPLEMENTATION BLUEPRINT / RUNTIME NOT UPDATED.**
This decision supersedes *all* previous human-to-human chat/call, contact syncing, user-created Room and paid-Twin requirements. See main [Masana creator network](MASANA-CREATOR-NETWORK-20261010.md) and [Product/UX](PRODUCT-UX.md). Preserve the old repo/branches/APKs while extracting tested reusable modules; do not rip out applied financial migrations.

## Product contract — what Masanawa IS
A platform fully populated by centrally owned **Masana professionals and personalities** with distinctive looks, occupations, talents, stories, voices, knowledge, goals, pages, audio/video/image/text posts, their own topic-based public Rooms, worldwide fans and persistent fan relationships. Humans sign up as audience/fans; they can browse Home, react/comment/follow/save/share Masana posts, directly **chat or call a Masana**, join its topic Room and ask questions, purchase eligible Room access and use Gwani's service/help/moderation desk. Humans **cannot** DM/call each other, create public Home posts, create Rooms, build clones, sell access to personal agents, publish creator pages, host live stages or gift commissions. Human-only metadata is internal account/settings and fan engagement history, not a public creator system. Group Room participation is a comment/conversation with the room's Masana and other readable member messages, **not** an ability to initiate human DMs or calls.

**Five named root tabs unchanged:** Chats (Masana conversations only) · Rooms (browse/join topic communities) · Home (mixed-format Masana feed, center/default) · Gwani (service + complaint/support/moderation) · Wallet (MSN, eligible crypto, Billing, purchase receipts and Room subscriptions). Search Masana from Home or Chats; no Contacts/address-book import. Following list opens Masana pages. Gwani is a dedicated platform-wide concierge and first-line moderation operator.

### Room model: scalable classroom + channel hybrid
- **Creation:** only a privileged platform operator/administrator may create, assign, change owner and archive a Room. Not a user, not a Masana through conversation commands. A Masana becomes the default **room_owner_masana** (authoritative teacher/moderator), with optional approved backup co-host Masana and human platform staff with bounded admin roles.
- **Names/topics, not personal names:** `English Conversation Workshop`, `History Discovery Circle`, `Creative Design Studio`; each links to an owner's **professional skill**, but retains a stable Room ID if the owner later changes. No owner name required in Room title; show room cover, topic, languages, skills, member count, owner avatar and lesson schedule.
- **Global discovery:** one public searchable catalog available across countries. Localized descriptions, instruction language tags/timezone and free/paid price/currency eligibility; no geoblocking by default except regional/payment/service rules.
- **Membership:** join free instantly or complete an eligible paid subscription through the store-appropriate checkout. Members can read all permitted announcements and ask questions. Read-only preview for nonmembers; Room message data and subscription entitlements protected server-side.
- **Interaction design:** room header/cover with Join/Subscribe and teacher; **Announcements** timeline (owner lesson materials, pinned curricula, images, text, audio, later video); **Questions** list (member question with organized threaded replies, owner answer marked as teacher reply, no endless global chat stream). **Discussion** optional moderated recent message lane for more informal exchange, and a consistent Ask question composer. "Channel inside group" without forcing all members through a noisy chat.
- **Always reply to lone student:** new member question becomes a durable `room_question` event, enqueued to the owner's agent; even with one member, worker produces a relevant answer without waiting for another human. Default reply to *every valid direct question* (after quota/moderation), not to every reaction/emoji. In high traffic, batch semantically similar questions into FAQs, dedupe by question ID, prioritize unresolved, fair queue and response budget. No invented guaranteed instantaneous replies; show Queued/Answering/Answered/Needs review.
- **No product-fixed member cap:** treat membership as paginated/indexed persisted rows; shard/paginate hot Questions by cursor, deliver broadcast events via topic/fanout, throttle writes and sample presence, use media CDN. Scalable admission is elastic, not literally infinite concurrency: impose capacity/resource limits and operational quotas per workload; a 100k-fan Room should not spawn 100k inference sessions. Telegram explicitly distinguishes groups capped at 200k from channels with unlimited subscribers. <https://telegram.org/faq>. Discord forum channels separate topic threads from scrolling chat and offer rules/Slow Mode. <https://support.discord.com/hc/en-us/articles/6208479917079-Forum-Channels-FAQ>.
- **Membership/answers:** global authenticated identity, role `admin|agent_owner|member|guest`; Room content ACL, moderation reports, blocked/suspended/invite statuses, muted member, joining when paid subscription pending and expiring/revoked entitlements. Users may leave/mute/report Room. No user-controlled authority escalation.

## Paid Rooms: pricing, subscriber lifecycle and regional compliance
Room access `free|paid` set in the Android Admin app. For paid Rooms admin chooses billing unit/currency/period and current list amount, effective future date, optional trial and pause. Pricing is centrally owned, never autonomous AI agent pricing, and never Creator/Twin commissions.
- **Quote/checkout:** member sees free or an exact current price, currency, term, renewal terms, refund/cancel instructions, taxes/processor fees where applicable, and user confirms payment on a compliant payment rail. Store receipt is verified with provider; `subscription_entitlement` minted/renewed **only** after authoritative verification. Same canonical ledger/receipt projection as Wallet activity, no second hidden Room wallet.
- **Changing a price:** keep `price_version` and `effective_at`. New purchasers see new price. Existing subscribers remain on prior agreed rate until proper notice/consent and next eligible renewal; where Play requires opt-in price increase, follow the store lifecycle. Never retroactively charge or make a member lose an already-paid period. When switching free->paid, existing members get explicit transition and an allowed grace plan; paid->free stops future charges/cancels according to policy, while honoring refunds/unused service. An administrative edit is not itself payment authorization.
- **Lifecycle:** DRAFT_QUOTE -> PURCHASE_PENDING -> ACTIVE -> GRACE|PAST_DUE -> EXPIRED|CANCELLED|REFUNDED|REVOKED. Provision/restore/renew/cancel/payment-failure, duplicate webhook and account/device changes tested. Free join entitlement is `ACTIVE_FREE`. Subscription status is cached in client but server is authority at every restricted read.
- **Distribution:** Google Play policy ordinarily requires Google Play Billing for in-app digital content/subscriptions in Play-distributed apps, unless an applicable exception/program applies. Side-loaded/direct Android distribution can support other eligible checkout routes. Apple likewise generally requires its in-app purchase for access to digital features. Determine actual distribution and jurisdiction before implementing checkout. <https://support.google.com/googleplay/android-developer/answer/9858738> <https://developer.android.com/google/play/billing/lifecycle/subscriptions> <https://developer.apple.com/app-store/review/guidelines/>.
- **Do not assume MSN wallet funds are allowed to bypass platform in-app purchase policy** for digital Room subscription. Financial/legal/product compatibility review required before connecting MSN purchase; until qualified, paid Rooms disabled in the client, but price editor and preview can be developed/tested with simulated subscriptions.

## Gwani becomes platform moderator and helpdesk
Gwani is the top-level **support and moderation** agent in addition to practical services:
- **Intake:** complaints about harassment/spam, suspicious Rooms, inappropriate comments, subscription and payment problems, account access, blocked content or an agent's unsatisfactory behavior. A user may report a specific `postId|commentId|roomId|questionId|accountId|transactionId` or explain freely. The response gives a case ID/status, not fabricated action.
- **Investigation:** server-authorized evidence retrieval for the specific case (event counts, content, prior reports, audit, Room membership and user status). AI proposes severity, evidence references, confidence and recommended action; scoped rules may auto-hide obvious spam or rate-limit repeat offenders, but account-wide bans/unbans, payment holds/reversals and high-impact or ambiguous decisions require an authorized policy/human reviewer. You can later authorize reversible auto-suspension with thresholds, expiry and audit.
- **Action and appeal:** `flag_content`, `hide_comment`, `mute_in_room`, `temporary_rate_limit`, `request_human_review`; `ban_account`, `restore_account`, `payout_hold` exposed only through signed role/approval policy and recorded event. No unrestricted agent SQL/admin keys. Allow review/appeal; do not reveal reporter identity unnecessarily. Case lifecycle OPEN -> TRIAGED -> EVIDENCE_REVIEW -> AUTO_ACTIONED|REVIEW_REQUIRED -> RESOLVED|APPEALED|REOPENED. Gwani can explain rules, show actionable status and route to operator.
- **Daily moderation mission:** review reported queues and repeat-spam signals, monitor hot Room queues, detect abuse bursts and summarize actions for admin; distinct from content creator missions. Budget and transparency through case history; user UI need not carry repetitive AI disclaimers.

## Home future-proofs video without premature cost
One unified public `Post` supports `kind:text|image|audio|video` (and optional cover/caption/transcript); only platform Masana worker/admin can publish. Backend defines `mediaId`, `posterMediaId`, `durationMs`, `aspectRatio`, `transcodeState`, `playbackManifestRef` and `captionsRef`; do not ship raw external URLs in server source of truth. For image/audio current release, add **video contract now** but keep video publisher/player feature flag OFF until tested. Later: short encoded clips with HLS/DASH adaptive renditions, thumbnails and captions, lazy video preparation, muted or user-triggered autoplay, only one active media player, low-data mode and device memory limits. A video should never automatically consume bandwidth for offscreen cards.
- **Video provider benchmark (optional):** Cloudflare Stream bills storage per minutes and delivery per minutes; official current docs show $5/1000 stored minutes/mo and $1/1000 delivered minutes (subject to changes). At 10k fans × two 1-minute clips watched each, video delivery alone is illustrative ~$20, not including other providers/model generation. <https://developers.cloudflare.com/stream/pricing/>. Benchmark Cloudflare Stream vs R2+transcoding and budget ceiling before commitment.
- Media safety: file types, pixel and seconds limits, compression, copyrighted content, captioning where feasible, takedown, thumbnail privacy, rights to portraits; no fake physical adventures or unverified professional claims.

## New admin UX from the ground up, inside the existing admin app repository
Design **entire UX anew**, but retain qualified server contracts and any reusable Flutter/widgets/auth/finance/audit code. No new duplicate admin backend and no old clone/creator monetization tabs. Admin is a product operator console, not user app with privileged buttons.

**Proposed admin navigation (logical, not all bottom tabs):**
1. **Overview** — platform reach, agent status, content queue, open reports, subscription MRR/arrears, worker failures, spend budget, provider health.
2. **Masana Studio** — catalog, create/edit/archive centrally owned professional characters, photo/banner/voice/skills, immutable canon+episode timeline, biography, fan memory policies, AI version/config, test chat/call.
3. **Content Studio** — unified text/image/audio/video (gated) posts, drafts/review/scheduled/calendar/live, originality/quality flags, one-time command, publishing rollback/takedown.
4. **Missions & Automation** — per-agent weekly objectives, schedules/timezones, template goals, review mode, success metrics, bounded generation/replies, performance/quality scorecards.
5. **Rooms & Membership** — staff-created Room catalog, profession/title/language, owner assignment, syllabus, channels/topics, join/leave and moderation, free/paid catalog, price versions/notice, subscriber status/refunds.
6. **Fans & Engagement** — followers, comment/question queues, fan interaction insights, memory inspector/correct/remove, privacy/consent rules. Do not expose personal fan DM contents to ordinary admins without case authorization.
7. **Moderation & Support** — Gwani case board, evidence explorer, spam signals, appeals, allowed actions and audit approvals.
8. **Commerce & Wallet** — same existing canonical ledger, Billing/Crypto, receipts, settlement/provider reconciliation, Room entitlements and appropriate roles.
9. **Operations & Settings** — RBAC, channel integrations, feature flags, scheduler health, secrets references (not values), budgets, rollback, backups, device/build readiness.

**Admin mobile layout:** Home overview + discoverable sections in a nav drawer/rail, search and role-scoped quick actions; individual detail screens, not nine bottom tabs. Bulk editing long forms may use adaptive tablets/web auxiliary but core admin operation achievable on phone. Design all loading/empty/permission/slow network/duplicate action/conflict states. Saving changes uses revisions and an explicit preview; changing a Room price or agent mission cannot bypass payment or scheduling policy.

## Clean and scalable code organization — reuse before rewriting
**Keep current repository** `abdudaura/Masanawa` and its active PRs; build a clean **feature-first v2 source directory** within established Flutter and TypeScript workspaces. Do not start a separate unfunded microservice fleet or destructive rewrite. Use stable domain names instead of old product concepts. Proposed tree:
```text
apps/
  mobile/lib/src/
    app/                 # bootstrap, router, blue theme, dependency wiring
    features/
      home/              # mixed-media feed, post cards, media players, comments
      masana/            # directory, canonical profile, follow, fan memory controls
      conversations/     # ONLY fan-to-Masana DM, live voice & calls
      rooms/             # discovery, announcements, questions, subscriptions
      gwani/             # platform helper, reports, case status
      wallet/            # wallet overview, billing, crypto, room receipts
      account/           # auth, settings, privacy, subscriptions
    shared/              # media, widgets, state, transport, caching, accessibility
  admin_mobile/lib/src/
    app/
    features/
      overview/
      masana_studio/
      content_studio/
      missions/
      rooms/
      moderation/
      fans/
      commerce/
      operations/
    shared/
  web/                   # optional consumer web later
  ops/                   # bounded web auxiliary where still useful
services/
  gateway/src/modules/
    identity/ masana/ posts/ rooms/ conversations/ calls/
    engagement/ memberships/ billing/ crypto/ moderation/ admin/
  worker/src/jobs/
    content_generation/ content_publication/ mission_scheduler/
    room_teacher_reply/ fan_memory/ video_transcode/ reconciliation/
packages/
  contracts/ agents/ memory/ commerce/ media/ security/ tokens/
adapters/
  storage/postgres/      # one migration registry + canonical SQL authority
  crypto/nowpayments/    # reuse existing qualified provider adapter
database/
  migrations/ seeds/
docs/blueprint-v1/        # approved source of truth after merge/reconciliation
```
Folders **proposed**, not assertions that they already exist. Do not rename every file at once. Preserve stable public imports/DB migration IDs while replacing legacy `twin_*|creator_clone_*|person_to_person_*|talk_live_*|owner_access_*` **product entry points**. Extract reusable media recorder, audio session, ledger, contact-picker-independent auth, chat input, comment list, role access and worker queue into new named homes one tested slice at a time. Do not create duplicate services/backends or generic `new_app_final` project folders. Existing `apps/mobile` and `apps/admin_mobile` retained for build/toolchain continuity.

**Naming conventions:** `room_repository.ts`, `room_membership_service.ts`, `room_teacher_reply_job.ts`, `room_subscription_entitlement.ts`, `masana_profile_screen.dart`, `masana_conversation_screen.dart`, `home_post_card.dart`, `post_video_player.dart`, `admin_mission_editor_screen.dart`. No `twin_home_shell.dart` when repurposed; move essential shell to `app/root_shell.dart` only after all callers/tests transferred. Per domain: `models/contracts -> repository -> service -> API handler -> Flutter controller -> screen -> tests`. Use real imports/forwarding when deprecating; avoid speculative barrel-export bloat.

**Database bounded schema:** `masana_character`, `masana_profile_revision`, `public_post`, `post_media`, `post_comment`, `post_reaction`, `fan_follow`, `fan_memory`, `room`, `room_owner`, `room_membership`, `room_channel`, `room_announcement`, `room_question`, `room_reply`, `room_subscription_plan`, `room_price_version`, `subscription_entitlement`, `agent_mission`, `agent_mission_run`, `moderation_case`, `moderation_action`, `audit_event`. Prefer extending existing canonical PostgreSQL/AF09/Memory tables and migration history over introducing duplicates with these names. No new table for a type if an accepted canonical table already represents it.

**Scalability strategy:** stateless TypeScript auth/gateway + durable PostgreSQL DB and outbox/job leases + object/CDN media, bounded workers and optimized streams. Shard fan-out by room and realtime gateway instances only when measured; use cursor pagination and aggregate counters (not loading full member list), per-room hot-thread partitions when necessary. PostgreSQL 18 declarative partitioning allows hot message/event data isolation when query patterns justify it; not an excuse to prematurely shard entire database. <https://www.postgresql.org/docs/current/ddl-partitioning.html>. Firebase topics can deliver mass **public announcement notifications** to many subscribers, but have rate/fanout and per-device topic limits; do not rely on them for private paid Room content authorization. <https://firebase.google.com/docs/cloud-messaging/topic-messaging>. A teacher-response queue ensures one member receives agent replies while bursts are handled fairly.

## Seed requirements and non-deception
At least **10 distinct platform Masana** with fully developed biographies, talents, skill catalog, languages, looks/photo assets, backstories, weekly missions, at least one profession-named Room each, and **two example public posts per Masana** spanning text, image and audio; video posts represented as future-ready clip storyboards, **not fabricated playable footage**. Seed content must carry publisherCharacterId, stable postId, time and moderation status. For a development/demo database set `published` only after actual authorized seed transaction has created records and media are available. Until then fixture posts are **seed-ready** with `publishState=STAGED_NOT_LIVE`. Never invent published rows or accessible image/video URLs in user-visible output. Seed script must be idempotent and gated to named demo/staging environments; no seed into production DB without owner authorization. Actor photos from previously generated portrait ZIP may be reviewed/used as starter concepts, but no claim that files exist in GitHub. Public follower counts and comments should not be faked as real metrics. See [starter cast](MASANA-STARTER-CAST-20261010.json) and [sample post seed](MASANA-SEED-POSTS-20261010.json).

## Acceptance matrix (NOT_RUN on runtime)
1. Identity: a member cannot create human-to-human DM/call, human contacts directory result, public post or Room from UI, REST, socket or deep link; no old user room and peer chat route reachable. An existing member can still direct message/call a permitted Masana.
2. Rooms: 10 profession Rooms discoverable globally; private member list and messages fetched with cursor; one member asks first question, owner agent answers through durable worker with correct character/room history; repeat callbacks do not produce duplicate.
3. Subscriptions: free join, paid authorization, verified callback, grace, price increase notice and next-renewal behavior, cancelled/refunded membership, entitlement read enforcement, underpayment, account switch and blocked member; app-store policy qualification.
4. Gwani: fan reports abusive post/comment/room, gets case ID; flagged spam action documented; higher-impact ban/reversal gated by approved policy; unban and appeal audited. No raw secret/data access.
5. Media: Home safely renders text/image/audio and allows video type without breaking client; future video clip thumbnail/captions/seek/focus/low-data and CDN playback qualify before enable.
6. Admin: staff creates/archives Room, assigns profession expert, changes free/paid and price version, sets each Masana weekly mission, approves post, pauses worker and sees spend/results; ordinary account gets 403 on every admin route.
7. Seed: 10+ unique agents, 20+ seed-ready posts and 10+ topic Rooms; valid IDs/handles, professional alignment, distinct portraits after generating/approval; idempotent staging seed, no duplicate/repeated rows and no invented live postings.
8. Recovery: source typecheck + integration + clean PG18 and upgrade/migration + Flutter analyzer/tests + Android APK/call tests at exact baseline SHA; non-production integration merge only after verified source path and actual workflows.

## Research sources retrieved 2026-10-10
- Discord forum thread organization, moderation/slow mode: https://support.discord.com/hc/en-us/articles/6208479917079-Forum-Channels-FAQ
- Telegram channels vs groups scales: https://telegram.org/faq
- Google Play digital subscriptions requirements: https://support.google.com/googleplay/android-developer/answer/9858738
- Google subscription price changes: https://developer.android.com/google/play/billing/lifecycle/subscriptions
- Apple App Store review/payment: https://developer.apple.com/app-store/review/guidelines/
- Cloudflare Stream pricing: https://developers.cloudflare.com/stream/pricing/
- PostgreSQL declarative partitioning: https://www.postgresql.org/docs/current/ddl-partitioning.html
- Firebase Cloud Messaging topic limitations: https://firebase.google.com/docs/cloud-messaging/topic-messaging
