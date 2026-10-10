# Masanawa — Home / Videos: managed external channel aggregation and official embedded playback
**OWNER-CONFIRMED FEATURE DIRECTION 2026-10-10 / PROPOSED FULL-STACK SPEC / NOT IMPLEMENTED OR TESTED.** This supersedes the earlier plan to *upload or generate video files as the immediate video source*. Preserve Masana-only publishing in **Feed**; Video items are **curated external provider references**, not uploaded media, not falsely attributed to platform personalities, and not new human-authored Masanawa public posts. The eventual separate Masana-original short-video capability remains optional and unimplemented, subject to another explicit decision.

## Screen structure and actual user behavior
**Root tabs remain:** Chats · Rooms · Home · Gwani · Wallet. **Home** gains TWO top-level inner tabs, **Feed | Videos**. Feed = text, image and audio posts from Masana only, with *For You / Following* subordinate chips, not another confusing peer navigation row. Videos = external, administrator-curated YouTube, TikTok, Facebook and additional permitted provider clips. No user uploads, channel submissions or independent publishing. Video list may use full-width 9:16/16:9 poster cards and **one active embedded player per viewport**, vertical swipe or natural scroll with explicit Play. Prefer thumbnail-and-title first, player initialized only on tap (or user-selected continuous play) to avoid many WebView objects, cellular traffic and battery drain. Preserve Home selected inner tab and poster scroll position; leaving a video suspends its player/audio. Native Masanawa UI (top bar, source chips, share/save/report, next video, loading/retry/unsupported state) surrounds **an official provider player**. Do not overlay or remove the provider's mandatory controls, branding or ads.

### Suggested Videos entry
1. Header: Home, Search, notification.
2. `Feed | Videos`; Videos landing with filter **All · YouTube · TikTok · Facebook**, optionally **Topics** and **Following sources** only after admin catalog has enough channels.
3. One video card shows provider/channel name, published age, real title, provider thumbnail, length (if available), category/tag and watch button. On Play, replace poster with supported embed (same card/route) or a focused player screen depending on provider capability. Swipe to next video while ensuring the old embed pauses/disposes and only one active player can auto-play.
4. Engagement: save/share/report via Masanawa records referencing an externalVideoId; any internal comments are distinctly *Masanawa comments about this video*, not sent to YouTube/TikTok/Facebook as if authorized. Do not confuse external provider view/like counts with our app metrics.
5. For deleted/private/nonembeddable/geo-restricted clips: show unavailable with **Open at source** where lawful, skip auto-advance, reconcile stale listing, no misleading player spinner.
6. Only admitted/healthy channels and passed moderation reach the feed. Never present external channel's clip as original video personally created by Gwani or another Masana without genuine ownership; include source name/logo required by provider policy. This attribution is not the repetitive AI-origin warning badges owner rejected.

### Illustrative Flutter screen hierarchy
```HomeScreen
  HomeTopTabs(Feed | Videos)
  FeedTab(ForYou | Following)
    MasanaPostsFeed
  VideosTab
    VideoSourceFilters
    ExternalVideoFeed (metadata, lazy posters, one active player)
       ExternalVideoCard -> ExternalVideoPlayerHost
         YouTubeOfficialEmbedAdapter | TikTokOfficialEmbedAdapter |
         FacebookOfficialEmbedAdapter | FallbackOpenOriginal
```
No native player using extracted MP4 URLs, intercepted video manifests or provider playback proxies. The player host is a controlled WebView/official supported SDK inside the native screen, with provider-specific source URLs from validated backend IDs. Avoid WebView Javascript bridges beyond explicit allowlisted messaging, reject navigation to arbitrary domains, handle renderer crashes and iframe playback failures. Provider-origin UI/ads remains. Turn off audio/video and dispose when offscreen, locked or call starts; honor low-data preferences, device back and fullscreen orientation. Use native Flutter `video_player` only for media we genuinely own/license and host.

