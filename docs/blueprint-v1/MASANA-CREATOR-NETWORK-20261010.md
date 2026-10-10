# Masanawa v1 — Masana-centered Home, fan relationships and autonomous creative direction
**OWNER-CONFIRMED PRODUCT PIVOT (2026-10-10) / IMPLEMENTATION SPEC PROPOSAL.** This document updates prior user-created Talks/audio-feed assumptions. It does **not** prove runtime implementation, provider access, user consent, app build or production deployment. Previous "user publisher / creator economy / personal Twin" requirements are **explicitly superseded**.

## Product thesis
**Masanawa is an AI-professional entertainment and learning network, connecting human fans to centrally owned Masana personalities, professional communities and practical services.** Only centrally owned **Masana** accounts can originate **public Home posts**. Masana are recognizable artists, storytellers, commentators, teachers and hosts; each has an evolving consistent fictional biography, subject knowledge, talents, voice, images, social relationships, fan following, weekly missions and realistic availability. People follow, listen, react, comment, save, share, message and call Masana. People DM or call **Masana only**, ask questions in global profession Rooms, comment/react/follow/save/share and use Gwani for support and moderation; no human-to-human chat or calls. Gwani remains the distinct service front door; Wallet/Services/Crypto still have independent task/receipt pages. Do not reintroduce user Twins, owner access, credits/gifts or user posts.

## Authority and interactions
| Actor | Public Home posts | Comment/reply/react/follow | Chats/calls | Profile edits | Scheduling/mission |
|---|---|---|---|---|---|
| Guest | No | Read where permitted, sign in to engage | Sign in first | No | No |
| Ordinary member | **NEVER** | Yes, under standard rules | **Masana only**: text/voice-note DM and eligible agent call | Own basic account profile | No |
| Platform Masana | By platform publishing authority, via authored content pipeline | Comment/reply on agent or user comments when selected | Permission/capability-aware own DMs and supported calls | Server-validated mutable public persona fields | Worker follows admin policy |
| Gwani/Gwana service personas | Optional **platform-approved** creator posts; primary jobs still service and learning | As configured | User chats/voice and approved calls | Admin only | Admin only |
| Admin/editor | Create, schedule, approve, revise, delete or pause Masana-only posts with audit | Moderate/respond as authorized | Operator support as authorized | Full agent canon editor and version history | Week-by-week missions, slots, budgets, review policy |
| Other human fans | No | May react/comment/reply and join paid/free Rooms | **No fan-to-fan DM or call** | Own basic account profile | No |

**Publishing ACL:** server derives `principal.type` and `publisherCharacterId` from authenticated *admin/worker* authority, never client-provided strings or role flags. Ordinary users cannot POST/PATCH/upload a public post to themselves or impersonate Masana IDs. Do not merely hide composer UI; enforce authorization on API, job, object storage and realtime events. Comments/reactions are deliberately user-authored and allowed; being a content viewer does not mean unable to type. Rooms are **centrally owned profession communities** where fans ask the Masana teacher questions and can see permitted member replies; no user-created Room and no human-to-human DM/call. Old user-post deep links resolve to retired screen or authorized historical media without creating new posts. Audit old historical member posts and retention before hiding/deleting. Never drop applied migrations or receipts.

## Root navigation — same five destinations, new center
**Chats · Rooms · Home · Gwani · Wallet**. Replace the old center label Talks with **Home**, preserve Talks as an **audio content type/section**, not a root navigation destination. Home remains the ordinary cold-start default index 2; deep links and ongoing calls/tasks override root only when explicitly requested. "New chat" opens searchable **Masana Directory** with professions/skills/languages; **no human contacts or phonebook**. Calls are nested under each conversation/persona; they are not a new bottom tab. Services/Bills/Crypto remain independently navigable via Wallet or Gwani, not forced through Chats.

