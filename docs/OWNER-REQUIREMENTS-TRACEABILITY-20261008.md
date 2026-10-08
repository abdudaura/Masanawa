# Owner Decisions and Feature-Coverage Traceability — 2026-10-08

## OWNER CLARIFICATION — Contact screen is essential; optional phonebook display (2026-10-08)

The owner now explicitly requires a **WhatsApp-like Contacts experience**, not merely exact-handle lookup or a New Message button. Chats→New message must open nested Contacts including accepted people, requests, Favorites/search, per-person Message/profile and real server-authorized C02 conversation. Optional device-local address-book display and system invitation may be offered **only with explicit OS/user consent**, usable even when no registered match exists; no bulk cloud import or naive phone hash upload without separate approved privacy/security matching design. Existing M01/M05/N02 and C01–C05 remain mandatory, M11's earlier unapproved contact-book details are now *partially superseded* by this narrower owner choice, while **E2EE/groups/direct calls stay unapproved**. Read [full Contacts behavior](CONTACTS-AND-ADDRESS-BOOK-EXPERIENCE-20261008.md), [all R/C source gaps](UNFINISHED-SCOPE-RECONCILIATION-20261008.md), [new U21–U30/F01–F18 owners](ADDITIONAL-U21-U30-AND-FOUNDATION-F01-F18-20261008.md). Eight additional K13–K20 golden journeys test this, not merely a contacts screenshot.


## Owner-approved U01–U20 expansion — 2026-10-08

Owner adds permissioned Gwani/Gwana full product operation, verified task readback, opt-in inspectable memory, real teaching/files, premium human Chat basics and strictly selected-message AI, Host copilot, Twins and accessibility. Original 77 requirement IDs, J01–J11 and R/C obligations remain; K01–K12 are additive acceptance journeys. Groups/calls/E2EE remain unapproved. See [AI-first product](AI-FIRST-PRODUCT-AND-HUMAN-COMMUNICATION-20261008.md), [operator contract](AI-OPERATOR-ACTION-AND-TASK-CONTRACT-V1-20261008.md), [human chats](HUMAN-CHAT-AND-CONTEXTUAL-AI-CONTRACT-20261008.md), [U01–U20](20-WINDOW-AI-CHAT-EXECUTION-20261008.md).


**Authority:** A traceability overlay for the **owner-approved** Masanawa product, not a replacement for the canonical product, security or R/C implementation ledgers. Derived from the owner's 7–8 October discussion, the then-current canonical docs on `main`, and the #462/#463 product discussions. **Documentation coverage is not implementation or release acceptance.**

## 0. Why this exists and how to use it

The owner explicitly rejected implementing one UI "for now" and redesigning it later, fake/non-functional features, lost prior requirements and superficial testing. All windows must target **one complete, consistent end-state**. Every new code claim should refer to the requirement IDs below, map them to **R01–R19 and/or C01–C08**, link actual code/API/tests, and report **IMPLEMENTED / TESTED / INTEGRATED / DEPLOYED / DEVICE-VERIFIED / BLOCKED** independently. **Do not create a second competing backlog or mark an R/C item DONE from these rows.**

**Decision labels:** **LOCKED** = explicit owner decision or established current canonical product rule; **QUALIFIED** = desired feature whose operation depends on provider, actual identity/security/regulatory availability or platform capabilities; **PROPOSED / UNDECIDED** = never silently promote to a shipping commitment. Traceability means the requirement is written, **not** that running code satisfies it. If a later decision changes a row, update this ledger and affected contracts in one reviewable PR.

**Canonical cross-references:** `APP-SHELL-CONTRACT.md` (NAV), `END-TO-END-UX-ARCHITECTURE.md` (FLOW), `PRODUCT-NORTH-STAR.md` (PRODUCT), `TALKS-PRODUCT.md` (TALKS), `MOBILE-READINESS-PLAN.md` (R), `COMMUNICATIONS-EXTENSION-PLAN.md` (C), `VOICE-FIRST-INTERACTIONS.md` (VOICE), `DEFAULT-AI-PERSONAS.md` (PERSONAS), `CONSUMER-SERVICES.md` (MONEY), `GOLDEN-JOURNEYS.md` (GJ), `MULTI-WINDOW-WORK.md` (OWNERSHIP). See `WHOLE-PRODUCT-ACCEPTANCE-JOURNEYS.md` for the integrated acceptance path.

