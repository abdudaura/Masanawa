# Masanawa — Complete screen and interaction register
**Binding UX target as of 2026-10-10.** End-to-end interaction states are mandatory, even when a UI is visually simple. This register replaces all older Talks/Contacts/Twin/creator screen plans.

## Design system and shared patterns
- **Brand:** one semantic Masanawa blue family plus navy/neutral white; green reserved for confirmed success, orange warning/red error. Replace legacy WhatsApp greens centrally in mobile/admin token packages, app launch and artwork. One logo, consistent typography, modest elevation/radii, dark theme, min accessible touch targets. Test color contrast and Hausa/English text wrapping on low-end Android.
- **Shell:** five bottom items Chats, Rooms, **Home center/default**, Gwani, Wallet. Home has two clearly visible inner tabs **Feed | Videos**. Do not add Billing/Crypto or Calls as sixth root item. Account profile/settings from header or avatar.
- **Chat composer:** one TextField with attachment `+` outside field; action Mic when truly empty, Send when text/file staged, **even during agent response**; Stop response is a bubble/header action, not a replacement for Send. Focus/keyboard stable; recording preview/lock/cancel; persist debounced drafts, instant local bubble before network; queue subsequent turns, stable idempotency. One audio-focus owner shared with playback/voice calls.
- **Every screen** has actual loading, empty, error, permission-denied, offline, retry, stale/conflict, account switch, long text, low-memory and accessibility states. All rights checked server-side, not merely disabled buttons.

### Entry/account (C01–C07)
| ID | Screen | Controls / follow-on | Gate |
|---|---|---|---|
| C01 | Splash and session | neutral blue/white logo, restore signed-in session, deep link | expired/revoked session; no debug token |
| C02 | Welcome/register/login | language, email/phone eligible login, show/hide credential, Submit/recovery | phone ownership not implied by numeric password |
| C03 | Recovery and verification | permitted methods, resend countdown, new credential and session revoke | account-scoped, rate-limited |
| C04 | Fan setup | display name, avatar optional, interests/languages, Skip/Save | no phonebook permission |
| C05 | My account/profile | following Masana, joined Rooms, saved posts, transactions/subscriptions, Settings | never an external user creator profile |
| C06 | Settings & privacy | language/theme, mic/notification, follower-memory disable/view/delete, muted/blocked Room/agents | per-user/account authorization |
| C07 | Support/account lifecycle | Gwani support case, appeal, export/delete, logout all devices | preserve transaction retention & audit |

### Chats and calls (C08–C14)
| ID | Screen | Controls / follow-on | Gate |
|---|---|---|---|
| C08 | Masana Chats | agent list, unread, search, favorite, start chat, recent agent call | **no human result** |
| C09 | Masana discovery | profession/skill/language/topic/name search, profile, Chat/Call | platform agents only |
| C10 | Agent DM | avatar/role, messages, reply, share media, normal composer, voice note, quote/receipt | fan↔Masana only, immediate ACK/queue |
| C11 | Attachment/voice composer | gallery/document/record, preview/trim/cancel/retry/send | no public user-post upload |
| C12 | Message actions | reply, copy, delete own, report, receipt link | no forward-to-human chat |
| C13 | Call initiating | agent profile/button, mic permission, availability, connect, cancel | live agent voice service required |
| C14 | Call active | mute, speaker, end, reconnect, elapsed, failure | no human peer, no fake media connection |

### Home (C15–C24)
| ID | Screen | Controls / follow-on | Gate |
|---|---|---|---|
| C15 | Home shell | **Feed / Videos** tabs, search/notifications; selected tab preserved | Feed default, root Home default |
| C16 | Feed For You | mixed-height Masana text/image/audio; follows, comments, reactions, save, share | original platform publisher only |
| C17 | Feed Following | only followed agent updates with empty CTA | no human public content |
| C18 | Post detail/comments | media display, human comments/replies, report, author profile | fan can comment but cannot publish post |
| C19 | Masana profile | distinctive portrait/banner/story, talents, skills, goals, posts by type, **Follow Chat Call Room** | versioned canon; one agent ID |
| C20 | Saved posts | list, search, re-open, unsave, resume audio | account fenced |
| C21 | Media viewer | image zoom; audio cover/seek/transcript and focused listen | single audio focus |
| C22 | **Videos** | externally hosted clips, provider/category filters, poster, creator attribution, Save Share Report | no video file hosting |
| C23 | Official embed player | inline/fullscreen, one player, provider controls, source link, pause on exit | YouTube/TikTok/Facebook qualified player; fallback |
| C24 | Explore search | Masana, Rooms, topics, public Home posts, permitted external videos | no human contact directory |

### Professional Rooms (C25–C31)
| ID | Screen | Controls / follow-on | Gate |
|---|---|---|---|
| C25 | Rooms directory | Explore/Joined, topic/language/Free/Paid filters, search, owner + Join | no New Room button |
| C26 | Room preview | profession cover, lessons and rules, owner profile, member count, free/price term | restricted message history hidden |
| C27 | Room detail | Lessons/Announcements, Questions, moderated Discussion, pinned FAQ and ask | fan membership required |
| C28 | Question and answer | one member's question, Masana teacher answer, follow-up, report, queued states | even lone member triggers durable answer |
| C29 | Free join/leave | Join, mute, Leave, Rejoin | server membership ACL |
| C30 | Paid join | plan, amount, currency, term, price version, Play-compliant checkout, success/pending | verified external receipt entitles reads |
| C31 | My subscriptions | renewal date, cancellation, price notice/consent, grace/refund support | price change not retroactive |