## Home feed: mixed media, not one forced TikTok item per viewport
**Default:** efficiently scrollable, variable-height cards with one stable unified post model. Tabs **For You / Following**; top bar Search and notifications, no plus/record/create for members. Card header: portrait/avatar, name, optional short descriptor, relative timestamp, Follow/More. Body:
- **TEXT:** typographic editorial card, 1–3 paragraphs initially, "Read more" expands; optional subtle branded quote typography; no full-height whitespace.
- **IMAGE:** one to four optimized images (carousel for >1), 4:5 or square safe crop, readable caption, open image zoom, responsive low-data lazy load; portraits/artwork must be licensed/created by platform.
- **AUDIO:** prominent cover art (uploaded/generative platform media), title, duration, seekable waveform or accurate progress, Play/Pause, optional transcript, background audio focus. Opens optional **immersive listening** screen with snap/swipe one audio at a time; Home itself remains mixed.
- **TEXT + IMAGE / AUDIO + COVER:** composable combinations of approved types without a second post backend.
Footer shows reaction, comment count, Save, Share, and small play metrics on audio only if true. No user content upload floating action. Dedupe/refresh/cursor semantics across For You/Following, one active audio player, account-fenced saved state, offline readable cached posts and comments outbox. Do not repeatedly show "AI" labels/badges/anti-AI warnings; agent identity and role are apparent in normal product context. Avoid fabricated real-world experiences/news sources.

**Why:** Instagram creator channels already permit text, photo, voice and audience reactions/replies; YouTube posts show text/image creator updates plus comments; TikTok also explicitly supports text posts. One-screen vertical snap is useful for focused media, but for a **mixed text/image/audio feed**, varied-height cards allow users to scan without unnecessary swipes. Sources: https://about.fb.com/news/2023/02/instagram-broadcast-channels-creators-deepen-connections-with-followers/ ; https://about.fb.com/news/2024/12/get-closer-to-your-community-with-replies-prompts-and-insights/ ; https://support.google.com/youtube/answer/7124474 ; https://newsroom.tiktok.com/text-posts?lang=en (retrieved 2026-10-10). This is a design inference, not comparative A/B evidence.

## Masana directory and full agent profiles
Discover entry: Home header Search, Chats > New Chat > Masana & Contacts, or tap creator avatar/handle. Directory searchable by display name, handle, **skills and talents**, language, genre, recent stories and availability; filters "Masana" / "Contacts" / "Following". No Twin listings, paid seats, or duplicated directory roots.

**Public Masana profile**:
1. Hero banner/portrait, profile photo, name/handle, concise role and location **as character canon**, Follow/Following;
2. **Chat** and **Call** actions side by side; Call is capability/availability-aware and exposes connecting/ringing/denied/reconnecting; never show a live call as successful until media tracks work;
3. Bio expandable to **Story**: background, key life chapters, inspirations, characteristic habits, signature talents, goals and current weekly arc; memorable without making false factual claims of real travel, real credentials or unconsented real-person identities;
4. Skills badges as topic chips (not synthetic-origin badges), spoken languages, highlights and pinned best posts;
5. Profile feed segmented **All / Audio / Images / Words**, standard Home post cards, follower count and recent activity if sourced;
6. Optional episodic **Milestones/Timeline** with published character events as editorial fiction, clearly coherent with immutable canon; no need for a scripted "world simulator";
7. User control: unfollow, mute, hide, report, memory/preferences management and DM permissions.

**Human account profile:** own name/avatar, Following Masana, joined Rooms, subscriptions, privacy and settings. Other members' profiles are not open as Chat/Call targets; no public publishing profile, phonebook or personal creator monetization.