## 1. Explicit end-user purpose: who gains access

| ID | Product requirement and decision | Canonical implementation gate |
| --- | --- | --- |
| P01 LOCKED | **A voice can be a creator's identity.** Camera-shy people must be able to start, host, share, grow and earn from public **audio** without filming themselves. No camera, avatar upload or written script is required to host a Talk. | PRODUCT/TALKS; R02/R04/R10/R13/R16; J01/J05 |
| P02 LOCKED | A user who cannot read or write can still discover, communicate where qualified, create a Talk and complete supported bill/crypto actions through **spoken language**, while a quiet user can do each same task via text and taps. Voice is priority, **never mandatory**. | VOICE; R04/R06–R08/R11/C07; J02/J07/J08 |
| P03 LOCKED | Familiar compact WhatsApp-like UX: limited meaningful screens, natural conversation, fast return to recent chats, minimal typing/questions, real buttons and states, no fake AI/financial actions. "Advanced" features may not burden simple tasks. | NAV/FLOW; R01/R16/R17/C05/C08; J03/J10 |
| P04 LOCKED | Users may earn through legitimate public Talk/Twin activity, not just consume content. Explain pending vs available earnings and how to withdraw qualified funds. | TALKS/PRODUCT/MONEY; R06/R10/R16; J05 |
| P05 LOCKED | The platform combines **communication + public audio creation + private AI operator + Wallet**; these are connected but remain different authority/privacy domains. No duplicate feature tabs. | NAV/FLOW; R17/C01–C08; J01–J11 |
| P06 QUALIFIED | International service and spoken-language access is the direction, but language does not establish residency, supported fiat rails, crypto network or provider approval. Unsupported capabilities explain exact limits, never pretend success. | VOICE/MONEY; R06–R08/R11/R16/C06; J08 |
| P07 LOCKED | Preserve all recently approved implementation details when improving the architecture; do not delete Talks, creators, Twins, services, safety or existing tested foundations just to add Chats. No disposable intermediate navigation. | OWNERSHIP/NAV; R01–R19 + C01–C08; all J |
| P08 LOCKED | The consumer app must not require a developer token/model key. Consumers authenticate normally; provider and Gemini secrets stay server-side. | R16, app authentication / release, J10 |

## 2. The five bottom destinations and fixed screen placement

**Only approved order (left to right): TALKS · CHATS · ASSISTANT · WALLET · AGENTS**. **ASSISTANT is physically centered at index 2, two tabs on either side.** Former Home is not a sixth destination.

