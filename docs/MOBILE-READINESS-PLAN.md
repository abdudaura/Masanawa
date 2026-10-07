# Mobile Readiness and Global Integration Plan

Status: **canonical implementation ledger — 2026-10-08 (Africa/Lagos)**
Owner: each task must be claimed through `MULTI-WINDOW-WORK.md`.
This is the current improvement plan, not a declaration that the work is complete.

## 1. Locked requirements

Masanawa remains a human-hosted live AI conversation network with **Home · Create ·
Activity · You**, vertical Explore/Live Talks feeds, free human Seats, and limited paid
Expert/Twin Seats. Billing and Crypto are the only standalone service families.
Keep one adaptive Talk screen and compact sheets; do not add utility dashboards.

The new requirements are:
- WhatsApp-style **white light surfaces and vibrant green** throughout; light is the
  default even when the device is dark. Preserve the approved Masanawa logo.
- Available, fully profiled server-managed AI personas; a topic must lead to usable
  human audio and, when explicitly selected/authorized, a responding AI participant.
- Every exposed action works or gives a clear eligibility reason and recovery action.
- Animated, interactive gifts and agent awareness of authorized audience participation.
- Global wallet architecture and localization; Nigeria is a supported market, not the
  definition of the platform.
- Fully integrated, privately confirmed Billing/Crypto with durable recovery.
- Account deletion, privacy, safety, notifications, replay and release acceptance.

## 2. Recovered evidence, not assumptions

Baseline main: `f990af2ad782a64ef25a0acdedc69b9791054e27`, PR #400.
All 310 mobile tests passed during the previous build; APK 1.0.1+2 was test-signed.
That build does not establish live transaction, AI participation or handset acceptance.
Current main Actions runs 37701204232 and 37701204192 failed before runner allocation
(`runner_id=0`, empty steps); do not describe those as application test failures.

| Evidence | State and consequence |
| --- | --- |
| User created a topic and sees Audio unavailable | Reported production blocker; root cause UNVERIFIED. Diagnose authenticated join, grants, microphone, room and runtime separately. |
| Create router passes only onCreated | CONFIRMED wiring gap: Add Expert, Invite person, Add My Twin callbacks are absent. |
| Default platform bootstrap seeds two support identities and returns when support profiles already exist | PARTIAL; does not prove an available Talk Expert roster. Recover existing identities and add missing roles without overwriting admin edits. |
| Persona audio runtime includes name/role/bio and dynamic spoken language | PARTIAL context; complete topic, stage, event and refreshed authority inputs. Gwani bootstrap voice Bodi differs from runtime fallback Charon; qualify one canonical profile voice. |
| Main wallet route omits Add Money/Send/Withdraw callbacks | CONFIRMED inactive actions; wire qualified capabilities. |
| NGN balance is loaded but main wallet shows Credits/earnings | CONFIRMED hidden balance; global balances require explicit separation. |
| Funding webhook returns early when funding already credited | CONFIRMED recovery hole after credit but before bill execution. |
| Mobile bill history restores quote, not funding; refresh leaves funding state unchanged | CONFIRMED restoration/stale instruction gap. |
| Shortfall confirmation creates new funding references without service-level reuse | PARTIAL funding idempotency; verify DB invariants and reuse one quote-scoped intent. |
| All webhook exceptions return invalid_webhook/401 | CONFIRMED error classification gap; distinguish unauthorized from retriable processing errors. |
| Reconciliation exists on reads; reviewed default worker has no billing sweep composition | PARTIAL; qualify durable unattended reconciliation, not just manual refresh. |
| Flutterwave catalog previously returned 12 categories | Connectivity evidence only; four-family fulfillment/refund qualification remains UNVERIFIED. |
| Railway lacks NOWPAYMENTS_PAYOUT_2FA_READY and NOWPAYMENTS_PAYOUT_FEE_MODE | BLOCKED withdrawal composition; credentials alone do not enable safe payouts. |
| Railway lacks all five MASANAWA_TALK_REPLAY_S3_* values | BLOCKED recording/object-store composition. |
| Railway lacks MASANAWA_FIREBASE_SERVICE_ACCOUNT_JSON; APK omitted FIREBASE_* defines | BLOCKED remote push on this APK. |

