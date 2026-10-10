# Masanawa — Screen, interaction and journey register 1.1
**Binding UX target, revised 2026-10-10.** This replaces all Talks, Contacts, Twin and creator screens. Every screen lists its owner lane (DELIVERY §3) and its API (ARCHITECTURE §11). A screen is done only when its UI, API, DB, worker and tests all exist and its journey passes.

## 1. Design system (`apps/*/lib/src/shared/design`, owner L-SHELL)
- **Colour tokens:**

| Token | Value | Use |
|---|---|---|
| `primary` | `#1E63D6` (Masanawa blue) | main actions, active tab |
| `primary-strong` | `#174EA8` | pressed/headers |
| `navy` | `#0E1B33` | dark surfaces, text on light |
| `neutral` | `#FFFFFF` / `#F4F6FA` / `#5B6578` | surfaces, secondary text |
| `success` | green | **only** for confirmed success |
| `warning` | orange | warnings |
| `error` | red | errors |

  The Masana seed `primaryAccent` (e.g. `#356FBD`) tints only that agent's profile banner and room cover. Old green tokens, the green launcher icon and the green splash are removed.
- **Type and layout:** one sans family (current app font if licensed, otherwise Noto Sans for Hausa coverage). Use a 4-pt spacing scale, radius 12/16, 48 dp minimum touch targets, WCAG AA contrast enforced by golden tests, dark mode, and text scaling to 200% without clipping. Hausa and English strings come from ARB files with no hard-coded copy.
- **Shell:** five tabs `Chats · Rooms · Home(centre, default) · Gwani · Wallet`, with Home's inner `Feed | Videos` segmented tabs and a remembered selection. There is never a sixth root. The avatar in the Home header opens Account.
- **Composer** (shared widget, owner L-CHAT): attach `+` sits outside the field. The trailing button is **Mic** when empty and **Send** when there is text or an attachment, including while the agent streams. **Stop** is a chip on the streaming bubble. Hold-to-record supports lock, cancel and preview. Drafts persist per conversation (debounced 500 ms). Local bubbles appear instantly with `sending → sent → failed(retry)`. One audio-focus owner is shared by voice notes, posts, videos and calls.
- **Mandatory states on every data screen:** loading skeleton, empty with CTA, error with retry, offline (cached read plus queued writes), permission denied, feature disabled by flag, stale or conflict, account switched (cancel in-flight and clear the projection), long text, and RTL-safe identifiers.

## 2. Consumer screens
### Entry and account — L-SHELL
| ID | Screen | Controls | API | Gate |
|---|---|---|---|---|
| C01 | Splash | blue logo, session restore, deep-link resume | `GET /v1/me` | revoked session → C02; no debug tokens |
| C02 | Welcome / sign-in / sign-up | language, phone or email OTP, age confirmation (D2) | existing auth | rate-limited; age gate |
| C03 | Recovery | resend countdown, re-verify, revoke other sessions | existing auth | account-scoped |
| C04 | Fan setup + AI disclosure | display name, optional avatar, interests, languages, **one-time Masana disclosure** (BLUEPRINT §9), suggested Masana to follow | `PATCH /v1/me`, follow | no contacts permission ever requested |
| C05 | Account | following, joined Rooms, saved, subscriptions, Wallet link, Settings | `GET /v1/me` | no public fan profile |
| C06 | Settings & privacy | language, theme, notifications per category, **memory per Masana (view/delete/disable)**, muted comments | `/v1/me/memory` | own data only |
| C07 | Account lifecycle | export, delete (anonymises comments), sign out all devices, open Gwani support | existing deletion | ledger retention kept |
| C08 | Notifications | replies to my comments, Room answers, new posts from followed (digest), subscription and wallet events, case updates | `GET /v1/notifications` | deduped; no human-to-human events |

### Chats and calls — L-CHAT
| ID | Screen | Controls | API | Gate |
|---|---|---|---|---|
| C10 | Chats list | Masana conversations, unread, pin, search; empty state suggests Masana | `GET /v1/chats` | Masana only; Gwani → Gwani tab |
| C11 | Find Masana | search by name, profession, skill, language; profile; Chat; Call | `GET /v1/masana` | platform agents only |
| C12 | Conversation | messages, reply, image/doc/voice note, shared composer, Stop, retry | `POST …/messages`, WS | fan↔Masana; idempotent |
| C13 | Message actions | reply, copy, delete own (local and server), report | `POST /v1/cases` | no forward |
| C14 | Call connecting | mic permission, availability, cancel, disclosure line | `POST /v1/calls` | qualified voice only; quota |
| C15 | Call active | mute, speaker, end, reconnecting, elapsed, budget warning | LiveKit | real media only |

