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


## 2A. Screen coverage expansion — owner revision 1.2
The following IDs extend the existing screen inventory without renumbering implemented C01–C54 routes. A destination may be a modal/subroute within one Flutter file; the functionality, deep links, backend checks and error states are not optional.

| ID | Destination / owner | Layout, controls and navigation | Canonical API / persistent authority and negative states |
|---|---|---|---|
| C09 | Device security · L-SHELL | active device list, revoke, step-up, account recovery link | auth sessions; offline, expired, unauthorized, switch-account |
| C16 | Chat attachments · L-CHAT | + tray, preview, cancel/upload/retry | signed private upload; denied permissions, oversized, offline |
| C17 | Chat outbox · L-CHAT | pending/failed/retry/undo, no disappearing Send | idempotent agent turn; stream error, restart, duplicate |
| C18 | Call history · L-CHAT | Masana-only entries, retry call | call session read; revoked microphone, service down |
| C19 | Fan memory · L-MISSIONS | per-Masana read/correct/delete/disable | consent+memory; cross-fan read forbidden |
| C37 | Free Room join · L-ROOMS | join/leave/mute and terms | server membership; blocked/expired |
| C38 | Room saved lessons · L-ROOMS | bookmarks, resume, paywall if revoked | membership/entitlement; offline cached denial |
| C39 | Room discussion · L-ROOMS | moderated thread reply/report, no member DM | room replies; membership and ACL |
| C44 | External social contacts · L-MASANA | profile row of verified accounts; Follow/Message/Open, capability state | public identity read; never expose tokens/unverified handles |
| C45 | External contact handoff · L-MASANA | provider confirmation/privacy, open approved URL, browser fallback | published identity and allowlisted URL; unavailable mode |
| C46 | Following/interests · L-MASANA | followed Masana, mute, interest/language filters | follows; account fenced |
| C47 | Wallet corridor/fees · L-FIN | policies, eligible assets, fee details and regional limits | financial eligibility; live-off reason |
| C48 | Buy MSN quote · L-FIN | currency, payment rail, amount, quote/expiry/review | provider-backed funding quote; KYC/region denial |
| C49 | Buy MSN checkout/receipt · L-FIN | hosted checkout, return, pending/retry/receipt | settlement callback and ledger; duplicate/underpaid/refund |
| C55 | MSN→crypto quote · L-FIN | amount, token/network picker, rate, spread, fees, receive net | quote+reserve; expiry, insufficient, unsupported |
| C56 | Conversion review/status · L-FIN | consent/confirm, pending/failure/unknown and receipt | idempotent provider job+reconcile; double-debit forbidden |
| C57 | Withdraw destination · L-FIN | asset/network, address/memo, limits and warning | whitelist validation; wrong-chain denial |
| C58 | Withdraw review/status · L-FIN | fee, step-up auth, confirm, broadcast and settled states | payout journal+worker; no fiat cashout |
| C59 | P2P marketplace · L-FIN | Buy/Sell, fiat/crypto/method filters, verified seller stats | offers+eligibility; no unapproved corridors |
| C60 | P2P offer detail · L-FIN | price, limits, fee, merchant status, terms, accept | quote/order policy; stale offer |
| C61 | P2P merchant eligibility · L-FIN | identity/verification/limit and appeal | KYC/merchant registry; paused/prohibited |
| C62 | Create/edit P2P offer · L-FIN | side, price, min/max, methods, pause/publish | reserve-backed availability; self-trade denial |
| C63 | Escrow order review · L-FIN | countdown, parties, exact crypto locked and fee | unique order, atomic ledger reserve |
| C64 | Fiat payment instructions · L-FIN | disclosed destination, mark paid and upload private evidence | external fiat only, not proof of receipt |
| C65 | Seller receipt verification · L-FIN | bank receipt verified checkbox, step-up, release | seller-confirmed or independently staff-approved release |
| C66 | P2P dispute · L-FIN/L-GWANI | case timeline, private structured evidence, escalation | frozen reserve and role-scoped audit |
| C67 | P2P appeal · L-FIN/L-GWANI | submit appeal, reviewer outcome, no auto-settlement | independent human approval |
| C68 | P2P orders/history · L-FIN | active, completed, cancelled, disputed and immutable receipts | ledger projection; account isolation |
| C69 | P2P reputation/safety · L-FIN | verified seller stats, report, scam warning | actual computed values; no invented ratings |
| C70 | P2P notifications · L-FIN | payment marked, reserve, dispute, expiry | per-order event dedupe and read cursor |
| C71 | Funding reversal status · L-FIN | failed/refunded top-up, case handoff | verified provider refund/chargeback |
| C72 | Conversion reconciliation · L-FIN | uncertain status, support, no blind retry | worker reconciliation |
| C73 | Payout confirmations · L-FIN | network, txn hash when known, finality/reorg | custody provider confirmation |
| C74 | Region & compliance notice · L-FIN | explanation and next eligible actions | live corridor/provider gate; fail closed |
| C75 | Fee detail/terms · L-FIN | maker/taker, escrow, provider, network breakdown | price policy revision preserved |
| C76 | Escrow evidence upload · L-FIN | secure document/statement, redact, revoke | case-only ACL and retention |
| C77 | Dispute review status · L-FIN | staff decision/appeal, due dates | no AI unilateral transfer |
| C78 | Social connection status · L-MASANA | verified/link-only/paused labels and help | capability and revision public projection |
| C79 | External app fallback · L-MASANA | open web, copy link, dismiss | URI allowlist, missing-app handling |
| C80 | Wallet provider incident · L-FIN | outage banner, pending obligations, support | read-only projections while live operations halted |