| ID | Exact visible behavior, without overlap | Canonical gate |
| --- | --- | --- |
| N01 LOCKED | **Talks:** previous Home **Explore + Live Talks** in one destination, full-width vertical single-column cards, no horizontal Talk rails/grid; live/replay filters and one prominent **Start Talk** FAB. | NAV/FLOW; R17/C08; J01 |
| N02 LOCKED | **Chats:** people-to-people messages only, list/unread/search, **New message** primary action, profile **Message** entry. No AI-character thread mislabeled human, no wallet send arrow. | NAV/C01–C05/C08; J03/J04 |
| N03 LOCKED | **Assistant (CENTER):** a **single private chat interface** for Gwani **or** Gwana, visible in-chat switch, voice/type/tap. Same scoped user history/drafts/tasks with attributed speaker; no two competing operator screens. | NAV/C07/R17/R19; J07 |
| N04 LOCKED | **Wallet:** easy-to-read native fiat, Credits, crypto balances, available/pending creator earnings, history and real qualified Billing/Crypto shortcuts; crypto first then Data, Airtime, Electricity, TV/Cable. | NAV/MONEY; R05–R08/C06; J08/J09 |
| N05 LOCKED | **Agents:** dedicated Masanawa Agents/Experts and Twins discovery/search, persona profiles/private **persona** conversations, My Twin owner controls and separate paid public Seat invitations. Do not bury Agents under Chats. | NAV/PERSONAS; R03/R04/R19/C08; J06 |
| N06 LOCKED | Root header **Activity bell + profile avatar**; Activity is Talk/social/earnings/platform notice, and Chats owns DM unread badge. Avatar opens editable You/Profile/Settings/My Talks/My Twin/Earnings. | NAV/FLOW; R14/R17/R18/C03; J04/J10 |
| N07 LOCKED | Talk creation button **only on Talks**; New message **only on Chats**. Agent/Wallet/Assistant have contextual actions; no big competing floating buttons or FAB covering mic/keyboard. | NAV/R17/C08; J01/J03 |
| N08 LOCKED | Keep historical routes/deep links functional: `/home` => Talks; `/chats` and `/home?tab=talk` => old private AI/Assistant; `/chat/:characterId` remains an AI character thread; human DMs exclusively `/messages` and `/messages/:conversationId`. New named stable destination IDs, not positional old tab indices. | NAV/FLOW; R17/C08/C03; J10 |
| N09 LOCKED | Back navigation, task/card identity, live audio role, drafts and scroll position survive contextual detours and app restart where applicable. No entering a screen starts a mic or a financial charge. | FLOW/VOICE; R17/C05/C07/C08; J10/J11 |
| N10 LOCKED | All five labels/targets must remain legible/usable on low-cost 320dp-class Android, large fonts, RTL, keyboard and screen readers. No silent removal of fifth tab to solve layout problems. | R01/R11/R16/R17/C05/C08; J10 |

## 3. Public Talks, creator opportunity and AI participants

| ID | Requirement | Gate |
| --- | --- | --- |
| T01 LOCKED | Every **public** live Talk starts with and requires an actually present **human Host**, not autonomous AI-only radio. Host leaves => explicit grace/reconnect then pause/end. | TALKS R02/R04; J01/J11 |
| T02 LOCKED | Voice topic prompt + real **Start Talk → composer → explicit Go Live** flow; selects AI Expert, human invite, My Twin without losing draft; only admitted speakers broadcast. | TALKS R02/R04; J01 |
| T03 LOCKED | Default limits **6 total active Seats, up to 3 AI** as server policy; human speaker Seats **free** and subject to Host admission; Expert/Twin AI Seats limited/paid, sponsor subject to Host approval. No invisible charges. | TALKS/R04/R06; J01/J05/J06 |
| T04 LOCKED | Audio actually works Host→audience and admitted human/AI across two devices; permission denial, mute, reconnect, audio focus, speaker and earpiece behavior have honest recovery. | R02/R03/R16; J01/J11 |
| T05 LOCKED | Public Talk controls include react, Raise Hand, Ask, comments, poll when supported, gift, share, report/block/mute, invite/admit/remove. Visible controls must work or explain eligibility. | TALKS R04/R09/R10/R15; J01/J05 |
| T06 LOCKED | Public AI sees only authorized bounded topic/Host/stage/questions/hand/seat/gift/moderated-comment events; does not leak private DMs, Direct Twin, wallet or generic assistant content; one reaction cannot trigger one costly model turn. | R09/R15; J05/J11 |
| T07 LOCKED | Confirmed server-priced gifts/tips and AI Seat fees; synchronize stage animation, Activity, ledger and owner earnings; false success/thanks forbidden. Reduced motion/weak Android support. | R06/R09/R10; J05 |
| T08 LOCKED | Replays are public/authorized only according to Host/recording/storage permissions; usable after ending, subject to retention/deletion/safety. No fabricated recording when storage blocked. | R13/R15/R16; J05 |
| T09 LOCKED | Creator monetization can involve legitimate gift/tips, AI Seat fees, Twin rentals and configurable revenue splits among Host, Twin owner and platform, actual history and payout state. Never auto-pay merely for generating Talks or fabricate earnings. | PRODUCT/TALKS/R06/R10; J05/J06 |
| T10 LOCKED | A Twin is user-owned, trained with voice-first interview, can be hired into public Talk, owner can **Direct Twin privately** with Host safety preserved. Creating/owning Twin does not auto-publish a Talk. | PERSONAS/TALKS; R03/R04/R19; J06 |
| T11 LOCKED | Discover via people/topics/Talks and follow Hosts; public search distinguishes People, Talks, Masanawa Experts and Twins; public comments ≠ private DMs. | PRODUCT/TALKS; R15/C01/C08; J01/J03 |
| T12 QUALIFIED | Subscriptions/sponsorships/advertising/qualified-attention rewards are longer-term monetization concepts; **not** secretly promoted to first-release functionality or new root Services. | PRODUCT/TALKS/R16; future policy decision |

