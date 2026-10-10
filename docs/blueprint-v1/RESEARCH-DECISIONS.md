# Research, product differentiation and decision register
Status: **RESEARCHED INITIAL PASS / OWNER REVIEW PENDING**, 2026-10-10.

## What established products teach us
| Reference | Verified pattern | Adopt | Avoid / differentiation |
|---|---|---|---|
| WhatsApp | Lock voice recording, preview, seek, resume/delete/send before publishing [1] | Familiar one-field composer; send when text exists, mic otherwise; draft safety | Extra avatar/pricing controls crowding the composer |
| Telegram | Voice trimming and channel DMs [2]; groups, voice sessions, bots with explicit permissions [3] | Media preview, simple role/permission controls, clear contextual agent names and actions | Building a Telegram-sized universal app or unsupported personal-account automation |
| Spotify creator ecosystem | Following and real audio play counts [4][5] | Shared audio focus for Masana audio in mixed media Home | Old user podcast studio and forced audio-only feed |
| Google Android guidance | Offline-first reading with local data source and queued critical writes [6] | Instant cached lists, account-fenced outbox, reliable receipts/status | Pretending queued money instructions are successfully paid |
| Existing Masanawa | Audio-first Talks + service Gwani + wallet/chat/rooms with reusable foundations [7] | Distinctive accessible spoken utility, service menus + typed/voice entry | Duplicated purchase/ledger engines, extra bottom tabs, fake automatic payment completion |

Absence of competitor features has **not** been verified: differentiation is a proposed product strategy, not a monopoly claim. Do not copy third-party copyrighted UI assets.

## Feature classification (scope removal confirmed, other details proposed)
**CORE SOURCE, qualified before exposing:** auth/recovery; **Masana-only directory and fan-to-Masana DM/calls**; no human contacts or human-to-human communication; recorded private voice notes; Home center/default with **Masana-only public text/image/audio posts**, member comments/reactions/follows/saves; full Masana profiles and search; platform-created worldwide expert Rooms with always-available teacher answer queue and free/paid entitlements; Gwani moderation/help/services; Wallet history/transfers/funding/conversion; native admin mission/calendar/editorial tools and fan-memory control; eligible Telegram/WhatsApp ingress; moderation and account/privacy deletion.

**DELIBERATE DIFFERENTIATION:** memorable platform Masana with realistic fictional histories, original photos, talents, voice and goals; mixed-media Home; followers who engage through reaction/comment and personal chat/call; bounded long-term fan memories; editable admin weekly missions/schedules/content pivots; voice-first Gwani with durable practical tasks.

**LATER / independently gated:** optional video calls and larger live Rooms, broader multilingual voices, costly sophisticated recommendation ranking and unsupported crypto networks.

**EXCLUDE:** all fan-authored public posts/creator pages, fan-created Rooms, human DM/call, human contacts sync, Twin/clone and commissions, paid stages/gifts, world simulator, duplicate feed/finance engine, unsupported payments and repetitive AI badges or trust lectures.