## Provider feasibility and admission policy — never claim arbitrary channels all auto-sync
| Provider | Video discovery for admin channels | In-app player | Qualification and limitation |
|---|---|---|---|
| **YouTube** | Channel uploads via official WebSub/PubSubHubbub push notifications; periodically reconcile the channel's uploads playlist using `channels.list` + low-quota `playlistItems.list` (not high-cost search scraping). | Official YouTube IFrame player in Android WebView or supported wrapper, with YouTube controls/branding visible. | Most straightforward initial end-to-end integration. Honor embedDisabled, deleted/private/region restrictions, creator permissions, minimum player size and autoplay >50% visible/single player. |
| **TikTok** | `Display API /v2/video/list/` for **authorized creator account** only after TikTok Login Kit, `video.list` scope and app product review; poll permitted API subject to quotas; manual approved link addition for other public clips when individual embed permitted, but do **not** promise automatic monitoring of arbitrary accounts. | Official `tiktok.com/player/v1/{videoId}` iframe and supported controls/postMessage. | Cover URLs may expire; refresh metadata. Embeds may differ by region/browser/age and may stop working after creator removal. |
| **Facebook** | For Page feeds: only if Page ownership/authorized Page token/app review or approved public-content access actually permits this use. Verify against the **current Meta Graph API and app permissions**; if not qualified, admin-curated public individual video links with embed fallback. | Official Facebook embedded video/public post experience where embed is available in WebView; user may need source fallback. | Public post != API permission for continuous automated Page aggregation; do not scrape HTML, replay Facebook cookies or present private videos. |
| **Other providers** | Add a provider adapter only where documented embed + enumeration + rights policy are verified. | Provider iframe/SDK if allowed; otherwise supported external link. | Never accept admin-supplied arbitrary HTML/script or unvalidated raw links as executable WebView content. |

**Source evidence reviewed October 10, 2026:**
- YouTube push subscriptions: https://developers.google.com/youtube/v3/guides/push_notifications ; events on upload/title/description.
- YouTube uploads playlist endpoint & quota: https://developers.google.com/youtube/v3/docs/playlistItems/list ; 1 quota unit per list, subject to current quotas. Do not use expensive/limited `search.list` repeatedly: https://developers.google.com/youtube/v3/docs/search/list.
- YouTube embedded player and policy: https://developers.google.com/youtube/terms/required-minimum-functionality and https://developers.google.com/youtube/terms/developer-policies. May not cover/remove required branding/ads/controls, may not impersonate direct MP4 stream.
- TikTok creator authorization & API: https://developers.tiktok.com/docs/en/display-api-get-started and https://developers.tiktok.com/docs/en/display-api-overview ; approved `video.list` scope and account OAuth.
- TikTok official embed/player: https://developers.tiktok.com/docs/en/embed-player.
- Meta public embedded posts: https://about.fb.com/news/2013/07/introducing-embedded-posts/ ; public videos supported, but Meta developer API Page read permissions and live embed compatibility must be confirmed in registered app. Official Page/API documentation may change and may not be publicly accessible through our research environment.
**Truth:** provider support cannot be promised for every creator or geographic location. Plan no-upload official-embed aggregation with a capability matrix and graceful fallback instead.

## Backend and database update — REQUIRED end-to-end, not frontend-only
Keep existing TypeScript gateway/worker and PostgreSQL storage authority; extend the repo's accepted migration registry with safe additive, versioned changes. Suggested logical entities, reuse existing media/posts tables only if types/rights/owners line up; **do not conflate external videos with Masana-owned audio/image `PublicPost`.**