## 4. Personal Chats: WhatsApp-grade simplicity without unverified promises

| ID | Requirement | Gate |
| --- | --- | --- |
| M01 LOCKED | Human 1:1 private chat by authenticated person/handle; actual Message button on human profile and New message on Chats root; request/consent/block/report/privacy, no forced phonebook import. | C01/C02/R18; J03 |
| M02 LOCKED | Two authenticated people can exchange **text** with honest queued/sending/delivered/read statuses, timestamp, reply and reconnect; retry/restart never duplicates a send. | C02/C03; J03 |
| M03 LOCKED | Private voice notes: hold/record/stop, preview/review before send, bounded upload, playback and retry; denied mic leaves text fully usable; no public LiveKit broadcast. | C04/R02; J04 |
| M04 LOCKED | Attachment entry supports appropriately qualified image/document/file handling with permissions, storage authorization, type/size limits, scanning, lazy preview and deletion rules; do not show an inert menu. | C04/R15; J04 |
| M05 LOCKED | **No manual backup/restore UI requirement**, but message history persists server-side and is fetched on another authorized device. Secure recent local cache opens old conversations quickly on the same device. | C02/C05; J03/J10 |
| M06 LOCKED | Instant local-first list/thread, indexed per-account cache, background delta sync/cursors, lazy older pagination/media, offline visible drafts/outbox, bounded storage, no full-history download at boot. | C03/C05; J10 |
| M07 QUALIFIED | Performance targets: cached list warm p95 <1s and cached thread p95 <500ms on named inexpensive Android; measure cold/warm, frame time, data bytes, 1,000 threads/100,000 old messages rather than claim speed by inspection. | C05/R16; J10 |
| M08 LOCKED | Push/read/unread state, background/resume, direct notification opening, privacy-safe previews, mute; no duplicate DM Activity feed or wrong-account cached private data. | C03/R14; J04/J10 |
| M09 LOCKED | Chat composer compact as WhatsApp: emoji/attachment not crowding text entry, clear mic vs send, keyboard/safe-area/back handling, message retry, voice review; input never transfers crypto silently. | C04/C08/R17; J03/J04/J09 |
| M10 LOCKED | Private message content/media access checks apply to **every** API/websocket/download/search; blocked/revoked/deleted identities cannot access private media by old URL. No blanket export into AI prompts. | C01–C04/R12/R15; J03/J11 |
| M11 PROPOSED / NOT YET APPROVED | Group chats, peer audio/video calls, contact-book sync details, E2EE marketing and device-to-device backup are **not requirements that can be inferred from "like WhatsApp"**. Choose explicit future product/privacy/key contracts if requested; design identity/conversation storage to permit expansion without another bottom-nav redesign. | C02 architecture extensibility; owner decision needed |

## 5. Assistant: real operator work with zero forced typing