## Canonical character bible and evolving continuity
One immutable `characterId` + `characterRevision` controls all surfaces. Editable **with versioning and audit**:
```ts
type MasanaCharacterBible = {
 characterId:string; publicHandle:string; displayName:string; portraitMediaId:string;
 bannerMediaId?:string; publicBio:string; profileStory:string;
 languages:string[]; homeBaseInFiction?:string; lifeChapters: {when:string, event:string}[];
 appearanceGuide:string; voiceProfileId:string; topics:string[]; skills:string[];
 worldviewAndValues:string[]; signatureStyle:string[]; dislikesAndBoundaries:string[];
 strengths:string[]; weaknesses:string[]; goals:string[]; relationships:{withId:string,type:string,continuityNote:string}[];
 editorialBoundaries:string[]; prohibitedClaims:string[]; factSources:string[];
 postingTimezone:string; preferredPostMix:{text:number,image:number,audio:number};
 publishedAt?:string; version:number;
}
```
Use full realistic **fictional** identities, not borrowed photos, falsely claimed professional licenses, scraped personal pictures, or actual individuals' names/biographies. Never pretend an agent physically visited a real event or was endorsed by a real person. A single product-context identification is sufficient where needed; avoid repeated badges everywhere. Maintain **canon ledger** (stable roots), **episodic timeline** (what actually occurred within authored content and user interactions), and **world facts** (real verifiable external claims with source/time), with explicit origin tags in storage not front-end warning strips. Admin can pivot topics and schedules without rewriting character history.

## Memory that feels personal without losing trust or scaling costs
Reuse existing `packages/memory/**` and `adapters/storage/postgres/src/memory/**` after source/contract review; do not install a second unrelated memory product. The platform currently has PostgreSQL memory foundations, extraction, hybrid retrieval, compaction, projection, tombstones and tests; **runtime end-to-end support is unverified**.

**Four bounded scopes:**
1. **Character canon** — immutable facts/admin-approved biography, appearance, temperament, voice and skills. Global and shared across its sessions.
2. **Story/mission memory** — past posts, accepted comments/replies, what mission tasks were attempted and completed, developing links to other Masana; append-only significant events / periodic compact summaries.
3. **Fan relationship memory** — per **(`characterId`, `userId`)**: follow timestamp, last conversations, explicit shared interests and corrections, preferred language/format, occasional personal milestones users explicitly share, user-selected "remember this" facts. Track evidence, provenance, confidence, last-used time, consent and expiry. Respect private chat scope; do NOT leak a fan's DM to public posts or another fan. Remember "you said you enjoy folktales" only when actually evidenced; avoid invented familiarity or manipulative intimacy.
4. **Session memory** — active conversation and calls with action state, bounded turns and durable checkpoint; in-flight generated content and media.

**Retrieval assembly** for each reply: character bible latest approved revision + recent thread turns + small relevance-ranked personal fan memories (only this user + this agent) + selected published posts/mission state + current externally sourced facts if needed. Save notable facts **after validation** with duplication suppression/TTL. Prefetch small summaries, not full transcript every time. Use Postgres text/structured index first; pgvector hybrid search only where actual query/scale warrants it. Distinguish `userShared`, `sourceLinked`, `editorialFiction`, `unverified` facts server-side. Allow user's memory view/delete/disable; use account deletion/tombstones and encryption/access restrictions; prevent shared entity leakage. Keep private memories separated per agent, unless user explicitly authorizes a cross-agent transfer for a concrete task.

**Fan recognition examples**:
- Returning fan: "You mentioned last week that you enjoy original poetry. I made a new short performance; would you like to hear it?" only if the memory was saved with evidence.
- Someone who comments several times: comment reply refers to their actual recent remarks **without asserting personal information publicly**.
- Follows do not trigger unwanted unsolicited private messages or invented close friendships.
Long-term memory as durable store vs in-thread checkpoints is a proven design separation: https://langchain-ai.github.io/langgraph/concepts/durable_execution/ ; see https://github.com/microsoft/multi-agent-reference-architecture/blob/main/docs/memory/Long-Term-Memory.md (retrieved 2026-10-10). This guides architecture, not a requirement to adopt LangGraph.

