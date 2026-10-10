# Masanawa v1 — Product, roles, navigation, all primary screens and journeys
Status: **PROPOSED DESIGN v0.1**, not approved, 2026-10-10. Existing [owner-confirmed UX](../AUDIO-FIRST-SCREEN-SPECS.md) prevails when different. Detailed API and pixel design are subject to review.

## One-sentence proposition
A world-spanning AI-professional entertainment and learning network where platform Masana publish text, pictures and audio (video-ready), manage specialist Rooms, and cultivate human followers. Fans interact via reactions, comments, room questions, direct **fan-to-Masana** chat and agent voice calls; Gwani moderates and offers support/services. There are **no human-to-human chats or calls**.

## Primary actors and permissions
- **Guest:** splash, welcome, choose language, registration, clear denied-gate for protected links.
- **Fan/member:** Chats/Rooms/Home/Gwani/Wallet; follow, comment, react, bookmark, share, direct Masana chat/call, join worldwide platform-run Rooms, ask teaching questions, subscribe to paid Rooms and use eligible financial services. **No human DM/call, no public post, no Room creation, no agent creation.**
- **Public content creator:** centrally administered platform Masana only, including Gwani/Gwana when configured. No human creator role, member post composition, media publication, earnings or personal-agent setup.
- **Masanawa agent (Masana):** platform-operated character with detailed fictional identity, consistent talents, story/history, full profile, text/image/audio posts, fan comments and follower memory, DMs and eligible calls. Weekly content missions and schedules controlled by Admin. Gwani/Gwana remain platform service agents.
- **Room authority:** an assigned profession-matched Masana is the default Room teacher and moderator; staff may administer and change pricing or assign assistants; humans are fan members/learners who can question/reply/react but cannot create, own or rename a Room.
- **Approved P2P merchant:** eligible offer management and payment confirmation; no implicit escrow release privilege outside agreed policy.
- **Gwani platform moderator:** first-line intake/investigation for spam, abuse, blocked accounts, Room subscription issues and appeals; limited automatically reversible rules, signed admin review for serious ban/unban/financial consequences.
- **Finance/risk operator:** segregated approval, reconciliation, dispute decisions and auditable evidence.
- **Platform administrator:** native admin app with granular settings, providers, channels, roles, flags and incident handling.

## Primary mobile shell, exactly five stable semantic destinations
Bottom tabs: `chats` · `rooms` · `home` · `gwani` · `wallet`. Home is central and default for an ordinary authenticated cold launch; deep links/incoming calls restore requested destination after auth; resume preserves the active tab/task. Each tab retains its own stack, scroll position and relevant draft, without any human-contact or human-call route. Back dismisses overlays -> details -> previous tab state; no repeated duplicate routes. Legacy aliases require a versioned redirect map and account-authorized ID lookup.

### Visual system (proposed)
Compact, one-handed, WhatsApp-familiar composition. Masanawa blue brand accent at reduced saturation, neutral background, 44–48dp-equivalent interactive touch areas, restrained elevation, readable contrast, dark mode, no flashy launch frames. Show only names, avatars and useful roles; omit repeated AI badges, synthetic-content labels and cautionary copy from normal interactions. Top bar: product/identity context, context search/options; bottom: five stable tab icons/labels. One major action per screen. Never bury receipt status behind a transient toast. Handle small low-memory Android phones and large dynamic type, Talk waveform contrast, offline banners and reduced motion. English and Hausa need complete copy and realistic long-word layout before expansion.

## Detailed screen register: each line is an implementable screen or sheet
`SC` IDs are **proposal IDs**; do not silently replace `UI-01..` or `UX-A..` until review. Unless noted, every screen must implement account-fenced loading/empty/error/offline/retry/permission/blocked/rate-limit states from the common matrix below.