| ID | Requirement | Gate |
| --- | --- | --- |
| A01 LOCKED | Exactly **one** main private Assistant chat, user can select Gwani/Gwana from the **chat header**; switching never resets draft/history or silently authorizes an outstanding confirmation. Persona attribution/version persisted. | NAV/C07/R17; J07 |
| A02 LOCKED | Voice-first native realtime Gemini Live for eligible voice, deliberate mic, barge-in, spoken prompts/receipt, disconnected/reconnecting state, supported Hausa and other spoken languages/code switching; **no browser TTS substitute** and no always-on listening. | VOICE/R02/R11/C07; J02/J07 |
| A03 LOCKED | Type instead, buttons and manual interactions are **complete** for every supported assistant action; ability to keep silent in public and still pay bills/message/use crypto. Microphone denial cannot trap users. | VOICE/C07; J02/J08 |
| A04 LOCKED | Gwani/Gwana can, under real scoped tools, **discover/search, explain/teach, draft and send human messages with review, start/manage Talks as owner/Host, find/invite persona/Twin, work with Wallet/Billing/Crypto, transfer eligible assets, assist profile/settings/support, return files and task results**. Never a decorative chatbot disconnected from actual APIs. | C07/R04/R06–R08/R17/R19; J07/J08/J09 |
| A05 LOCKED | Action gateway is one server-authorized typed capability registry/task state machine; quote/recipient/limits/phase/auth, idempotency and immutable receipts. Model guesses never become financial authority. Voice/text/taps produce the **same operation**, not three engines. | VOICE/C07/C06/R05–R08; J08/J09 |
| A06 LOCKED | Natural no-unnecessary-question conversation with compact option/recipient/quote/receipt cards, ordinal selection pinned to current list, Repeat/Slower/Change/Cancel/Explain, and partial task resumes from interruptions. | VOICE/C07; J02/J08 |
| A07 LOCKED | Do not automatically display unreliable/garbled speech transcripts as if the user typed them; show verified structured operation details and AI response, allow correcting misheard amount/contact. | VOICE/R11/C07; J02/J08 |
| A08 LOCKED | Private operator never reads unrelated human DMs, exports secrets, publishes in public Talk or overrides Host admission. Sensitive approval deliberate, scoped and reauthenticated as required; persona switch cannot approve old quote. | VOICE/C07/R12/R15; J07/J11 |
| A09 LOCKED | Distinct AI roles natural, witty and useful, but clearly labeled **AI**; consent-based memory, respectful stop/goodbye, no fabricated experience or manipulative pressure to stay. Gwani male Bodi and Gwana female Sulafat where qualified; preserve approved 17-persona roster in Agents. | PERSONAS/R03/R19; J06/J07 |
| A10 LOCKED | Contextual Ask Assistant from Talks, Chats, Wallet and Agents is same authenticated task/session, returning to origin; private/public microphone/audio/data must actually be isolated on Android. | NAV/VOICE/C07/C08/R02; J07/J11 |
| A11 LOCKED | Normal customer login/OTP/token refresh, never prompt user for developer credentials, Gemini API keys or raw Gateway tokens; text turns still work when Live audio unavailable. | R16/C07; J07/J10 |

## 6. Money should feel approachable, never fictitious