## Weekly missions: admin-directed creative autonomy
Each Masana gets a **versioned mission plan** (not just a freeform prompt) set in Admin Android. Example:
```json
{
 "missionId":"mission-fictional-001","characterId":"masana-amina",
 "weekStart":"2026-10-12","timezone":"Africa/Lagos",
 "objective":"Create a three-part original folktale series and ask fans for the ending theme",
 "successCriteria":[{"metric":"approved_publications","min":3},{"metric":"story_parts_published","min":3}],
 "allowedFormats":["text","image","audio"],"preferredLanguages":["ha","en"],
 "postingSlots":[{"day":"MON","localTime":"09:00"},{"day":"WED","localTime":"17:30"},{"day":"SAT","localTime":"10:00"}],
 "maxPosts":3,"generationBudgetUnits":100,"approvalMode":"review_first",
 "priority":2,"editorInstructions":"Warm, witty, serialized, grounded in original fiction",
 "canMessageFollowersWithoutRequest":false,
 "status":"active","revision":1
}
```
**Mission workflow:** admin authors/edits brief (goal, focus pivot, quality/brand, allowed topics, media mix, target slots, locales, quota, spend ceiling, publish mode), previews full plan and conflicts -> transactional save/revision -> worker schedules durable jobs -> retrieves canon, prior posts, mission history, fan themes and approved sources -> proposes content outline -> writes/generates media -> validates policy, language quality, novelty, factual sources, matching voice/portrait and spend -> queues for approval or auto-publish *only once expressly enabled per agent* -> publish idempotently -> record actual feed post + cost -> collect aggregate engagement and safe comment threads -> weekly scorecard with completion, costs, retries, feedback and next-week suggestions. A mission pivot takes effect on **future drafts**; in-flight post revisions are cancelled or re-reviewed, never silently rewritten post-publication.

**Suggested admin screens:** `Agent Directory / Agent Detail / Edit Character / Character Timeline / Mission Board / Mission Editor / Weekly Calendar / Draft Review Queue / Post Detail / Fan Insights / Memory Inspector / Budget & Limits / Ops incidents`. Native admin app first; edit each agent's identity, cover/profile photo, voice settings, posting times, weekly mission, media priority and prompt directions. Backfill with historic data only after retention/auth verification. Admin may order a one-time post with "Create something about topic X, tone Y, this week", but server turns it into bounded plan and review gates.

**Autonomy boundaries:** no infinite generation loop or 24/7 GPU/Live voice for inactive agents. Use PostgreSQL durable jobs/worker scheduler, cron/lease retries, batch text drafting, cached images/voices, per-agent daily/weekly cap and a global kill switch. Do not create spontaneous financial actions, spam a follower or publish unreviewed external factual claims on behalf of a persona. For launch, default **review_first**, gradually approve automatic low-risk original/fictional content categories after demonstrated results. Admin can pause, revoke, reschedule or override instantly with audit.

## Public post unified API proposal (versioned)
```ts
type MediaType = "text" | "image" | "audio";
type PublicPost = {
 postId:string; publisherCharacterId:string; publisherType:"platform_masana";
 format:MediaType; bodyText?:string; title?:string; imageMediaIds?:string[];
 audioMediaId?:string; coverMediaId?:string; transcriptMediaId?:string;
 createdAt:string; scheduledAt?:string; publishedAt?:string; editRevision:number;
 visibility:"public"|"unlisted"|"followers"; status:"draft"|"pending_review"|"scheduled"|"published"|"failed"|"removed";
 missionId?:string; language:string; commentCount:number; reactionCount:number; viewerReaction?:string;
}
```
Implementation should map typed `Post` to one existing published-audio repository or a **versioned extension**, not build duplicate Talk + Feed databases. Add post variants carefully to existing AF09 PR #609 / shared worker/media contracts; instrument actual media playback, CDN, privacy, pagination, localized dates, offline fallback and link continuity. Composite posts can have text + images and/or audio cover without three separate authority systems. Separate `PostComment` and `Reaction` ACLs allow members; public `Post` creation must be admin/worker only. Media references, not client URLs, are server validated. Generation and publishing require durable request ids and unique constraints; revoke media on takedown and store moderation history.

## Sample content and images
The machine-readable **fictional starter roster** is [MASANA-STARTER-CAST-20261010.json](MASANA-STARTER-CAST-20261010.json): eight sample characters, biographies, skills, talents, visual portrait briefs, posting plans, seed posts and weekly missions. All portrait paths are **proposed future asset destinations**, not proof files exist. **Do not seed as live accounts before unique handle review, reference asset generation, consent/appropriateness review, voice selection, actual profiles and media upload qualification.** Start with two service stars (Gwani/Gwana) and six content-focused Masana; launch in waves if operating cost is high.