## Decision register — DEC-04 and DEC-05 confirmed removals; others remain provisional
| ID | Decision | Recommendation | Why not assume |
|---|---|---|---|
| DEC-01 | **Masana-only public creator network — CONFIRMED** | Masana professionals are the stars; members follow, comment/react, chat/call **Masana only**, join expert Rooms and can subscribe; Gwani moderates and Wallet handles eligible services | Supersedes member-published Talks |
| DEC-02 | **Rename Talks to Home — CONFIRMED** | Chats / Rooms / **Home** / Gwani / Wallet, Home center/default; Talks is audio content, not tab | Preserve legacy deep links in AF00 |
| DEC-03 | **AI-professional entertainment + global Rooms — CONFIRMED** | Mixed Home text/image/audio with future video; Masana-only chats/calls; 12+ professional agents, worldwide platform-created Free/Paid Rooms; Gwani moderation; redesigned Admin; Wallet and Gwani services | Paid room activation and video provider remain separately qualified |
| DEC-04 | **No personal Twins / clones — CONFIRMED REMOVE** | Eliminate personal-agent creation, profiles, directory, public links, owner-access sessions and onboarding | Product-scope decision is final; preserve any existing data/obligations during source retirement |
| DEC-05 | **No Twin economy — CONFIRMED REMOVE** | Remove Twin credit, pricing, referrals, attribution, commissions and earnings UI/APIs | Reconcile historical financial postings before deactivating old schemas and processors |
| DEC-06 | MSN asset | Internal exact-unit ledger with documented backing, mint/burn and rates | Financial and compliance consequences |
| DEC-07 | P2P | Approved merchants only; pause activation pending settlement/dispute/regulatory review | Screenshots are not bank proof |
| DEC-08 | Provider setup | Retain Flutterwave and NOWPayments adapters, qualify live account/region/network per function | Adapter existence ≠ account capability |
| DEC-09 | **Masana mission studio — CONFIRMED** | Android admin manages agent identity/canon/portrait/voice, post slots, weekly missions, focus pivots, draft approvals, budgets and fan insights | RBAC, safe retries and cost caps |
| DEC-10 | Channels | Official Telegram Bot API and approved WhatsApp business integration, permission-aware | Personal WhatsApp automation may be fragile or non-compliant |
| DEC-11 | Voice | Gemini Live for real-time Gwani where qualified; independent device voice-note path | Model/device/audio-focus and continuous cost constraints |
| DEC-12 | Deployment | Continue Railway gateway only after trigger review; retain fixed-IP DigitalOcean relay if Flutterwave needs it | Reversible and existing whitelist |
| DEC-13 | Database | Preserve PostgreSQL ledger/migrations; benchmark current provider vs Neon/DO, no forced migration | Restores, connections, residency and cost vary |
| DEC-14 | Languages | Hausa and English launch minimum; existing translations retained; expansion after tested localization | Voice/provider quality language-specific |
| DEC-15 | APK rollout | Existing Flutter signed Android baseline; staged controlled release, rollback and local APK reconciliation | Cannot overwrite unseen working fixes |

## Provider economics: dated inputs, not procurement authorization
- Railway published Hobby at **$5/month including $5 resource usage**, plus usage beyond that [8]. This is not a guaranteed all-in bill.
- DigitalOcean Basic 512MiB shared-CPU starts **$4/month**; suitability for a fixed-IP relay must be confirmed against actual resource load [9].
- Neon announced **1GB storage per free project** 2026-10-02; other quotas, compute and production recovery still matter [10].
- Flutterwave documents Nigeria bill-payment support, KYC, funded source balance and **server-IP whitelisting** [11]; Nigeria collections currently list local 2% fees, but bill margins/provider rates may differ [12].
- Google Gemini **3.8 Live** lists paid audio input about **$0.005/min** and output about **$0.018/min** in the documented pricing schedule, excluding other tokens/traffic/context effects [13]. Do not treat that as a fixed per-minute whole-session price.
- Regulatory and provider eligibility for MSN, P2P, wallet value, custody, crypto, payment collection and payout must be reviewed before external user activation.

## Evidence
[1] https://faq.whatsapp.com/1044960269529733/
[2] https://telegram.org/blog/direct-to-channel-trim-voice-and-more/
[3] https://telegram.org/blog/group-calls-made-easy
[4] https://creators.spotify.com/resources/news/the-new-home-of-podcasting-on-spotify
[5] https://newsroom.spotify.com/2026-06-11/spotify-for-creators-tools-plays-analytics-updates/
[6] https://developer.android.com/topic/architecture/data-layer/offline-first
[7] ../AUDIO-FIRST-PRODUCT-20261009.md
[8] https://docs.railway.com/pricing/plans
[9] https://www.digitalocean.com/pricing/droplets
[10] https://neon.com/blog/neon-free-plan-1-gb-per-project
[11] https://developer.flutterwave.com/docs/bill-payment
[12] https://flutterwave.com/ng/pricing
[13] https://ai.google.dev/gemini-api/docs/pricing