```ts
type Provider = "youtube" | "tiktok" | "facebook" | "other";
type ExternalSource = {
 sourceId:string; provider:Provider; providerChannelId:string;
 canonicalUrl:string; displayName:string; profileImageUrl?:string;
 ingestionMode:"websub"|"authorized_api_poll"|"manual_only";
 accountConnectionId?:string; approvalStatus:"pending"|"qualified"|"manual_only"|"blocked";
 enabled:boolean; categories:string[]; language?:string; marketAllowlist?:string[];
 discoveryIntervalMinutes?:number; lastCursor?:string; lastSyncAt?:string;
 lastSuccessfulSyncAt?:string; lastFailureReason?:string; lastProviderReviewAt?:string;
 adminOwnerId:string; createdAt:string; updatedAt:string;
};
type ExternalVideo = {
 externalVideoId:string; sourceId:string; provider:Provider;
 providerVideoId:string; canonicalSourceUrl:string; title:string;
 description?:string; thumbnailRef?:string; publishedAt?:string; durationMs?:number;
 providerEmbedAvailable:boolean; providerRestrictionReason?:string;
 state:"discovered"|"review"|"approved"|"published"|"hidden"|"unavailable";
 approvedBy?:string; indexedAt:string; lastCheckedAt:string;
};
```
**Recommended persistent tables** (names provisional, never invent a second accepted table): `external_video_source` (unique(provider,providerChannelId)), `external_video_item` (unique(provider,providerVideoId)), `external_video_sync_cursor`, `external_video_ingestion_event` (dedupe/provider notifications), `external_video_editorial_action`, `external_video_engagement`, `external_video_source_connection` (token references **only**, not raw tokens; secrets in encrypted store), `external_video_playability_check` (last verified). Foreign keys and composite indexes on active/source/publishedAt. Standard `audit_event` and worker-outbox tables reused.

**Authoritative flow:**
```text
Admin adds Channel/Creator URL
  -> normalize provider and extract stable provider channel ID
  -> verify API/official embed and discoverability/rights
  -> assign sync mode, category, filters, enabled/review policy
  -> save ExternalSource in Postgres
  -> scheduler/workers maintain WebSub subscriptions or API polling
  -> signed push/verified provider fetch; dedupe IDs and update metadata
  -> profanity/content check / optional editorial review
  -> approved ExternalVideo metadata rows become feed-visible
  -> GET /v1/home/videos?cursor=.. returns stable metadata/allowed player type
  -> Flutter renders thumbnail; user taps Play => official player adapter
  -> resume/notification/reconciliation preserves watch state + audit
```
YouTube WebSub renew leases and use callback challenge validation, event dedupe, source authorization checks and verification of fetched item against configured channel; webhook itself does not prove embed availability. TikTok polling needs OAuth refresh/revocation handling, rate-limit backoff and compliance review. Facebook source without eligible automated access remains manual; don't silently scrape it.

**Contract APIs (proposal; adjust to canonical conventions):**
- Public: `GET /v1/home/feed` (Masana posts only); `GET /v1/home/videos?cursor&provider&topic`; `GET /v1/home/videos/{id}`, `POST /v1/home/videos/{id}/save|report` (authenticated).
- Admin: `POST/GET/PATCH /v1/admin/video-sources`, `POST /v1/admin/video-sources/{id}/sync`, `POST /v1/admin/videos/{id}/approve|hide`, `GET /v1/admin/video-sync-jobs`, `GET /v1/admin/video-analytics`.
- Worker: provider callbacks (YouTube challenge/event), cursor poll jobs, video metadata reconciliation, delist/expired cover cleanup, circuit breaker and provider-budget accounting.
- Return `player.kind` and sanitized provider-native IDs/approved embed URL **derived on the server from provider-specific allowlists**, never arbitrary admin HTML, JavaScript or URL rehosting. Credentials hidden.

### Admin mobile: Video Channels module
Add **Content Studio > External Videos**, separate from **Masana Original Posts**. Screens/operations:
1. **Channel list**: provider chip, channel avatar/title, automation mode, enabled, last sync, last new videos, errors, pause.
2. **Add channel**: paste URL or connect owned account, resolve exact channel identity, permission/capability validation, choose topics/languages, moderation mode, notify; disabled auto-sync if provider scope unavailable.
3. **Channel detail**: newest imported items, manual Sync now, alert threshold, archive/unfollow, authorized credential reconnect, quota usage, sync history, rights and last metadata check.
4. **Video queue/review**: newly found, approved, hidden/reported, deleted/unavailable; batch actions with reason and audit, no public display until policy gate.
5. **Editorial feed**: pin/promote approved clips, per-source mix caps, language/geo filters, provider ad/brand intact, reporting and source takedown.
6. **Admin settings**: default refresh interval, maximum videos/source/day, pause all video imports, bulk resync quota cap, provider capability flags, alerting.
No channel is guaranteed automatic if TikTok/Facebook permissions are absent. Permission is an admin-facing status, not an unexplained empty feed.

