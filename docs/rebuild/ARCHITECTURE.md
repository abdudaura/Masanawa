# Masanawa — Technical architecture and database rebuild contract
**Target architecture 2026-10-10, source still subject to measured verification.** Extend the existing monorepo, do not form a second platform or microservice fleet. Product authority: BLUEPRINT; screen bindings: SCREENS; implementation: DELIVERY.

## Topology
```text
Flutter consumer Android  ─┐
Flutter admin Android     ─┼─ HTTPS/WSS → existing authenticated TypeScript Gateway
Optional web/ops          ─┘                       │
                                        domain services + authorization
                                           │            │
                                   PostgreSQL      durable job outbox / workers
                                    ledger/events   content, missions, teaching,
                                    typed records   provider discovery, moderation,
                                           │         fan memory, reconciliation
                                     private media store (our original audio/images)
                                           │
                                  external qualified adapters
                             Gemini/live voice, Flutterwave, NOWPayments,
                             YouTube WebSub/API/iframe, TikTok OAuth+Display,
                             eligible Meta Page/embed, Google Play Billing
```
- Server holds all credentials, decides user role and exact identity, enforces per-object access, price/receipt status, idempotency and role boundaries. Models never receive direct DB administrative privileges, payment credentials, free-form shell or unbounded spending rights.
- No separate human chat/peer call backend, new clone-credit economy, second wallet, new scheduler for each persona, speculative second PostgreSQL authority or mandatory cloud microservices.
- Railway Gateway/Worker remains candidate dev/staging host; DigitalOcean fixed-IP relay retained only if required for approved Flutterwave whitelisting. Check actual live hooks before merging to main. Backups and restore first for any data-bearing deploy.

## Feature-first namespaces — target, not delete-all rename
```text
apps/mobile/lib/src/app/                       # bootstrap/router/theme/DI
apps/mobile/lib/src/features/{home,masana,chats,rooms,gwani,wallet,account}/
apps/mobile/lib/src/shared/{media,transport,widgets,cache,accessibility}/
apps/admin_mobile/lib/src/features/{overview,masana,content,missions,rooms,
                                     subscriptions,external_videos,moderation,
                                     fan_memory,commerce,operations}/
services/gateway/src/modules/{auth,masana,home,external_videos,chats,calls,
                               rooms,subscriptions,gwani,finance,admin}/
services/worker/src/jobs/{posting,missions,room_teacher,external_video_sync,
                           moderation,memory,finance_reconciliation,cleanup}/
packages/{contracts,agents,memory,commerce,security,tokens,media}/
adapters/storage/postgres/                    # one canonical SQL+schema authority
database/{migrations,seeds}/
```
Use `domain_contract.ts`, `domain_repository.ts`, `domain_service.ts`, `domain_routes.ts`, `domain_worker.ts` and corresponding test paths; Dart `*_screen.dart`, `*_controller.dart`, `*_repository.dart`, `*_model.dart`. No new `twin_home_shell` names or `new_new_final_app`. Extract tested shared code behind forwarding imports, remove old routes after consumers are migrated.

## PostgreSQL canonical domain model and migration safety
**Reuse existing accepted identity/agent/memory/audio-post/ledger tables where equivalent**; these names are conceptual until migration diff/inspection. Required normalized authorities:
- `accounts`, `sessions`, `roles`, `masana_character`, `character_revision`, `character_media`, `character_skills`, `masana_follow`.
- `masana_post` with `kind:text|image|audio`, media refs, approval/mission, version, schedule; `post_comment`, `post_reaction`, `saved_post`, `media_asset`, `post_outbox`. Do NOT use a user-selectable publisher role.
- `agent_fan_memory` scoped by both immutable `character_id` and `account_id`, with evidence/source/time, confidence, TTL, consent controls, tombstone; character canon and agent public continuity separately versioned.
- `masana_conversation` and `message` where one participant is exactly a fan and the other an authorized platform Masana; `agent_call_session` validated to Masana target. Fan-to-fan contracts/notifications/sockets denied at server.
- `room`, `room_owner_character`, `room_membership`, `room_announcement`, `room_question`, `room_teacher_reply`, `room_member_mute`, `room_subscription_plan`, `room_price_version`, `subscription_entitlement`, subscription webhook dedupe. Room is always created by admin, title profession/topic not agent name; owner assigned from Masana registry.
- `agent_mission`, `agent_posting_slot`, `mission_run`, `editorial_draft`, `generation_budget`, `audit_event`.
- `external_video_source` keyed by provider + stable channel ID; `external_video_item` keyed by provider + video ID; `external_video_sync_cursor`, `external_video_ingestion_event`, `video_moderation` and token-ref/authorization status; preserve source attribution and provider eligibility. **No stored video file or copied stream**.
- `moderation_case`, `moderation_evidence_ref`, `moderation_action`, `appeal` and policy revision; Gwani makes bounded proposals, authorized reviewer approves consequential actions.
- Existing financial ledger, balance reserve, exact integer amount, quote, idempotency, provider reconciliation, immutable receipts and webhook status; **no ledger migration based only on renamed UI**.

**Migration procedure:** inspect `pg_migrations` registry and deployed applied checksums; backup/restore PG and object store; create additive versioned migrations with guarded defaults; fill/validate rows in disposable PG18 fresh+populated upgrade; compare balances and unsettled jobs; dual-read where needed; reject new deprecated writes before removing routes; only after all clients upgraded and restoration proven retire orphan tables with audited forward-only migration. **Never delete applied migration files, legitimate ledger history, media or obligations.** Stop scripts targeting real financial data until explicitly authorized.