### Entry, identity, account (SC-001–SC-008)
| ID | Screen / entry -> exit | Visible layout and exact actions | Server and failure contracts |
|---|---|---|---|
| SC-001 | Native splash -> auth or deep link/home | approved logo on neutral background, no exposed technical credentials | async session restore; network outage keeps recoverable auth/local state |
| SC-002 | Welcome / auth selector -> SC-003 | Sign in, Sign up, email/phone switch, accessible centered language button | auth capability list from server; no assumed phone verification |
| SC-003 | Sign in / register -> SC-005 or home | email/phone, numeric-secret input for phone choice, show/hide, validation, Submit, Switch method, Recovery | masked auth errors; bounded rate limits, no phone-ownership inference |
| SC-004 | Recovery / verify -> SC-003 | list eligible verified methods, recovery input, resend cooldown, device/session revocation confirmation | cannot recover using unverified phone number only; expired/invalid evidence states |
| SC-005 | Name/profile setup -> Home | display name, optional avatar, language, interests, Save/Skip; **no contacts permission prompt** | fan account and eligible Room/follow preferences, retry and validation |
| SC-006 | My profile -> SC-007 / SC-045 | avatar, name, language, Following Masana, Saved Posts, Settings, Activity; **no My Talks or Publish** | own profile projections only; no public wallet details |
| SC-007 | Edit profile/avatar -> SC-006 | edit name/bio/avatar, crop, delete image, Save/Cancel | permission, upload size/type validation, late upload cancellation |
| SC-008 | Account/security -> SC-004, SC-045 | sessions, verified identities, change credentials, revoke devices, blocked content/Room preferences | reauth, stale session and revoke; no phone address-book sync |

### Chats and Gwani (SC-009–SC-020)
| ID | Screen | Layout / actions | Binding, safety and states |
|---|---|---|---|
| SC-009 | Masana Chats tab | **only Masana conversations**, agent avatar/name/unread/search, Start Conversation, Masana call history, favorite characters | reject cross-human DM/call server-side; cached agent conversations and fan-scoped unread |
| SC-010 | Masana Directory | search **Masana professionals only** by name, profession, talent, language, topic and following; avatar, profile, Chat, Call | agent-only directory, no private phone contacts, no human profile discovery |
| SC-011 | Fan-to-Masana Conversation | agent name/avatar, Call, typed/voice/media messages, quick choices, replied-to context and single simple composer | human fan -> platform agent **only**, stable local outbox and agent run status; no human recipient IDs |
| SC-012 | Record voice note overlay | hold mic / slide cancel / slide lock, elapsed, pause/resume, preview/seek/delete/send | local capture must work without Gemini Live; permission vs encode vs upload errors, resumable draft |
| SC-013 | File/document attachment | picker, preview, file size/type, caption, send/cancel, download | private object ACL, expiry, failed upload retry, virus/size checks |
| SC-014 | Masana message options | reply, copy, save, delete own, report, task/receipt detail if applicable | verified fan+agent conversation, correct sender scope and audit; no forward-to-human DM |
| SC-015 | Masana call initiation/history | Masana-only call history, agent profile call button, mic permissions, available/in-call/reconnecting/end | server rejects caller->human target, agent media capability and budget confirmed before connect |
| SC-016 | Masana call ongoing | connecting, active, reconnecting, failed, ended; mute, audio route, end, bounded credit/time where applicable | agent voice service, no human peer calls, explicit user mic consent and no fake connection state |
| SC-017 | Gwani: Support & Services | Report Spam, Complaint, Appeal, Account Help, Room Subscription Help; practical services Airtime/Data/Electricity/TV, text/voice/file; case and order history | Gwani moderation case authority with audit/escalation, separate financial authorizations and receipts |
| SC-018 | Guided purchase draft | selected service, progressive option selectors, editable values, Back/Change/Cancel | same task ID across menu/text/voice; selections validated against real catalog; edits revoke quote |
| SC-019 | Purchase review | recipient, actual product/quantity, MSN source, fees, expiry, Authorize/Cancel/Change | explicit consent tied to exact quote; insufficient funds/restricted provider/expired state |
| SC-020 | Purchase status and receipt | pending/processing/uncertain/succeeded/failed, status refresh, help, downloadable receipt | provider-authoritative receipt and idempotent retry; no success from model narration |

