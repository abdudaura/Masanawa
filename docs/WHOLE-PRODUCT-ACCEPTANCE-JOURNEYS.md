# Whole-Product Golden Journeys and Acceptance Gates

## Mandatory extended Contacts and unfinished-foundation verification — 2026-10-08

J01–J11 remain mandatory, with **K13–K20 Contacts journeys** defined and testable in [Contacts/phonebook/invitation contract](CONTACTS-AND-ADDRESS-BOOK-EXPERIENCE-20261008.md): accepted real user opens human DM from Contacts; device permission denial and voluntary local phonebook; multi-device relationship/readback; request/cancel/block abuse; safe non-Masanawa invitation; 10k-person/Unicode/low-end UI; correct contact IDs in Talk/Agent/Wallet intent; account deletion and cache/privacy revocation. K01–K12 remain in [first expanded product guide](AI-FIRST-PRODUCT-AND-HUMAN-COMMUNICATION-20261008.md). All **R01–R19/C01–C08** unfinished requirements are explicitly allocated to [F01–F18 recovery owners](ADDITIONAL-U21-U30-AND-FOUNDATION-F01-F18-20261008.md), with [master PR/legacy audit](UNFINISHED-SCOPE-RECONCILIATION-20261008.md). No K/J pass without real authorized Gateway/DB/Flutter/device/security/readback/recovery evidence. Owner lifting the development freeze does not lift release acceptance gates.


Status: **normative cross-feature acceptance overlay / documentation only — 2026-10-08**. This adds **J01–J11 integrated journeys** to `GOLDEN-JOURNEYS.md` (which retains GJ-01–GJ-17); it **does not replace** R01–R19, C01–C08, financial policy or the original tests. Track requirements in `OWNER-REQUIREMENTS-TRACEABILITY-20261008.md`. Target bottom navigation: **Talks · Chats · Assistant · Wallet · Agents**, **Assistant central**. App code/device/provider qualification is **OPEN/UNVERIFIED**.

## General test contract

Perform with real authenticated accounts A and B and two actual supported Android handsets (include a representative inexpensive low-memory Android phone). Use a real backed server and provider sandbox/live controlled qualification as eligible; do not risk live user funds or falsely claim live providers operate. Cover supported language(s) including Hausa and English, UI localization/RTL, screen reader/large text, denied microphone, slow/airplane/reconnect, foreground/background/killed app, token expiration, and settings/account-switch transitions. Every visible action must be connected to actual authority or explicitly explain unavailability.

**Cross-feature invariants**, checked in **every** journey: one canonical authenticated identity; a public Talk is not a human DM or private Assistant; AI persona threads are not people; voice notes and public stage mic are different streams; wallet uses its existing authoritative asset/currency-specific ledger and *no AI model/local state executes a payment*. A new tab never starts a mic or sends a charge. Status, quote/receipt, notification and return routes reference stable typed IDs. Tests explicitly prove the absence of unauthorized data, duplicate tasks, false success and dead buttons.

## J01 — A camera-shy first-time creator hosts an audio Talk and attracts listeners
**Entry:** user completes normal OTP/basic profile (photo optional), opens **Talks** (formerly Home), Explore/Live vertical feeds are available, taps **Start Talk** or gives a spoken topic.
**Path:** draft composer → select topic verbally or type; optional free person invite / Expert/Twin selector → explicit **Go Live**; publish human Host audio; B discovers in Live, joins and hears host. B can Ask/Raise Hand, A admits free human Seat; only authorized speaker transmits. Host leaves/rejoins grace then resumes or ends. Listener returns to preserved vertical feed location.
**Expected:** no camera/video or written script needed; no required Twin; public Host present while live; 6/3 current Seat policy server-controlled; no automatic AI cost; recover permission denied and LiveKit connection issues. Public creator may continue with own voice even if Expert unavailable. Show actual live/replay truth rather than placeholder. **Evidence:** authenticated room lifecycle, two-device mic/playback, permission/network logs free of secrets, Explore/Live vertical widgets and Back behavior, R02/R03/R04/R17/C08 and GJ-01–GJ-03.