| ID | Requirement | Gate |
| --- | --- | --- |
| W01 LOCKED | **Billing and Crypto only** standalone financial service families; Wallet and Assistant are entry points, not a new third service or duplicate ledger. | MONEY/R05–R08/C06; J08/J09 |
| W02 LOCKED | Fiat by native currency, Masanawa Credits, crypto by asset+network and **pending vs available** creator earnings are separate, exact-unit, properly labeled; no implied universal NGN balance, silent FX or float-based money. | R06/R08; J08/J09 |
| W03 LOCKED | Crypto-first Wallet shortcut, then **Data, Airtime, Electricity, TV/Cable**; read-only balance/history works immediately without model/tool cold-start. | NAV/MONEY/R06/R17; J08 |
| W04 QUALIFIED | Flutterwave Nigeria data/airtime/electricity/TV and actual other qualified markets, exact plan/recipient/provider validation, fresh fee/total quote and confirmed delivery token/receipt. Do not equate catalog listing with fulfillability. | R05/R07; J08 |
| W05 QUALIFIED | NOWPayments eligible **Deposit, Buy, Convert, Withdraw**, exact asset/network/region/account fee, address/QR/saved beneficiary, payout readiness and webhooks. Exclude high-fee Ethereum-mainnet ERC-20 by current policy; no fictional price/token availability. | R08; J09 |
| W06 LOCKED | **Internal Masanawa-user crypto transfer** by resolved account/handle, asset+network, verified custody-backed spendable balance, exact quote/fees/limits, risk checks and fresh approval. Atomic balanced debit/credit once, sender and recipient receipt/history, status/reconcile. | C06/R06/R08; J09 |
| W07 LOCKED | Chat **Transfer** is a contextual initiation into the **same** Wallet/Assistant transaction task, not a message, a separate new ledger, an external blockchain send or an automatically confirmed action. | C06/C07/NAV; J09 |
| W08 LOCKED | Distinguish **internal book transfer** from irreversible **external on-chain withdraw**, with truthful fee/network/speed explanation. Do not promise globally available unregulated fiat remittance or exchange. | C06/R08; J09 |
| W09 LOCKED | Any money action via voice, text or tap: quote identity/expiry, exact name/account, amount, network, fees, irreversible warning where relevant, explicit approved confirmation, idempotency, pending/unknown/reconcile/refund and receipt. A vague background "yes" is not approval. | VOICE/R05–R08/C06/C07; J08/J09 |
| W10 LOCKED | Funding shortfall keeps one quote-scoped intent and verified deposit/funding continuation across crash/webhook replay; no duplicate payout/purchase just because app resumed. | R05/R07; J08 |
| W11 LOCKED | Voice must read enough meaningful terms for a nonreader to approve safely; never require dictation of a long address, use trusted saved receiver/QR/paste or accessible alternate confirmation. Text/taps complete when speech inappropriate. | VOICE/R06–R08/C06; J02/J09 |
| W12 LOCKED | Earnings and withdrawals based on actual finalized balances, payout eligibility, fraud/chargeback/fees. Public gifts must not expose private balances on a Talk stage. | R06/R10/R12/R16; J05/J09 |
| W13 QUALIFIED | International ability to transfer value through supported crypto infrastructure is a *goal*, not proof every country's rails, crypto asset, transfer or withdrawal are active. Eligibility and disclosures are server/account/market qualified; all apparent restrictions should be explained accessibly rather than hidden behind impossible forms. | MONEY/R06–R08/C06/R16; J09 |

## 7. Trust, accessibility, quality and delivery: integrated, not afterthoughts