All C screens share loading skeleton, empty explanation/action, pagination, offline/stale read-only, retry, typed 401/403/410/422/429/5xx errors, accessibility and English/Hausa content. The monetary screens additionally require authenticated step-up, expired quote, explicit irreversible confirmation, idempotency and switch-account cleanup; social screens require verified links and privacy handoff.

## 3A. Additional Android Admin destinations — owner revision 1.2
| ID | Destination / role | Controls and states | API/DB/worker and test |
|---|---|---|---|
| A20 | Social accounts per Masana · content_editor+ops_admin | provider tiles, account link/unlink, verify/publish, health, pause | social_identity unique character/provider/account; forged role denied |
| A21 | Personal WhatsApp setup · ops_admin | record real official-device number, manual verification, link only/manual mode, revoke | no Business/Cloud API; no fake bot pairing; capability gate |
| A22 | Telegram identity and approved bots · ops_admin | bot/link capability, authorized credential reference, test/pause | server vault, Telegram opt-in and deduped event |
| A23 | Other social connectors · ops_admin | OAuth/approval, per-action capability matrix and revoke | API authorization evidence; disabled on token loss |
| A24 | Social response policy · moderator+ops_admin | reply limits, languages, consent, staff takeover, disable | only actual authorized capabilities; audit |
| A25 | External inbox/errors · moderator | per-agent scoped activity, replay and escalation | fan/channel isolation, dead-letter |
| A26 | Public profile links preview · content_editor | verified handle, URL, hide/publish, preview | never expose secrets, unverified or stale URLs |
| A27 | MSN backing & issuance · finance_operator | balance/liquidity policy, caps, disable | one ledger, no unsupported token claim |
| A28 | Funding & conversion desk · finance_operator | reconciliation, failed/uncertain, refunds, fees | idempotent journal, provider callbacks |
| A29 | Crypto payout controls · finance_operator | network allowlist, fees, payout states, pause | custody provider and step-up |
| A30 | P2P merchants/corridors · finance_operator | regional/KYC review, methods, limits | AML/sanctions eligibility and audit |
| A31 | Offer/escrow monitor · finance_operator | locked funds, aging, fraud flags, freeze | atomic reserve and journal conservation |
| A32 | P2P dispute adjudication · moderator+finance_operator | evidence, decision, dual review, appeal, release | no screenshot/AI release, separate approver |
| A33 | Fee and tariff policy · pricing_manager | preview, cap, revision, future effective date | preserve accepted quotes |
| A34 | Finance compliance dashboard · finance_operator | provider approvals, region eligibility, alerts, kill switch | live-default-off, documented authorization |
| A35 | Independent audit/restore · ops_admin | ledger reconciliation, audit export, incident/backup evidence | staging restore, checksum, human sign-off |

## 4. Journeys (executable acceptance, J01–J26)
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

## 5. New mandatory golden journeys
| ID | Scenario (all must include negative cases) | Owner |
|---|---|---|
| J21 | Admin verifies each Masana personal WhatsApp number; fan profile opens real wa.me; automation remains disabled without eligible API; revoke removes public link; cross-character isolation | L-MASANA |
| J22 | Admin authorizes Telegram bot or other permitted connection; inbound fan event routed once to correct character; disabled permission/link-only never sends; privacy and takeover | L-MASANA |
| J23 | Buy MSN: quote→provider checkout→verified settlement→journal receipt. Duplicate/underpaid/reversed/expired callbacks cannot mint funds | L-FIN |
| J24 | MSN→eligible crypto: quote expiry, reserve, provider execution, finality, uncertain retry/reconcile, exact fee. Insufficient/wrong-region denial | L-FIN |
| J25 | Crypto withdrawal: asset/network/address/memo, step-up, broadcast/finality and reorg/timeout reconciliation; unsupported network and fiat cashout denied | L-FIN |
| J26 | P2P: offer→reserve seller crypto→external fiat mark→seller receipt verification→one audited release, fee once; forged screenshot, duplicate/partial/timeout, dispute, human review/appeal conserve balances | L-FIN/L-GWANI |