Configuration evidence was names-only on 2026-10-07 UTC. Recheck before operational
changes; never treat a configured/sealed credential as missing because it is unreadable.

## 3. Ordered implementation ledger

Statuses: **OPEN** needs work; **PARTIAL** exists but incomplete; **BLOCKED** needs a
specific external dependency; **UNVERIFIED** lacks relevant evidence. Move to DONE only
after the acceptance below and evidence for code/build/deployment/device separately.
Dependencies are integration order, not permission to reserve overlapping files.

| ID / priority | Scope and current state | Acceptance / dependency |
| --- | --- | --- |
| R01 / P0 | Global light theme — OPEN | White default on every normal surface, vibrant green, readable buttons, status/navigation bars and all sheets; screenshot/device matrix. |
| R02 / P0 | Live audio failure — UNVERIFIED root cause | A signed-in Host creates a Talk, joins, unmutes and is heard by a second device; admitted human and AI audio work; permission/network retry preserves identity. |
| R03 / P0 | Default personas — PARTIAL | Server catalog contains enabled canonical profiles; picker/search shows real availability; one selected persona joins, identifies its role and responds audibly. See DEFAULT-AI-PERSONAS.md. |
| R04 / P0 | Create/Host action wiring — PARTIAL | Add Expert, Invite person and Add My Twin work before and during Talk; selected participants survive creation/restart; free human invitation and explicit AI quote/confirmation enforced. Depends R02/R03. |
| R05 / P0 | Billing funding/recovery — PARTIAL | Quote-scoped funding reuse, restored bank details, one credit/fulfillment after crash or duplicate callback, typed webhook failures, unattended retries and correct receipt. |
| R06 / P0 | Global wallet and qualified actions — PARTIAL | Currency-aware API/projection/UI, visible native balances, Add Money/Send/Withdraw based on capabilities; no Credits/earnings/crypto mixing. Shared ledger contract lands before dependent UI. |
| R07 / P0 | Billing live qualification — UNVERIFIED | Airtime/data/electricity/TV qualification including validation, amount/fee, delivery, receipt, failure/refund and lost webhook; exact market coverage. Depends R05/R06. |
| R08 / P0 | Crypto operations — PARTIAL/BLOCKED | Qualified deposit/buy/convert/withdraw by asset/network/region; custody/payout/2FA/fees/relay/IPN and reconciliation proven; unsupported capabilities honestly explained. Depends R06. |
| R09 / P1 | AI stage/event context — PARTIAL | All permitted reaction/hand/question/seat/gift/poll/comment events observable in bounded context; correct identity/role/topic; private data isolated; no automatic audio from spam. |
| R10 / P1 | Animated gifts — PARTIAL | Catalog preview, explicit price, idempotent settlement, synchronized sender/recipient/stage animation and AI event only on authoritative result; reduced-motion/low-end-device support. Depends R06/R09. |
| R11 / P1 | Language/localization — OPEN | Locale resources, translated UI/errors/receipts, RTL and local formatting; conversational code-switching independent of UI language; no fixed en/ha restriction. |
| R12 / P1 | Account deletion/privacy — OPEN, inventory needed | Settings and working external request page; reauthentication, durable deletion, session/channel revocation, provider cleanup and disclosed retention; no client-only pretend deletion. |
| R13 / P1 | Recording/replay — BLOCKED | Storage/egress qualified; ended permitted Talk produces authorized playable replay; publication, failure and deletion policy tested. |
| R14 / P1 | Remote notifications/activity — BLOCKED/PARTIAL | Matching Firebase client/server setup, token refresh, permission, background/foreground delivery, deep links and dedupe; private amounts excluded from public/lock-screen content by default. |
| R15 / P1 | Safety/support/channel journeys — UNVERIFIED completeness | Report/block/mute and platform enforcement across live/discovery/replay; in-app AI feedback/report path; private WhatsApp/Telegram linking, unlinking and private receipts qualified. |
| R16 / P1 | Global release qualification — OPEN | Secure production signing/AAB and versioning, launch matrix, store declarations/payment classification, logs/alerts/recovery jobs and exact deploy evidence; remaining device dependencies explicit. |