## J02 — A low-literacy user uses speech alone, then becomes silent
**Entry:** A opens the centered Assistant, without having to read instructions or grant microphone automatically.
**Path:** user deliberately starts Gemini Live with Gwani, asks in Hausa to find interesting Talks and prepare one; agent explains choices aloud and allows Repeat/Slower. Switches to text/large accessible tap cards mid-task when a quiet environment requires silence, continuing the same intent. User may later speak another supported language without resetting profile/country. Gwana switch preserves scoped history and speaker labels without task duplication.
**Expected:** full outcome with voice **and** silent alternative; language correction/code switching and uncertain digits handled, never assume literacy/residency from accent; no garbled ASR text automatically shown as committed message; mic denied/disconnected state has working Type. **Evidence:** speech/intent coverage, screen reader, RTL/large text, native audio two-way on Android, no browser TTS; VOICE/R11/R19/C07.

## J03 — A sends a real text message to a consenting person
**Entry:** **Chats → New message**, or **Talks → human Host profile → Message**; search handle with privacy rules.
**Path:** start/request chat according to user policy; text and send; A sees queued/sending then real server-acknowledged state; B gets it while in/background; B replies; A reads after app restart and B can see same history from a second permitted device. Follow or public Talk invite remains independent from messaging.
**Expected:** no AI-character conversation substitution, no auto phonebook import, exact account membership guards, same client idempotency key after retry/offline, properly paged durable server history, prompt list paint from protected local indexed cache. Block/report means B is refused subsequent delivery according to policy; signed private media never accessible cross-account. **Evidence:** two actual users, authenticated API/non-member denial tests, DB ordering, reconnect sync, Flutter thread/UI and protected cache; C01–C03/C05/R14/R15/C08.

## J04 — Person-to-person voice notes and privacy-safe notifications
**Entry:** open a human DM under **Chats**, notice active conversation header and single simple composer.
**Path:** deliberate mic record → stop → review → send; B streams/plays only authorized media; A retry after upload timeout does not create two notes. A attaches authorized image/document through compact attachment control, handles bad file or permission denial without blocking normal text. B taps a private push notification, authenticates if needed, opens correct conversation and returns; block/revoke ends access to media even with a stale URL.
**Expected:** text send arrow only sends message/media, not crypto; mic never enters public Talk, no private content leaks into public Talk or AI prompts; lock-screen notification previews masked by default; no permanent storage bloat. **Evidence:** Android audio routing test while live listening, media signed URLs/expiry/revocation, size/type/scanning failure tests, push/deep-link, C03/C04/R14/R15.

## J05 — Creator receives legitimate gifts, seat revenue and replay value
**Entry:** A hosts a Talk; B listens and taps Gift or Sponsor an eligible AI Seat.
**Path:** server catalog offers exact gift/Seat amount, fresh confirmation; B approves; ledger commits once; Talk overlays and Activity show settlement; AI may acknowledge genuine confirmed event naturally and without speaking sensitive private balance. A ends Talk, replay publishes only if storage/rights qualify, and earnings show distinct pending vs available with correct Host/Twin owner/platform share. A can view real earnings and qualified payout.
**Expected:** no free human Seat charge; no paying just to select a participant; Host approves sponsor; no fictitious gift animation/AI thank you/revenue on provider pending; replay failures honest; no automatic payout for unqualified views. **Evidence:** multi-device Talk, provider/ledger concurrent idempotency, audio/replay, settlement and receipt tests, R06/R09/R10/R13/R16; GJ-04–GJ-09.

## J06 — A manages a Twin/Expert in the dedicated Agents tab
**Entry:** **Agents** tab, Masanawa Agents and Twins visible alongside search/filters, not hidden in Chats.
**Path:** browse all 17 approved server-projected Expert identities with genuine availability; open profile/private Expert chat separate from Assistant, inspect seat price; start owner Twin setup with optional minimal structured fields and conversational voice interview, edit/test owner Twin, direct owned Twin privately while in a Talk, or hire external Twin via explicit Host/Seat authorization.
**Expected:** persona voice/identity preserved (Gwani Bodi, Gwana Sulafat where supported), no invented names; no automatic paid Seat or public Talk; My Twin owner rights/earnings correct; non-owner cannot Direct Twin. **Evidence:** catalog vs actual configured profiles, roles, QA recordings, admission/Host authorization, event privacy and pricing/ledger receipts; R03/R04/R19/C08.