### Masana Home content and discovery (SC-021–SC-027)
| ID | Screen | Layout / actions | Binding and failure modes |
|---|---|---|---|
| SC-021 | **Home default** | For You / Following variable-height Masana text/image/audio cards plus future video clips, avatar/name/Follow, react/comment/save/share; no user Publish | server-authored only, typed VIDEO schema, video player gated until qualified, cursor/caching/media-focus/data limits |
| SC-022 | Home comments/replies | paginated thread, react/reply, send human comment, edit/delete own comment, report | member comment ACL only, never public post creation; optimistic rollback, fan-scope privacy |
| SC-023 | **Admin Masana Post Studio** | choose agent + text/image/audio post, draft/preview/cover/approve/schedule/publish, media upload/error recovery | admin/editor only, asset ownership, agent canon and editorial quality checks, worker-side publisher authority |
| SC-024 | **Admin editorial queue** | drafts, ready for review, scheduled, processing, published/failed, approve/revise/pause, owner and run audit | admin/editor only, mission revision pinning, idempotent publication, durable media and receipts |
| SC-025 | **Masana full profile** | portrait/banner, name/role, Story, profession/talents, agent's Room, posts All/Video/Audio/Images/Words, Follow, **Chat**, **Call**, report/mute | professional Room link, agent call only, versioned profile/canon and fan follows; no public human creator page |
| SC-026 | Saved posts | text/image/audio and future video saved from Home, filters, player position and unsave | account-fenced cache, public media ACL and blocked/deleted post handling |
| SC-027 | Search / Explore | search Masana professionals, skills, genres, countries/languages, public Rooms and media posts; open profile/chat/call/join | platform-only directory, no human profiles/contacts, typed result IDs and pagination |

### Profession-led global Rooms (SC-028–SC-032)
| ID | Screen | Layout / actions | Binding and failure modes |
|---|---|---|---|
| SC-028 | Global Rooms directory | Explore / Joined tabs, searchable professional topics, language and Free/Paid filters, topic cover, owner Masana, number of members and Join | **no New Room** for fans, globally available ACL, cursor pagination and subscribed Room states |
| SC-029 | Professional Room | owner avatar, profession-based title, pinned lesson and **Announcements / Questions / Discussion** sections, Ask prompt, answer thread, Join/Leave/Mute/Report | single-member question queues default Masana teacher reply, correct entitlement, question statuses, cursor history, server-side Room roles |
| SC-030 | Admin Room Create/Edit | topic/profession name, description, cover, owner Masana, language/timezone, audience accessibility, access Free/Paid, new Room preview | platform-admin only, stable room ID, manager revision, no user creation endpoint |
| SC-031 | Room membership & moderation | Join/Leave, members paginated, member mute/report, owner announcements and organized Q/A; staff moderates, assigns new owner | professional Masana room authority, no ordinary member invite/owner promotion; entitlement revocation and moderation audit |
| SC-032 | Room lesson thread / Ask Masana | question composer, suggested lessons, owner reply, follow-up thread and attachment policy, unanswered queue status | one member triggers AI teaching answer by worker, dedupe/rate limits, memory retrieval, owner knows Room syllabus; future live sessions separately gated |