Start R01 first per the user, while a separately claimed non-overlapping backend lane
diagnoses R02/R03 and a financial lane fixes R05. No financial execution is required to
write code/tests; controlled real-value qualification requires explicit test authorization.
R02–R08 block the next claim that core live/services are complete. R09–R16 are release
requirements, not optional polish. Store-policy work must precede Play monetization release.

## 4. Theme acceptance (R01)

Use shared semantic tokens, keeping package/mobile parity. Proposed palette:
- app bars, scaffold, sheets, wallet/billing/crypto/settings: `#FFFFFF`;
- primary vibrant green accent: `#25D366`;
- primary text: `#111B21`; secondary text: `#667781`;
- pale green selection/messages: `#D9FDD3`; subtle dividers: `#E9EDEF`.

Bright green buttons use dark readable text; choose a contrast-tested stronger green
when white text is necessary. Do not simply lighten the scaffold while cards, dialogs,
audio screen, keyboard chrome or system bars remain dark. Default must not follow OS dark
brightness into an unrequested dark surface. Any retained dark preference is explicit
opt-in, not the default. Preserve compact WhatsApp-like spacing and touch targets.
Test text scaling, contrast, focus, loading/disabled/error and reduced-motion states.
No new logo or root navigation redesign.

## 5. Audio and participant readiness (R02–R04)

Trace: session -> owned Talk -> authenticated join -> LiveKit token/room/grant ->
microphone permission/device publication -> subscriber playback -> admitted AI Seat ->
named dispatch -> persona resolution -> Gemini audio -> returned audible track.

Expose connecting/live/reconnecting/muted/permission-denied/unavailable states with
short useful recovery actions, not one generic Audio unavailable. Preserve diagnostic
request IDs in logs, without credentials or financial data. Check model/voice support,
worker deployment, participant metadata and server publish grant; worker registration
alone does not prove audio. A Human Host never depends on an AI being present to speak.

Participant selection is draft state in Create: choose an Expert, invite a person, or
choose owned Twin; preserve topic while sheets open/close. Quote/charge AI participation
only at the appropriate explicit confirmed admission step. Do not invent a Talk ID or
charge merely for selecting a draft participant. Live invitations use a deep link/free
human admission flow. No owned Twin means a working create-Twin entry that returns to
the draft; unavailable experts have a retry/explanation, never inert rows.

No automatic paid AI selection. The default Gwani suggestion is selectable; trials or
test credits are server policy with clear eligibility, not a hidden charge or fee bypass.

## 6. Audience events and lively gifts (R09/R10)

Create one authorized, bounded event-to-context adapter reusing canonical events/outbox,
not a second financial ledger or disconnected mobile animation bus. Each event includes
event ID, Talk ID, type, actor/public name, target, time, visibility and minimal approved
payload. Order/dedupe by authority; refresh after reconnect; never trust arbitrary client
gift amounts, membership claims or system-role text.

| Event | What agents may observe | What must not happen |
| --- | --- | --- |
| React | Aggregated type/count/recent public actor where allowed | A model call or interruption for every tap |
| Raise hand | Pending/withdrawn/accepted/declined status | AI admits a human or overrides Host decision |
| Ask | Approved public question, author and answer state | Private draft or rejected question leaked |
| Add Expert/Twin/sponsor/invite | Authorized request/admission/departure/decline and participant roles | Payment grants Host authority or pending Seat speaks |
| Gift | Confirmed public gift ID/type/recipient; permitted sender display | Optimistic UI treated as settlement; private wallet balance disclosed |
| Poll/vote | Approved aggregate/current question/result | Private ballot choice attributed without consent |
| Public comments/chat | Moderated, bounded relevant excerpts as untrusted conversation data | Every comment spoken, prompt instructions obeyed, or private chat included |
| Direct Twin | Owner-authorized ephemeral instruction for that Twin only | Instruction exposed to other seats/audience or persisted as public speech |