## J07 — One Gwani/Gwana conversation operates the app
**Entry:** **Assistant center** opens a private chat with Gwani, user can switch to Gwana **inside header**.
**Path:** ask Gwani to find person/B, draft “join tonight's Talk”; review exact recipient and editable message, authorize sending. Switch to Gwana in same chat, ask to manage A's own Talk / explain recent gift / open wallet; switch back to Gwani while preserving attributed conversation, draft, current task pointer. Open Assistant as a contextual sheet while privately listening to a public Talk, then return to same public audio role.
**Expected:** same actual task registry and server auth regardless of voice/typed/taps; no hidden second operator conversation, no unsolicited contact scanning/private DM dumps, no artificial completed action or payment; persona switch cannot approve a stale quote. A non-Host cannot ask Gwani to accept their free Seat. **Evidence:** scoped tools/action ledger/deliveries, state restore, server security, Flutter switch widgets, LiveKit/Gemini routing; C07/R04/R17/R19.

## J08 — Pay qualified bills without reading or forced forms
**Entry:** **Wallet → Data** or **Assistant** spoken “Buy data for my mother” (equivalent text/tap option).
**Path:** intent already selected; resolve/clarify recipient, region/provider/plan and exact spend amount only when missing. Pin displayed options/version so “second one” is stable. Server returns validated quote and user hears recipient/price/fees/expiry; explicit authorization, qualified payment/funding path; if insufficient funds persist **one** funding continuation. Real success returns receipt/reference/token where applicable.
**Expected:** Nigerian Flutterwave airtime/data/electricity/TV each proven separately before advertising; error/timeout/webhook delay/restart triggers same operation reconciliation, not duplicate charge; refund/unknown/pending displayed honestly. No financial terms spoken into active public Talk, no 12-second chat polling needed to invent a successful outcome. **Evidence:** every supported billing family on actual qualified account, voice-only & silent-only, DB/provider callback loss and replay, R05–R07/C07.

## J09 — Internal crypto feels like a simple in-app transfer, with actual custody
**Entry:** A in a DM with B taps **Transfer**, in Wallet selects **Send crypto to Masanawa user**, or says/types “Gwana, send B five USDT.”
**Path:** server resolves **verified exact B account** and available custody-backed asset+network; quotes fees/expiry/limits; if account/asset/network uncertain, asks before financial authorization. User reviews/hears exact terms and explicitly confirms (secure reauth if required). Exactly one atomic balanced A debit + B credit occurs; sender/receiver each get receipt, accurate balance/history; user returns to the same DM or Wallet.
**Expected:** DM text send never transfers; internal book transfer ≠ external blockchain transaction; failed or unknown status and double-tap/retry must reconcile without double debit; freeze/AML/region/no custody balances lead to clear nonexecution. For external withdrawal, paste/QR/trusted destination/network and irreversible warning, never long address guessed by speech. **Evidence:** concurrent DB isolation tests, idempotency, exact units and quote expiry, provider eligibility, account A/B ledger/receipt view, controlled allowed value testing only; R06/R08/C06/C07.