### Wallet and P2P (SC-033–SC-044)
| ID | Screen | Layout / actions | Binding and failure modes |
|---|---|---|---|
| SC-033 | Wallet tab | MSN available/pending/reserved, hide balance, funding/Send/Convert/P2P, crypto holdings, recent activity | exact atomic units; server revision/as-of; stale quotes never payable |
| SC-034 | Funding method | eligible fiat methods or crypto network, amount, fees and limits, Continue | real providers and eligibility only; disabled choices explained |
| SC-035 | Funding instructions/status | provider checkout or deposit address/memo/chain, copy, pending/confirming/credited | authenticated webhooks + polling; reorg, underpayment, chargeback and pending obligation |
| SC-036 | Conversion | source/target/amount, quote preview, expiry, review/authorize | atomic unit arithmetic and liquidity; no unsupported pairs |
| SC-037 | Wallet transfer (only if financial policy retains it) | choose verified financial recipient, amount and review/authorize, receipt in Wallet | independent financial service, **not** an invitation to human chat or call; idempotent and scope-checked |
| SC-038 | External crypto withdrawal | network, verified destination/memo, amount/fee, step-up, review/status | supported pairs and limits; provider uncertain outcomes reconciled |
| SC-039 | Activity/receipt detail | filters/search, status, ID, time, fee, provider/ledger reference, support | immutable server receipt; cannot leak private history through public profile |
| SC-040 | P2P offers | eligible buy/sell MSN offers, terms, payment methods, amount, open | only approved merchant counterparties; remove trading when unqualified |
| SC-041 | P2P create/review order | rate/amount/payment deadline, Reserve, Cancel before claim | atomic reserve; no unlocked order state after failed reserve |
| SC-042 | P2P active order | bound bank instructions, mark paid, merchant confirm, countdown, dispute | receipt claim ≠ settlement proof; race handling with expiry |
| SC-043 | P2P dispute | upload evidence, reason, status/timeline, respond, appeal/support | authorized operator review; never screenshot-only automatic release |
| SC-044 | P2P merchant | verified status, offer create/edit/pause, settlement history, support | eligibility, suspend new orders without abandoning obligations |

### Supporting, admin and media detail (SC-045–SC-059)
| ID | Screen | Layout / actions | Binding and failure modes |
|---|---|---|---|
| SC-045 | Settings | language, profile, audio, notifications, privacy, support, About, sign out | never reveal provider credentials, obsolete app claims or unverified security promises |
| SC-046 | Permissions/privacy | microphone, notification, saved memories and subscriptions; stop/mute Masana and Rooms; delete/export privacy settings | no contacts import, agent-specific memory control and server account fencing |
| SC-047 | Gwani help, reports and account lifecycle | new complaint, select Room/Post/Comment/Account incident, evidence and case status; appeal, export/delete | case ID and supported actions only, no invented block/unblock or unreviewed financial resolution |
| SC-048 | **New Android Admin overview** | Masana online/status, content and mission queue, Room subscribers/free-paid split, unresolved cases, revenue, failures and budgets, priority actions | role-scoped dashboard with staging/production indication and actual status, no old Twins or user-creator admin tabs |
| SC-049 | Admin Masana & membership directory | platform professional agents/skills/voices/persona revisions; fans/follows, Room ownership and subscriptions, channel connectors | admin/editor-only role ACL, no member creator economy or phone-contacts management |
| SC-050 | Admin finance | ledger reconciliation, provider events, P2P disputes, holds, refunds and authorization | dual control where needed, no freeform SQL/mint button |
| SC-051 | Admin Content, Rooms & Missions | mixed-media media studio and video readiness, agent weekly mission calendar, profession Rooms, free/paid prices, editorial queue, comments and case moderation | per-action server authorization, scoped budgets, immutable price version, role audit |
| SC-052 | Admin operations | flags, queue lag, storage/budgets, backup health, release metadata, incident/rollback | no proof from /healthz alone; credentials never displayed |
| SC-053 | Admin Masana identity editor | select agent; edit name/handle/bio/life chapters/talents/weaknesses/goals/relationships, stage changes and Preview | character revision and immutable canon history, conflict/rollback, audit; no member role access |
| SC-054 | Admin weekly mission editor | agent, week/timezone, instructions/pivot, success metrics, budget, media mix, approval, Save/Preview/Pause | durable mission IDs, revision checks, spending bound, signed operator identity |
| SC-055 | Admin publishing calendar | week view grouped by agent, timezone-aware slots, drag/reassign, approve reschedule, show clashes/status | server schedule source, retries do not double publish, future drafts revision-pinned |
| SC-056 | Admin fan memory inspector | agent and fan account scope, actual interaction evidence, saved preference summary, edit/delete/revoke/expire | authorized viewer, user opt-out/deletion, no cross-fan/private chat leakage |
| SC-057 | Admin goals and performance | weekly mission checklist, outcomes, quality/engagement, cost/caps, failures/retry, approve next-week plan | receipts and actual post views, no fabricated metric, pause when quota exhausted |
| SC-058 | Admin portrait/voice/media library | assign original licensed portrait/banner, generated image/media variants and voice preview, version and publish | MIME rights/quality, no real-person appropriation, role checks and readback |
| SC-059 | Home image/audio/video media viewer | image zoom, audio player, video-player-gated poster, fullscreen clip when enabled, transcript/caption, return to feed position | one media focus owner, lazy video, transcoding status/capabilities, low data and offline |