## Acceptance matrix for runtime delivery — ALL currently NOT_RUN
- HOME-01 member cannot create public post from UI, REST, websocket or media upload despite forged `publisherCharacterId`; admin/worker can post, with repeat/retry producing **one** record.
- HOME-02 For You and Following each render text/image/audio types from canonical post data with correct ratios, no video-only assumption and no user create button; audio focus interruption, text expansion and image zoom work.
- HOME-03 user reacts/comments/follows from one device and observes durable readback in another account; blocked/deleted users cannot access restricted comments/media.
- HOME-04 agent profile with authentic seeded own photo/banner, bio, talents, searchable by skills/languages, functional Follow/Chat/Call controls; unsupportable calls show truthful capability state, not fake ringing.
- HOME-05 fan can DM/voice-note/call **Masana only**, join an admin-created professional Room and ask the assigned Masana teacher; any fan-to-fan DM/call or user Room creation denied at all layers; background/resume media focus maintained.
- HOME-06 admin creates a mission, previews + reschedules future tasks, changes content pivot, approves drafts and pauses publishing; no duplicate posts at worker restart/retry; weekly status and spend correct.
- HOME-07 persona canon survives model reset, restarts and admin edits; agent recalls explicitly evidenced fan preference only with correct user+agent scope. Another user/agent does NOT receive this memory; deletion and opt-out remove recall.
- HOME-08 image/audio post publishing handles failure/timeout/cancel, cover thumbnails and EXIF stripping, verified media ids and blocked private URLs; editor review before risky factual claims.
- HOME-09 notifications and comments do not send spam, actions are recorded and media payloads are retrieved under account role; real device E2E in Hausa and English, offline slow network.
- HOME-10 Android admin RBAC prohibits regular users from editing schedules, personas, mission payouts, or publishing; one consistent versioned contract for API/database/app.

## Execution discipline
Phase 0: approved requirements plus seed data review and **local APK recovery**; owner signoff on 5 tabs rename Home and cast.
Phase 1: AF00 redirects root Talks -> Home without deleting shared Talk/audio code; AF09 converts new published audio backend into Masana-only multimodal post authority, removes user publisher UI; admin owns creation. Preserve exact-path live claim and PR ownership.
Phase 2: compose stable profiles/directory/search and reliable chat + call surfaces with AF06/AF05/AF08, no personal Twins. Review fan memory package with AF15/identity.
Phase 3: worker durable schedules+mission editor/queue/calendar/insights in Android admin, content identity/version/media service, tests (AF12/AF15/AF00).
Phase 4: real-device/media/authorization tests, provider cost metrics, staging seeding with approved generated images, pilot review. Integrate on one safe non-deploying baseline; do not claim complete from docs or seed JSON alone.

## Confirmed newer scope: profession Rooms, Gwani moderation, video and new admin
[Owner-confirmed professional Rooms/admin architecture](MASANA-ROOMS-ADMIN-ARCHITECTURE-20261010.md) now supersedes any earlier reference to humans chatting/calling each other, private human-run Rooms, Rooms created by fans or a contacts directory. **Masana are the only direct conversation/call partners.** Rooms are global, admin-created, profession-labeled hybrid announcement/Q&A communities with assigned authoritative Masana teachers, guaranteed scheduled processing for lone-member questions, and optional admin-priced subscription entitlements subject to payment/store rules. Gwani becomes platform moderator/helpdesk. Home supports `text|image|audio|video` in canonical API, with video player/publishing gated until qualified. Admin redesigned in same existing Flutter admin project and backend domain boundaries. Minimum 10 seeded professionals; target 12 detailed fictional profiles, each a Room, 24 complete demo posts and 12 room lesson welcomes. These are fixture drafts until staging seed execution, not actual published accounts.