## J10 — App and history feel light on an inexpensive Android phone
**Entry:** A has long history and returns after closing the app while the network is offline or limited.
**Path:** app renders meaningful shell quickly without awaiting AI catalog/wallet/provider startup; tapping **Chats** displays encrypted/protected cached recent list and a cached thread; older history lazy paginates 30–50 at a time; offline draft is visibly pending; reconnect delta sync resolves ordering, tombstones and unread without duplicate sends. Profile image, five labels, keyboard, large fonts and RTL work. Notification deep links after sign-in target the actual authorized conversation, receipt or Talk.
**Expected:** no manual restore workflow; server history persists; 1,000 conversations/100k messages benchmark bounded memory/data/frames, warm list <1s p95 and thread <500ms p95 **measured**, not promised; account switch/logout revokes cache. Old routes `/home`, `/chats`, `/chat/:characterId` still mean their historical types and never leak person DMs or lose source screen on Back. **Evidence:** named low-end handset/OS/build, offline/cold/warm p50/p95, bytes/disk/memory, screen-reader/RTL and profile persistence, C03/C05/C08/R11/R16/R17/R18.

## J11 — Public/private isolation and complete recovery across boundaries
**Entry:** A is hosting/listening to a **public Talk** and accesses private Assistant, direct chat, Wallet quote, Direct Twin and account settings.
**Path:** deliberate transitions between public LiveKit microphone, private native Gemini session and DM voice-note mic; only the intended room hears audio. A cancels or pauses private action and returns; failed financial confirmation and interrupted App continue with exact task/operation reference but cannot reuse stale user consent. A blocks a user or requests deletion: account/session/media/DM/voice recordings follow safe revocation/retention and immutable financial audit obligations. WhatsApp/Telegram links remain private assistant channels and do not expose app DMs/public money.
**Expected:** zero cross-track audio or private statement leaks, no background listening, no model access to other-person content absent explicit narrow authorization, no paid Seat/financial operation while wrong person/permission; truthful offline, no stale push disclosure and no silent deletion claims. **Evidence:** actual Android audio routing under speaker/earpiece/Bluetooth where available, media and websocket membership tests, block/account-switch/deletion review worker, R02/R12/R14/R15/C01/C04/C07/C08.

## Release evidence matrix: do not count simulated success

| Boundary | Minimum proven evidence | Gate owner |
| --- | --- | --- |
| Five-tab shell/routes | Five actual Flutter destinations, correct typed deep links, returns, small Android, no duplicate FAB/voice | R17 + C08 shared integration |
| Human messages | Two real accounts/devices, text/voice, stored history, realtime, catch-up, protected offline cache, auth/block/media | C01–C05 |
| Universal operator | One Gwani/Gwana chat with in-chat switch, voice AND type/tap, real tool action/resume/authorization | C07 + R04/R17/R19 |
| Public Talks | Human Host→listener audio, free Seat, paid verified AI Seat, gifts, replay policy and stage privacy | R02–R04/R09/R10/R13/R15 |
| Wallet | Exact separate balances, four bill families, eligible crypto ops/internal transfer, once-only ledger + receipts | R05–R08 + C06 |
| Trust/quality | International/low-literacy/RTL/accessibility, profile edit, deletion, Play/push/signing and low-end metrics | R01/R11–R18 |
| CI/operations | Real executed CI jobs, migration/audit, builds and deployments tied to SHAs, real credential/hardware blockers | #457/R16 integration |

**Stopping condition:** the feature is NOT DONE if one of its required API/DB, Flutter, spoken, silent, error/recovery, privacy, external/provider or real-device gates lacks evidence. Tests that never executed are **UNVERIFIED**. The final architecture is fixed up front; if a new proposal is truly necessary, document its interaction with **all five destinations** before merging code that would force another navigation redesign.

## Handoff for multi-window owners

1. Begin from `CONTINUE-HERE.md` and the canonical docs/active claims. Link relevant owner requirement IDs and J journey IDs in your PR.
2. Claim only nonoverlapping files; coordinate R17/C08 shared router and C06/R06/R08 financial ledger, C02/C03 migrations/push, R02/C04 audio, C07 assistant task authority. Five-minute repository-visible lease still applies.
3. For each claimed J path, document **entry → real service effect → feedback/receipt → failure/recovery → Back** and the actual tests/build/device/deployed SHAs. Do not invent screens, grant authority by client navigation, or rename an approved tab.
4. Product design and documentation from this review must be merged and read **before** competing windows invent their own navigation/action state. Provider/live configuration, device verification, and CI #457 remain separate blockers.