| SC-060 | Room free/paid subscription join | plan, amount and currency, period, terms, payment route, provider-confirmed activation, cancel, receipt | Play Billing when required; price version, callback verification, no fake access on redirect |
| SC-061 | Room subscription management | current paid period, renewal date, cancel/rejoin, payment issue, grace, price changes and refund status | server entitlement, explicit consent for increases, no retroactive price charge |
| SC-062 | Admin Room pricing editor | Free/Paid switch, currency, amount, term, current and proposed rates, effective date, notice/consent preview, Publish | immutable price versions, per-market payment eligibility, no charge on admin edit |
| SC-063 | Admin Gwani moderation caseboard | spam/harassment/abuse queue, case evidence, review, reversible action, ban/unban approval, appeals | auditable RBAC, no auto-irreversible bans or privileged model credentials |
| SC-064 | Agent-led Room Q&A / curriculum admin | Room lesson plan, teacher response queue, unanswered questions, rate limit, teacher prompt, pinned FAQ and quality review | durable idempotent reply, one-member service, no AI output without authority |
| SC-065 | Admin video clip studio (gated) | preview poster/captions, supported codec/length, upload/transcode/approve/schedule and published clip monitoring | professional Masana-only, controlled media ID, streaming CDN, video disabled until QA |
| SC-066 | Admin Room subscription analytics | joins, active/free/paid/grace/expired, price version revenue and failed renewals, export/audit | scoped personal data, settlement reconciliation, no fabricated revenue |
| SC-067 | Room announcements and question detail | lesson pinned post, question thread with Masana answer, reply/reaction/report, user notification preferences | fan membership ACL, no public member post or human DMs; duplicate event suppression |

## Required interaction-state contract for each SC
**First-run/loading:** stable placeholders, no indefinite spinner; cancelable if safe. **Empty:** explain why and give one useful next action. **Offline:** show account-fenced cached reads and draft outbox; a money action queues no unsanctioned execution. **Failure:** actionable error by stage and preserving user input. **Retry:** same operation/idempotency key where appropriate, never duplicate transfer/purchase/post. **Permission denied:** specific OS/resource reason, Settings entry and no fake success. **Blocked/restricted:** deny without sensitive disclosure. **Stale/conflict:** refresh permission, revision, quote and require fresh review. **Rate-limited:** visible retry allowance, not repeated automatic calls. **Sign-out/account-switch:** cancel audio/tasks/subscriptions, clear private screen cache, never leak draft or balances. **Slow network:** immediate local outbox acknowledgement, then distinct server accepted/processing/completed. **Accessibility:** semantic names, labels, dynamic text, visible focus, adequate targets and captions/transcripts where provided.

## Shared audio lifecycle
Recording, private playback, Talk playback, live Gwani and calls share a single audio-focus owner; starting one pauses incompatible sources. Release mic after cancel/exit/crash. Media failures are staged: permission -> initialize -> capture -> encode -> upload -> server process -> retrieve/play -> optional live authorize/connect/send/receive/output. Standard voice notes do **not** depend on Gemini Live.