### Gwani, Wallet and Billing/Crypto (C32–C43)
| ID | Screen | Controls / follow-on | Gate |
|---|---|---|---|
| C32 | Gwani | chat + quick actions Support, Spam, Complaint, Appeal, Bills, Learning, Wallet | case and task are durable |
| C33 | Report / complaint | select post/comment/Room/transaction, evidence, submit | authorized evidence only |
| C34 | Case status / appeal | reference, investigation events, action and appeal request | sensitive enforcement gated |
| C35 | Wallet overview | MSN available/pending/reserved, eligible crypto assets, transactions, Subscriptions/Bills/Crypto | canonical ledger |
| C36 | Bills home | Airtime/Data/Electricity/TV tiles, repeat purchase, history | independent page; never auto Chat |
| C37 | Bill product | provider catalog, recipient/meter/plan/amount, validation, draft | server capabilities, task revision |
| C38 | Bill review/status | exact amount/fees, authorize, pending/failure/receipt/recovery | dedupe and reconciliation |
| C39 | Crypto overview/asset | eligible assets/networks, Receive/Send/Convert/Buy, holdings | not a chat redirect |
| C40 | Crypto deposit/receive | address/network/memo/QR, confirmations and credit status | provider truth |
| C41 | Crypto convert | quote, expiry, review, processing and receipt | atomic amounts |
| C42 | Crypto transfer/withdraw | recipient/address/network, fees, step-up, status | denied unsupported chains, no duplicate payout |
| C43 | Wallet activity/detail | immutable time, asset, quote/operation, provider, final status, help | user-private receipt |

### Android Admin (A01–A18)
| ID | Screen | Controls | Gate |
|---|---|---|---|
| A01 | Overview | agent/worker/room/content/case/budget/financial health | scoped admin metrics |
| A02 | Masana directory | search/add/edit/pause, profession, count | admin |
| A03 | Character editor | name, portrait/banner, bio/life story, voice, skills, character relationships | versioned canon |
| A04 | Agent preview/test | profile/feed/voice/call rehearsal without public publish | staging/preview |
| A05 | Original post studio | text/image/audio drafts, covers, playback, schedule, approve/revise | admin or worker, no fan post |
| A06 | Editorial queue | incoming, due, review, published, failed, takedown | idempotent post ID |
| A07 | Weekly missions | goals, focus pivot, timezone, quotas/approval/budget | versioned/authorized |
| A08 | Calendar/results | scheduled slots, mission completion, spend, retries, audience feedback | actual metrics |
| A09 | Global Rooms | create/edit/assign Masana, name by profession, language, curriculum, pause | staff only |
| A10 | Room teacher console | questions, queued teacher replies, announcements, pin/approve/moderate | room-specific ACL |
| A11 | Room plans/prices | Free/Paid, currency/amount/period, effective future date, preview | version/notice |
| A12 | Subscriptions/entitlements | active/grace/cancel/refund, provider status and issue | store/ledger truth |
| A13 | External video sources | platform, channel ID/URL, authorized sync method, connect/enable/pause | no arbitrary script |
| A14 | Imported videos | latest, approved/hidden/deleted, errors/quota, sync now, source detail | no forbidden scraping |
| A15 | Gwani moderation cases | evidence, spam rules, reversible action, review, ban/unban and appeal | auditable sign-off |
| A16 | Fans/memory | per-agent follower insights, limited fan memory inspector, edit/erase policy | no cross-fan leakage |
| A17 | Finance/Services | provider states, pending orders, ledger reconciliation, Room payments | segregated finance roles |
| A18 | Operations/settings | worker leases, providers, alerts, flags, backups, build/version, rollback | restricted credentials |

## Real journeys (17 executable assertions)
J01 auth/signup/session recovery; J02 five-tab/Home Feed and Videos deep-link/resume; J03 Masana DM offline+concurrent agent reply+Send available; J04 voice note and optional agent real call; J05 Gwani bill via menu/voice or direct Bills with same quote/receipt; J06 admin-approved Masana text/image/audio post -> fan follow/react/comment readback; J07 staff Room + lone fan question -> owner response; J08 free/paid Room plan and store/eligibility price-change/renewal/revoke; J09 crypto fund/convert/withdraw eligible service with retry/receipts; J10 member forged human chat/call/post/Room creation all rejected at server; J11 fan-specific agent recall and opt-out/deletion; J12 agent missions/publish once after worker restart; J13 Gwani spam case investigation/action/review/appeal; J14 YouTube upload -> verified provider ingest -> Videos screen official playback; J15 TikTok/Meta permission denied -> explained manual qualified embed or not listed; J16 account switch cancels old media/drafts/subscription projection; J17 restored PostgreSQL+objects/outbox/media+APK on low-end real phone, Railway staging/rollback and cost bounds.

Complete implementation of a journey means full Flutter/admin -> typed authenticated API -> canonical Postgres/worker/provider -> durable readback and negative/operational evidence, not a static screen screenshot.