Awareness does not require speaking: agents can acknowledge at a natural turn, summarize
reaction bursts, or answer a Host-selected question. Hold output when human Host absent;
respect mute/remove, turn budget and barge-in. Test event storms, duplicate replay,
malicious prompt text, blocked actors and old events after reconnect.

Gift catalog is server-defined (stable ID, localized name, artwork/animation, exact
Credits price and availability). Proposed launch visuals: applause, heart, flower,
spark/star, crown and celebration. Asset pricing is configurable, not invented by the
client. Animate short stage overlays and receipt feedback after confirmed settlement;
queue/aggregate bursts, cap GPU/memory, provide optional haptics and reduced-motion/static
fallback. Failed gifts show recoverable status with no false earnings or AI thanks.
Do not interrupt audio, obscure controls, autoplay unwanted sounds or reward spam.

## 7. Global wallet, Billing and Crypto (R05–R08)

Extend existing canonical wallet/ledger/provider interfaces rather than build another
wallet. Money is native currency/asset plus exact units and precision; fiat uses ISO
currency metadata, crypto uses asset+network precision. No floating-point money, naive
two-decimal assumption, hardcoded NGN total, or silent conversion.

One wallet shows fiat balances where supported, spendable Masanawa Credits, creator
pending/available earnings and asset/network crypto separately. Preferred display
currency is optional convenience: converted estimates include source/rate/time and
never become spendable native balance. Funding/withdrawal currencies, countries, rails,
identity requirements, limits and fees come from server-qualified capabilities.
NGN stays the currently implemented Nigerian billing adapter, not the universal wallet.
Do not rename existing NGN ledger rows or enable fabricated currencies; migrate additive
contracts first, preserve historical amounts and make unsupported rails explicit.

Billing adapts to country/provider/catalog/recipient format. Nigeria's airtime/data/
electricity/TV remain a priority and must work fully; other markets only appear as
available after account/provider qualification. International phone validation and
region selection must not be inferred from UI language or require a Nigerian number.
Flutterwave remains the planned billing provider, subject to real coverage.

Every flow has server quote, expiry, exact native amount+fees, explicit confirmation,
idempotent execution, ledger evidence, unknown/pending state, automatic reconciliation,
receipt/refund and support reference. Reuse one pending quote-scoped funding intent;
atomically persist continuation, recover after credit-before-execute crash, restore
instructions, and remove them at terminal state. Test repeats, concurrency, late/partial/
excess transfers, expired quotes, timeout before provider acknowledgement and refunds.

Crypto remains NOWPayments, exact network/operation/account eligibility, low-fee policy
excluding expensive Ethereum-mainnet ERC-20. Qualify custody, conversion, fiat buy,
payout 2FA, fee mode, destination allowlist/approval, fixed egress, signatures/IPN,
batch reconciliation and account-specific limits. Withdrawal destination is confirmed
with network and irreversible-transfer warning; never enable by setting an evidence
flag without proving the underlying capability. Privately display final receipt and
return to Talk without announcing balances, addresses or bill account numbers.

## 8. Languages and international UX (R11)

Separate UI locale, conversational language and financial jurisdiction/currency.
Use device locale with manual override; no forced language during Twin interview.
Launch translation proposal: English, Hausa, Arabic, French, Spanish and Portuguese;
add further locales through the same resource/locale infrastructure. This is a planned
initial set, not a claim all translations or model languages are qualified.
Agents follow current speaker and code-switch naturally in any model-supported language;
if uncertain, ask briefly rather than force English/Hausa. UI translation does not gate
conversation language. Verify voice quality and error fallback per language.

Localize visible strings, dates/timezones, number/currency, OTP errors, permissions,
quotes, receipts and support. Support Arabic RTL, mixed-script names, long text and
screen readers. Store server UTC/locale-neutral values and format at the edge.
Never translate IDs, token/address strings or provider-confirmed names destructively.

## 9. Account deletion and critical trust (R12/R15)