### Home — L-FEED (C20–C26), L-VIDEO (C27–C29)
| ID | Screen | Controls | API | Gate |
|---|---|---|---|---|
| C20 | Home shell | Feed/Videos tabs, search, notifications bell | — | Feed default |
| C21 | Feed (For You / Following) | mixed-height text, image and audio cards; react, comment, save, share, report; author tap → profile | `GET /v1/feed` | Masana posts only; no post button |
| C22 | Post detail | full media, comment thread with replies, sort, report, author | `/v1/posts/:id`, comments | new-account comments pre-moderated |
| C23 | Media viewer | image carousel and zoom; audio player with seek, speed, transcript, background play | signed media | single audio focus |
| C24 | Masana profile | banner, portrait, name, profession, bio, life story, talents, languages, goals, posts by kind, Room card, **Follow · Chat · Call · Room** | `/v1/masana/:id` | approved revision only |
| C25 | Saved | saved posts and saved videos, unsave, resume audio | `/v1/saved` | account-fenced |
| C26 | Search | tabs Masana · Rooms · Posts · Videos | `/v1/search` | no human results |
| C27 | Videos | provider filter chips, grid/list, channel attribution, save, share, report | `GET /v1/videos` | approved, embeddable items only |
| C28 | Video player | official embed inline or fullscreen, provider controls, *Open in {provider}*, next | — | one player; pause on exit, call or background |
| C29 | Video unavailable | removed, region-blocked or not embeddable → open at source or back | — | never a broken player |

### Rooms — L-ROOMS
| ID | Screen | Controls | API | Gate |
|---|---|---|---|---|
| C30 | Rooms | Discover/Joined, filters (topic, language, Free/Paid), search | `GET /v1/rooms` | **no Create button** |
| C31 | Room preview | cover, profession title, teacher card, rules, sample lesson, member count, Free/price chip, Join/Subscribe | `GET /v1/rooms/:id` | paid content hidden |
| C32 | Room home | tabs Lessons · Questions · Discussion, pinned FAQ, Ask button, mute, leave | lessons, questions, discussion | membership or entitlement |
| C33 | Ask question | text (with optional image), duplicate suggestions before submit, quota remaining | `POST …/questions` | rate-limited; idempotent |
| C34 | Question thread | status chip queued/answering/answered/needs staff, teacher answer, follow-up, helpful, report | — | lone member still answered |
| C35 | Subscribe (paid) | plan, price, currency, period, price version, terms, Play Billing sheet, pending, success | `…/subscription/verify` | server-verified only |
| C36 | My subscriptions | status, renewal date, manage in Play, price-change notice and consent, grace banner | `GET /v1/subscriptions` | not retroactive |

### Gwani — L-GWANI
| ID | Screen | Controls | API | Gate |
|---|---|---|---|---|
| C40 | Gwani home | chat plus quick actions: Help · Report · My cases · Bills · Wallet · Learn | `/v1/gwani/messages` | durable tasks |
| C41 | Report | pick target (post, comment, Room reply, video, transaction, account), category, details, attach | `POST /v1/cases` | evidence limited to reporter's access |
| C42 | Case detail | ID, timeline, outcome, Appeal | `/v1/cases/:id` | owner only |
| C43 | Service task card (in chat) | exact quote, confirm, open dedicated review screen, receipt | commerce | same task as C51/C53 |

### Wallet, Bills and Crypto — L-FIN
| ID | Screen | Controls | Gate |
|---|---|---|---|
| C50 | Wallet | MSN available/pending/reserved, crypto assets, activity, shortcuts Bills · Crypto · Subscriptions | canonical ledger |
| C51 | Bills home → product → review → status | Airtime, Data, Electricity, TV; recipient or meter validation; quote with expiry; authorize; pending, receipt, recovery | never auto-opens Chats |
| C52 | Crypto overview / asset | eligible assets and networks, Receive, Buy (eligible), Convert, Withdraw | flags per eligibility |
| C53 | Receive / Convert / Withdraw | address + network + memo + QR; quote, expiry, review; step-up, fees, status | provider truth; no duplicate payout |
| C54 | Activity detail | immutable receipt, provider reference, help → Gwani case prefilled | user-private |