Research was retrieved 2026-10-10. Vendor schedules can change. Estimates require measured workload assumptions, independent account eligibility checks and total-cost review before provider moves.

## Presentation policy — owner confirmed
Use normal character names, photos, useful roles and navigation. No repeated 'AI agent' badges, warnings, synthetic-voice disclaimers or anti-AI trust commentary in normal interactions. Remove the blanket 'human versus AI' labeling requirement from screen designs. Backend character/account IDs and role authorization are ordinary data integrity concerns, not a reason for visual banners. If a jurisdiction or distribution platform explicitly requires provenance for a particular experience, handle that narrow requirement separately rather than applying generic labels everywhere.

## Owner pivot (2026-10-10) overrides earlier publishing and feed options
Only Masana publish public posts. Home includes text, images and audio with variable-height cards; optional immersive audio listening mode. Human members can comment, react, follow, DM and call, but **cannot publish**. No consumer media-post composer. Full canonical proposal: [Masana creator network](MASANA-CREATOR-NETWORK-20261010.md). Fictional starter roster: [profiles](MASANA-STARTER-CAST-20261010.json). Grounding: creator text/photo/audio and replies https://about.fb.com/news/2023/02/instagram-broadcast-channels-creators-deepen-connections-with-followers/ ; YouTube posts https://support.google.com/youtube/answer/7124474 ; durable memory https://langchain-ai.github.io/langgraph/concepts/durable_execution/ (checked 2026-10-10).

## Confirmed owner pivot: AI professionals only / 2026-10-10
A global character-led network: Masana create public posts and run profession-named Room communities; fans follow/react/comment, chat/call a Masana, join Rooms free or via qualified subscriptions. **Remove all human-to-human chats/calls and the human contact directory.** Gwani moderates with case investigations and gated block/unblock appeals. Admin UX is redesigned from scratch inside its existing Flutter app. Video clips are future-ready typed posts, but production video remains off pending qualification. Sample staging fixture has 12 agents, 12 professional rooms and 24 complete original posts. Authority: [Rooms, admin & architecture](MASANA-ROOMS-ADMIN-ARCHITECTURE-20261010.md). Evidence: Discord forum organization https://support.discord.com/hc/en-us/articles/6208479917079-Forum-Channels-FAQ ; Telegram channel scale https://telegram.org/faq ; Google Play billing requirements https://support.google.com/googleplay/android-developer/answer/9858738 ; Google price changes https://developer.android.com/google/play/billing/lifecycle/subscriptions ; Cloudflare video price https://developers.cloudflare.com/stream/pricing/ (checked 2026-10-10).

## Confirmed Videos addition / 2026-10-10
- **Home = Feed | Videos**, while bottom navigation remains Chats/Rooms/Home/Gwani/Wallet. Feed publishes platform Masana originals in text/images/audio; Videos indexes **external provider references** curated through admin channels and displayed in official embedded players, not uploaded/transcoded/rehosted files. Avoid confusing provider attribution with repeated AI-origin labels.
- YouTube push for new uploads and playlist reconciliation are official: https://developers.google.com/youtube/v3/guides/push_notifications and https://developers.google.com/youtube/v3/docs/playlistItems/list . Its iframe policy requires branding and controls: https://developers.google.com/youtube/terms/required-minimum-functionality .
- TikTok source automatic sync is permission-gated; Display API uses authorized creator `video.list`: https://developers.tiktok.com/docs/en/display-api-get-started ; official embeds https://developers.tiktok.com/docs/en/embed-player . Facebook public-video embeds exist but automatic Page monitoring cannot be guaranteed without appropriate Meta permissions: https://about.fb.com/news/2013/07/introducing-embedded-posts/ .
- **Do not promise all arbitrary third-party channel feeds** without authorization. The agent-generated original video-upload plan in earlier documents is superseded for current video launch. Details: [Home external videos](HOME-EXTERNAL-VIDEOS-20261010.md).