Settings -> Account -> Delete account opens a concise explanation and secure recent
reauthentication. Provide a working external Masanawa-branded deletion request page
linked in Play Console, usable without reinstalling. Accept and track the request even
when balances or pending settlements need a separate resolution step; give instructions
and support, never silently confiscate funds or block requests indefinitely.

Use a durable, idempotent server deletion workflow with progress/failure recovery.
Revoke sessions, tokens, device push and channel links; stop Twin availability/new Seat
sales and private memory/inference; remove/anonymize profile, Twin/training, private
chats/files and other associated data according to disclosed policy. Reconcile pending
payments/earnings/refunds and define treatment of shared public Talks/replays/comments.
Propagate deletion to relevant processors where applicable. Minimal records retained
for documented security/regulatory obligations stay restricted and are disclosed with
purpose/duration; do not erase or corrupt required financial audit ledgers.

Inventory existing deletion/memory lifecycle code before implementing. Test unauthorized
attempt, repeat request, provider cleanup failure, interrupted job, session revocation,
published content references and safe balance resolution. A logout or hidden profile is
not account deletion. Also verify privacy policy/Data safety, recording consent,
report/block/mute, age-related handling, AI-content reporting and support escalation.

Official reference checked 2026-10-07 UTC:
[Google Play account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).
The in-app and external request paths and disclosed retention are release gates.

## 10. Release and completion evidence (R13/R14/R16)

Configure replay storage/LiveKit egress and verify authorized live-to-ended playback.
Configure matching Firebase server credentials and public client build options; rotate
tokens and keep lock-screen private content protected. Secrets stay on servers.

Use a production signing key/AAB for Play, distinct from test-signed APK delivery.
Classify digital AI Seat/Credit/animated gift purchases under current Play Payments
rules separately from utility bill payment and crypto rails. Do not assume the same
Flutterwave checkout is valid for every purchase. Record applicable regional program
eligibility and implement approved billing/receipt verification/refund/revocation rules.
Reference:
[Google Play Payments](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en).
This is a release review task, not a claim that the existing gifts automatically qualify
as exempt donations. Verify financial features/crypto declarations for target markets.

Minimum acceptance matrix:
- new/returning/logged-out/deletion-pending account;
- Host, free Speaker, Audience, Twin owner and sponsored AI roles;
- create/invite/hand/ask/react/poll/comment/gift/add/remove/end, with stage+AI+Activity convergence;
- microphone denied/allowed, background/resume, low connectivity and reconnect;
- hold/confirm/decline/expire/refund, duplicate/concurrent action and server restart;
- four Nigerian bill families plus each advertised extra market/rail;
- each advertised crypto asset/network/operation, IPN outage and payout uncertainty;
- white/green screenshots, text scaling, reduced motion, RTL and chosen locales;
- notification/deep link, recording/replay access, report/block and account deletion.

Track each feature as: implemented SHA, focused test evidence, build SHA/artifact,
deployed SHA/config qualification, handset acceptance and remaining blockers.
A merged PR, empty catalog, registered worker or passing mock is not full integration.
Preserve a working app while qualifying capabilities; no dead controls or fake success.

## 11. Continuation and task ownership

Read CONTINUE-HERE.md and MULTI-WINDOW-WORK.md, then canonical contracts, this plan and
DEFAULT-AI-PERSONAS.md. Inspect main, current PRs/claims and fresh runtime evidence.
Claim exact paths for one R-task/subtask, follow the five-minute lease, and coordinate
shared router/Gateway/ledger/migrations/events/tokens before edits. Useful lane mapping:
R01 mobile-shell; R02 talks-live; R03/R04 talks-ai-seats; R05/R07 bills-flutterwave;
R06 commerce-core; R08 crypto-nowpayments; R09/R10 talks-social; R11 mobile-shell;
R12 identity/security plus integration; R13 talks-replay; R14/R16 integration;
R15 talks-live/channels. This plan does not claim those implementation paths.

Update the relevant row and workstream with honest evidence after each implementation.
Do not restart previously merged foundations or mark unresolved external gates complete.
First next task: claim R01 and implement shared light defaults/tokens before editing
individual screens; independently diagnose the authenticated audio failure R02.