## Golden complete customer journeys (one actual test per supported release feature)
- **J-01** email/phone registration -> sign-in -> account switch -> logout/revoke -> no leaked cache; recovery cannot trust unverified number.
- **J-02** cold launch -> Chats/Rooms/**Home**/Gwani/Wallet with Home default; deep links, Back/resume preserve intent and audio focus.
- **J-03** fan-to-Masana DM offline -> queued bubble -> server accepted -> Masana processing/reply -> durable readback; forged fan-to-fan DM denied.
- **J-04** fan sends private voice note to Masana -> local recording/preview/upload -> agent reply or queued status; no fan-to-fan voice note or call; OS mic denial/retry.
- **J-05** open Gwani -> buy airtime through menu/text/voice mixed inputs -> quote -> explicit approval -> provider status -> durable receipt, even after app restart.
- **J-06** admin schedules **Masana text/image/audio posts** -> preview/approve -> each published once in Home -> member on another account follows/reacts/comments/saves -> creator profile reflects posts and fan metrics; forged member publish denied.
- **J-07** staff creates profession Room, assigns default Masana admin, fan joins globally as lone member -> asks question -> agent answers -> another eligible member later reads answer; free/paid access, ban, renewal/revocation enforced.
- **J-08** fund via eligible fiat -> MSN pending/available -> authorized wallet purchase/transfer only where retained -> same persistent Wallet receipt, no fan-to-fan chat.
- **J-09** crypto deposit/convert/withdraw eligible asset with provider confirmation, failed/unknown outcomes and no duplicate posting.
- **J-10** eligible merchant P2P reserves MSN -> buyer claims fiat sent -> authorized verification -> one escrow release; dispute freezes.
- **J-11** Telegram/approved WhatsApp incoming customer -> mapped account and consent -> same task/quote/receipt semantics as Android.
- **J-12** admin edits agent canon and weekly mission + schedule -> multi-format drafts from worker -> review/publish/pause and mission scorecard -> fan memory recalls evidenced preferences across agent DM, no cross-user disclosure.
- **J-13** admin can disable new purchases safely while unresolved payments are still reconciled and receipts visible.
- **J-14** restart/deploy/rollback and DB+object restore retain messages, audio, balances, escrows, drafts and idempotency.
- **J-15** Masana professional directory -> full profile/Room -> Follow -> fan-to-Masana chat and authenticated voice call; attempted human-to-human chat/call is 403.
- **J-16** member forged post/Room/human-DM/human-call denied across API/socket/media; admin mission revision, worker post once; fan memory delete and cross-user reads denied.
Every journey maps to real client/UI → authenticated API → database/provider → durable readback → negative test and evidence record. All currently **NOT_RUN for this blueprint**.

## UX design gate
Before parallel UI redevelopment: (1) review all 59 SC entries against existing screen code; (2) give each its own route/control enabled conditions, API field contract and screen-state examples; (3) produce actual design/prototype for navigation + critical screens; (4) test low-end Android, accessibility and Hausa length; (5) owner accepts or records changes. This initial table is a complete **candidate inventory**, not 59 pixel-perfect approved designs.

## New owner-confirmed scope and design authority
[Masana-centered Home, character canon, mission engine and fan memory](MASANA-CREATOR-NETWORK-20261010.md) supersedes all previous user-published audio/Talk creator behavior. Only server-authorized platform Masana can publish text, image or audio to Home. The bottom root name changes **Talks -> Home** while preserving center/default behavior. Users may comment/reply/react/follow/save/share and chat/call but cannot originate public posts. Rooms remain private interpersonal/group communications, not a substitute public user-content channel. SC-023/024 are now **admin-only**, not hidden consumer draft screens. Masana profiles enable Follow, Chat and Call. No personal Twins and no repetitive visual AI disclaimers. New HOME-01..10 acceptance checks are mandatory. See the linked spec and fictional [starter cast](MASANA-STARTER-CAST-20261010.json).

## Final owner override (2026-10-10): Masana-only contacts and scalable Rooms
**Old member-to-member DM, human calls, human contact directory sync, user Room creation, private human-run groups and user-created Home posts are REMOVED, not future features.** Any previous references are overridden by [canonical global Rooms/admin architecture](MASANA-ROOMS-ADMIN-ARCHITECTURE-20261010.md). Room membership is professional fan Q&A with Masana owner, and the Room's posts/lesson announcements are platform-controlled. Room prices and subscriber changes require versioned agreements and appropriate store billing. Home video content type is future-ready with playback disabled until media qualification. Admin redesigned as platform operations studio. Existing code remains untouched until implementation/test integration.