## 3. Admin screens (role in brackets)
| ID | Screen | Controls | Lane |
|---|---|---|---|
| A01 | Overview [any] | health tiles: workers, queues, Room answer age, sync lag, cases SLA, budgets, entitlement errors, financial alerts | L-ADMIN |
| A02 | Masana list [content_editor] | search, status, pause, autonomy level | L-MASANA |
| A03 | Character editor | bible sections, revision diff, media (rights note), voice preview, relationships, approve | L-MASANA |
| A04 | Agent sandbox | chat, call and post rehearsal against a draft revision, never public | L-MASANA |
| A05 | Post studio | text, image or audio draft, generate or upload approved media, preview as card, schedule | L-FEED |
| A06 | Review queue | due, in review, scheduled, published, failed, taken down; approve, revise, take down | L-FEED |
| A07 | Missions | weekly objective, slots, format mix, budget, autonomy level, pause | L-MISSIONS |
| A08 | Calendar & scorecard | slot timeline, run states, retries, spend, measured engagement | L-MISSIONS |
| A09 | Rooms [room_manager] | create, edit, assign teacher or co-host, languages, curriculum (skills), pause, archive | L-ROOMS |
| A10 | Room console | question queue (state, age), staff answer or approve, announcements, pin FAQ, moderation | L-ROOMS |
| A11 | Plans & prices [pricing_manager] | Free/Paid, price versions mapped to Play products, effective date, subscriber impact preview | L-ROOMS |
| A12 | Entitlements | search by fan or Room, provider status, re-verify, history | L-ROOMS |
| A13 | Video sources | provider, channel ID or URL, mode auto/manual, authorization status, enable/pause, sync now | L-VIDEO |
| A14 | Video items | pending, approved, hidden, unavailable; approve or hide; errors; quota | L-VIDEO |
| A15 | Moderation [moderator] | case queue by SLA, evidence, Gwani proposal, approve/reject action, ban/unban (dual approval), appeals | L-GWANI |
| A16 | Fans & Memory [fan_data_officer] | per-Masana aggregates; individual memory only with purpose and audit; erase | L-MISSIONS |
| A17 | Finance & Services [finance_operator] | provider states, pending orders, reconciliation, refunds (approval), subscription revenue | L-FIN |
| A18 | Operations [ops_admin] | flags, kill switches (posting, teaching, imports, calls, paid joins), job leases, dead letters, budgets, version, backups | L-ADMIN |
| A19 | Staff & roles [super_admin] | invite staff, assign roles, 2FA status, audit log | L-ADMIN |

## 4. Journeys (executable acceptance, J01–J20)
Each journey is a test under `tests/e2e/J##/`. A journey is either backend-integration against PG18 or a Flutter integration test on device or emulator. Evidence is recorded as DELIVERY §6.

| ID | Journey | Lane |
|---|---|---|
| J01 | sign-up with age gate, disclosure, follow suggestions, session restore after kill | L-SHELL |
| J02 | five tabs, Home Feed/Videos switching, deep link to post, Room and video, back-stack integrity | L-SHELL |
| J03 | Masana chat offline → reconnect, Send while streaming, queued turns, idempotent retry | L-CHAT |
| J04 | voice note round-trip; real Masana call connect/mute/end; quota stop | L-CHAT |
| J05 | Bills purchase directly **and** via Gwani yields the same quote, task and receipt; no Chats redirect | L-FIN |
| J06 | admin drafts → approves text, image and audio posts → fan sees them, reacts, comments, saves; counters update | L-FEED |
| J07 | staff creates Room → single fan joins → asks → teacher answer delivered and notified | L-ROOMS |
| J08 | paid Room: Play test purchase → verify → access; cancel → grace → expire → denied; price change with notice | L-ROOMS |
| J09 | crypto receive, convert and withdraw on the eligible sandbox with retry and receipts; no double debit | L-FIN |
| J10 | forged requests (human DM or call, post create, Room create, Twin, gift, paid read, role spoof) all 403/410 at REST, WS and job layers | L-PLATFORM |
| J11 | fan memory: recall in a later session; view; delete one or all; disable; no cross-fan recall | L-MISSIONS |
| J12 | mission publishes exactly once across a worker kill and restart; over-budget refusal | L-MISSIONS |
| J13 | spam report → Gwani proposes → reversible auto action → staff approves ban → appeal → reverse | L-GWANI |
| J14 | YouTube upload → WebSub → ingest → approve → official player plays; deleted video → unavailable | L-VIDEO |
| J15 | TikTok/Meta without permission → manual admission or rejection; never auto-scraped | L-VIDEO |
| J16 | account switch cancels audio, video, calls and drafts and clears projections | L-SHELL |
| J17 | restore PG and objects into staging; migrations upgrade; APK on a low-end device; rollback | L-PLATFORM |
| J18 | 12 Masana, 12 Rooms, 24 posts seeded idempotently twice on staging; media verified | L-MASANA |
| J19 | admin RBAC: each role denied outside scope; audit entries written | L-ADMIN |
| J20 | load profile (ARCHITECTURE §8) within latency and cost budgets | L-PLATFORM |