### Cost and scaling approach
Metadata-only storage; **no actual video uploads, downloads, copies, cached MP4 or our own transcoding/CDN video delivery**. Source platform hosts and streams the clip inside its iframe. We pay mainly for discovery API calls, job compute, metadata rows, thumbnail caching subject to provider's policies, WebView bandwidth to load embeds, monitoring, and admin moderation. Actual viewers' streaming bandwidth is served by original providers but still consumes **their device data**, an important consideration in Nigeria. One player per viewport, explicit Play by default, thumbnail while scrolling, prefetched metadata but no multiple live iframes. Video source count × polling interval × API cost tracked; prefer YouTube WebSub pushes and playlist reconciliation. Provider ads/policy/geo gating affect UX.

## Acceptance and release gates (all NOT_RUN)
- EV-01 Home inner tabs show `Feed | Videos` and correct default Feed; switching preserves scroll/playback and audio focus. Feed contains platform Masana originals, Videos contains approved external source references. Old `Talks` deep links redirected.
- EV-02 user cannot create public feed posts, external video sources or video items from public API/Flutter/GraphQL/socket; only authorized admin can configure sources, and background worker inserts discovered metadata.
- EV-03 add a qualified YouTube channel ID in admin, receive a real test WebSub event or permitted upload + playlist reconciliation, **one** metadata record stored and retrievable through API, official iframe plays on Android with YouTube branding untouched; duplicate event no duplicate.
- EV-04 creator-authorized TikTok Display API feed imports after actual approval and permission; revoked OAuth pauses and explains status. Arbitrary non-authorized public TikTok handle cannot be falsely marked automatic.
- EV-05 Facebook authorized Page discovery is tested with real permitted Graph API/asset; if unavailable, manual-only public embed link qualifies without claim of auto-import.
- EV-06 blocked/nonembeddable/deleted/private/region-restricted items are excluded or marked unavailable with source fallback, no broken spinner or privacy leak.
- EV-07 invalid admin URL, fake embed script, iframe navigation to attacker domain, forged push, SSRF, bad HTML, malicious thumbnail and duplicate provider IDs rejected with typed errors; secrets never delivered to Flutter.
- EV-08 500+ video metadata cards cursor-paginate without many WebViews; one active player; pause/dispose on swipe, tab exit, app background, call, offline, data-saver toggle and account switch; run real low-end Android.
- EV-09 no fake "Masana published this video" for third-party creator; provider attribution is accurate; Masanawa saves/comments measured separately from native counts; copyright removal reflected.
- EV-10 worker disabled, API quota exhausted, channel missing, WebSub lease expiry, provider token revoked, webhook duplication and background restart all recover without lost cursor or spam/notifying wrong user.
- EV-11 full source CI: TypeScript typecheck/Vitest, PostgreSQL fresh+upgrade/idempotent migration, Flutter analyze/widget/integration, Android APK, provider live-permitted checks with redacted run log, safe integration SHA. **No checks have been run on this design document.**

## Implementation sequencing
**A** Resolve source and local APK preservation; approve this backend/interface contract. **B** Extract native Flutter Home shell/Feed navigation as shared state, build Videos metadata + poster UI and provider adapter host with a manual permitted YouTube embed; no fake TikTok/Facebook availability. **C** Implement PostgreSQL table/migrations, admin channel CRUD, metadata ingestion with stable IDs, YouTube WebSub + uploads playlist reconciliation, error/disabled state and tests, merged as one vertical slice. **D** Add authorized TikTok auto-polling if actual account permission + app approval; Facebook automation only if true Page rights and app permissions, otherwise public manual link module. **E** Real device/embedding, rights, source policies, region/data use, authorization, quota and failure tests; qualifying run evidence tied to exact commit. Avoid duplicate feature PRs; AF00 root router, AF09 Home/posts, AF15 durable jobs, AF14 admin, AF13 integration/tests. Financial/Rooms/moderation work unaffected and remains under its previous owners.

## Final status
**This is a blueprint addition only.** There is no new database migration, worker, server endpoint or Flutter Videos screen merged into main by this file. Approved scope is admin channel management and automatic import **where eligible**; per-source provider capability remains a verified integration gate.