### Required security checks
Fan cannot create public post/Room, manage platform agent, configure source, send human DM/call, call human, credit Room entitlement or edit subscription price by spoofing actor ID. Server-side 403 on REST/WebSocket/job enqueue, not frontend hide. Admin is least privilege by role. Provider webhook events verified/reconciled against provider, persisted/deduped, no user-supplied `paid=true`. Media retrieval independently authorized. User data can be exported/deleted as permitted; financial audit retention separated.

## Admin and platform publishing workers
One persisted job journal with stable idempotency keys, lease+heartbeat, retry/backoff/dead-letter, max model tokens/minutes/media spend, cancellation, per-agent quotas and global kill switch.
- Character canon + weekly mission + user feedback/approved factual sources -> proposed outline -> text/audio/image asset (rights and QA) -> editor approval -> publish ONCE -> track actual engagement/mission progress.
- Private Room member question -> stable question ID and owner Masana/Room ACL -> queue -> retrieve syllabus/relevant public lesson and bounded question context -> answer with thread status -> dedupe and fallback/admin review. A Room with one student works. High volume uses fair queue/batch known FAQs and service budgets, not an agent instance per member.
- Fan DM -> durable local/server acceptance and independent agent response; character memory scoped to fan, active user memory controls; no fake prior relationship.
- Gwani case -> evidence permissions -> reversible policy action or review queue -> auditable status/appeal; never unauthorized ban/reversal.
- Scheduled provider imports -> ingest/normalize/verify item, thumbnail and permissions -> moderator-approve -> publish reference. Provider revoked/deleted/region-blocked -> mark unavailable and stop presenting playable embed.

## External Videos details and restrictions
- **YouTube:** admin channel ID; use official WebSub upload notification + channel uploads playlist reconciliation (playlistItems.list), signed/validated callback flow and lease renewal; official YouTube iframe; no player control hiding. https://developers.google.com/youtube/v3/guides/push_notifications and https://developers.google.com/youtube/v3/docs/playlistItems/list
- **TikTok:** automatic access only after creator OAuth and approved Display API `video.list`; otherwise individually curated publicly embeddable links, never automated arbitrary-account scraping. Official iframe `tiktok.com/player/v1/{id}` if available. https://developers.tiktok.com/docs/en/display-api-get-started and https://developers.tiktok.com/docs/en/embed-player
- **Facebook:** automatic Page sync requires approved Graph/Page scopes and owned/authorized source; other public eligible individual video links require manual admission and embed verification. https://developers.facebook.com/docs/plugins/embedded-video-player/ (verify current registered app capability).
- Video feed API returns safe source metadata, validated provider ID/player kind and pagination. Provider-authorized **embedded player** in restricted native WebView, source branding/controls/ads visible. No arbitrary admin HTML, MP4 extraction, asset downloading/proxying or attribution as original Masana content. Report/unavailable/open-in-provider fallback; one active player, pause/dispose on scroll/background/call, data saver.

## Paid subscription contract
Admin plan `free|paid` and `price_version` with amount/currency/period/effectiveAt. Quote -> Play Billing or other **actually permitted** payment route -> verified purchase token and provider webhook -> server entitlement ACTIVE/GRACE/PAST_DUE/EXPIRED/CANCELLED/REFUNDED. For price increases preserve existing contract and follow required notice/opt-in. A payment redirect or Gwani message is NOT proof of purchased access. Changing price not charge event. Google Play digital subscriptions policy: https://support.google.com/googleplay/android-developer/answer/9858738 and lifecycle: https://developer.android.com/google/play/billing/lifecycle/subscriptions .

## Performance / economics / reliability
Metadata/cursor pagination, bounded live buffers, normalized indexes, precomputed aggregate counts, media compression/thumbnails, fan-out by Room stream, FCM topics for public announcements where policy allows, notification dedupe and offline cached read surfaces. No product-fixed Room-member ceiling but infrastructure concurrency/quotas remain finite. Track actual voice tokens, media egress/storage, provider quotas, job spend, Room answer queue age, missing video sync, moderation case backlog and subscriptions. Avoid unsupported claims of $4 all-in or unlimited real-time inference. Operate cheap staging first, then load test before scale. Admin can pause external imports, posting, teacher jobs, paid joins or new purchases independently without losing reconciliation of already accepted work.

## APIs (versioned targets)
`GET /v1/home/feed`, `GET /v1/home/videos`, `GET /v1/masana`, `GET /v1/masana/:id`, `POST /v1/masana/:id/follow`, `POST /v1/masana/:id/chat`, `POST /v1/masana/:id/calls`, `GET /v1/rooms`, `POST /v1/rooms/:id/join`, `POST /v1/rooms/:id/questions`, `GET /v1/rooms/:id/lessons`, `GET /v1/rooms/:id/subscription`, `POST /v1/rooms/:id/subscribe`, `POST /v1/gwani/cases`, `GET /v1/gwani/cases/:id`, authenticated `/v1/admin/{characters,missions,posts,rooms,plans,subscriptions,video-sources,video-review,moderation,ops}`. These are **conceptual** until reconciled with canonical existing routes; no duplicate route implementations.