| ID | Requirement | Gate |
| --- | --- | --- |
| Q01 LOCKED | White/light WhatsApp-like visual, **vibrant green**, current approved Masanawa logo, semantic theme tokens and consistent header/nav/card/error state. No unrequested styling reset. | R01/R17; J10 |
| Q02 LOCKED | Fully working profile: upload/replace/crop/remove avatar, name/handle/bio persistence, proper validation/retry and cross-profile/Talk/Agents propagation. | R18/C01; J10 |
| Q03 LOCKED | Dynamic spoken languages, initial UI localization plan, international numbers/currencies, RTL, accessible error/confirmation, large text and screen-reader. Detect/correct mixed-language speech, don't infer identity/country from accent. | R11/C07; J02/J08/J10 |
| Q04 LOCKED | Very low-end/weak-connectivity Android performance, fast first useful frame and previous-conversation opening, incremental startup, lazy media; no expensive polling on every idle chat screen without measured need. | R16/C05; J10 |
| Q05 LOCKED | Session-safe auth, block/report, account deletion in app and external request path, privacy retention and media revocation, without wiping required financial audit evidence. | R12/R15/C01/C02; J11 |
| Q06 LOCKED | Remote push, Activity deep links, unread state, permission handling, replay storage/egress, proper Play signing/payment rules and monitoring all require real qualification, not just code paths. | R13/R14/R16/C03; J05/J10 |
| Q07 LOCKED | WhatsApp/Telegram remain core **private assistance and account-linked channels**, independently permissioned. They do not automatically become publicly controllable Talk stages or read the app's private DMs. | R15/channels; J11 |
| Q08 LOCKED | Use existing accounts, Postgres/session/realtime/event/outbox/AI runtime/financial ledgers; no hardcoded users, crypto balances, catalogs, fake success, client-authoritative transfers or browser TTS replacement. | R/C integration; all J |
| Q09 LOCKED | Multi-window: latest `main`, read canonical docs in order, check claims/PRs, one non-overlapping lane, five-minute repository-visible lease, scoped PR, preserve completed work; shared router/migrations/ledger/CI explicitly owned. | OWNERSHIP; all J |
| Q10 LOCKED | Tests must genuinely execute: unit, authenticated API, DB concurrency, Flutter/widget/build, two independent devices, live provider/handset where authorized; **zero-step GitHub Actions** (#457) is not success or app failure. Keep blocked items OPEN/UNVERIFIED. | R16/C08/#457; all J |
| Q11 LOCKED | Consumer web app remains planned for later as same five functional destinations/shared services, not a new product/backlog overtaking mobile completion. | WEB-APP-PLAN.md; W01–W06 deferred |
| Q12 LOCKED | Explain live mic/recording consent and real payment outcomes honestly; never expose raw stack/credential errors or publicly announce private bills/crypto when switching from a live Talk. | VOICE/R02/R05–R08/R13/R15; J11 |

## 8. Contradictions, missing acceptance and decision log

The following are **not permission to contradict locked requirements**. Record an explicit future decision only when needed:

- **Old bottom bars** (`Home/Agents/Wallet/Talk`, `For You/Live/Create/Activity/You`, conditional Chats root) are superseded. Historical workstreams can retain dates/facts but cannot override the five-tab end state. Prior `/chats` is an AI alias; human messages use `/messages`. **One R17/C08 integrator** owns route migration.
- **"Talk" naming:** a public *Talk* is audio content/stage; **Assistant** is the private Gwani/Gwana chat. Calling both Talk in a current new screen is prohibited.
- **"Chats" naming:** human-only person DMs; AI Experts/Twins discoverable in Agents, Gwani/Gwana in Assistant. Avoid using old AI chat list for human DM storage.
- **Gwani/Gwana switch:** one scoped chat workspace, not one shared model-identity or permission grant. A switch never implicitly approves a pending money action. Do not display unreliable voice transcripts as committed inputs.
- **Transfers:** not part of DM transport. Ledger may settle atomically only after qualified custody and consent. "Crypto feels like banking" refers to user experience, **not** a guaranteed global fiat banking rail, unsupported fiat transfer or fee-free external chain.
- **Earnings:** gifts, AI Seats and Twin rentals are the first concrete sources; subscriptions/sponsorship/advertising and attention programs are future policy, with no speculative earnings shown.
- **Groups and calling:** WhatsApp comparison does *not* approve group chat, direct person voice/video calls or E2EE. Existing DM domain must allow later explicit expansion without replacing the five-tab shell; do not promise/invent UI.
- **Release state:** no approval to mark R or C done due to merged docs or unexecuted CI; every feature must have real deployed/account/device/provider evidence as applicable.
- **Historical conflicting instructions:** `README.md` older Phase 7 ledger, dated R17 workstreams and prior UX snapshots are not current navigation requirements. Source precedence in `docs/README.md` remains mandatory.

## 9. Evidence handoff template (must attach to every R/C implementation claim)

For each trace ID touched, report:
1. **Requirement ID → R/C ID → exact source files + PR/commit SHA**; impacted public/private/finance routes.
2. **API, schema, auth, policy, migration/backfill and recovery**: command, real result and negative access test, not only existence.
3. **UI/interaction**: tap path, full voice-only path where promised, full silent text/tap path, error/empty/loading/restart, accessible Hausa/RTL/large-text where relevant.
4. **Money/media safety**: server quote/operation/signed storage/event sequence, idempotency and expiry, secret-free logs; provider/credential blockers explicitly documented.
5. **Performance**: named handset, version, network/fixtures, p50/p95, warm/cold, cache size, battery/network where available.
6. **Deployment and real two-device acceptance** with exact environment/build SHA, or honest BLOCKED state.
7. **Regression:** back/deep links, Talk→Assistant audio privacy, DM→Wallet→DM return, Gwani↔Gwana draft/action continuity, old user history and notification routing.

**Completeness standard:** every **LOCKED/QUALIFIED** row has a canonical home and a release journey; no ambiguity may be silently decided by a single implementation window. Coverage matrix reviewed ≠ user story implemented.