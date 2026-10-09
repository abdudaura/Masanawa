# Requirements-to-Release Gate Sign-off — 2026-10-08

## OWNER RE-AUDIT — outstanding R/C and Contacts K13–K20 (2026-10-08)

The initial U01–U20/K01–K12 did not explicitly include a full **Contacts / optional on-device addressbook / invitations** acceptance path or assign every older unfinished feature. [Contacts and mandatory K13–K20 tests](CONTACTS-AND-ADDRESS-BOOK-EXPERIENCE-20261008.md) now cover real accepted Masanawa contacts and contact requests, permission-free usage, local-only phonebook with explicit consent, safe invitations, unauthorized person denial, lifecycle deletion and wrong-account privacy, low-end/RTL/phone normalization, and actual contact→DM/Wallet/Assistant ID validation. [All R01–R19/C01–C08 PR recovery ownership](UNFINISHED-SCOPE-RECONCILIATION-20261008.md), [F01–F18 and U21–U30](ADDITIONAL-U21-U30-AND-FOUNDATION-F01-F18-20261008.md) and [79 unchecked old tasks](LEGACY-150-TASK-RECONCILIATION-20261008.md) are the full current backlog crosswalk. Preserve original 77 product trace and J01–J11, without changing statuses or fake release evidence.


## Owner-approved U01–U20 expansion — 2026-10-08

Add K01–K12 verification for universal operator, real product use, consented human DM contextual AI, Task/Study/File persistence, Talk/Twin value and low-end performance. Preserve original 77 P/N/T/M/A/W/Q requirements and J01–J11. Source written is NOT device/provider/DB proof; proactive K12 remains gated until a genuine consented scheduler exists. See [user journeys](AI-FIRST-PRODUCT-AND-HUMAN-COMMUNICATION-20261008.md), [U01–U20 owners](20-WINDOW-AI-CHAT-EXECUTION-20261008.md) and [execution evidence](20-WINDOW-INTEGRATION-AND-ACCEPTANCE-20261008.md).


**DOCUMENTATION COVERAGE SIGN-OFF ONLY — NOT A PRODUCTION RELEASE CERTIFICATION.** The owner-discussion traceability audit on main has **77 distinct requirements**, of which 70 are LOCKED, 6 QUALIFIED and 1 PROPOSED/UNAPPROVED. Each item is mapped to an existing R01–R19 or C01–C08 implementation gate and, where applicable, one of J01–J11 end-to-end journeys.

**How to read:** an entry below means the requirement has been captured, NOT coded, executed, deployed or verified. The full requirement wording and authority are in [OWNER-REQUIREMENTS-TRACEABILITY-20261008.md](OWNER-REQUIREMENTS-TRACEABILITY-20261008.md); the code handoff is [IMPLEMENTATION-KICKOFF-20261008.md](IMPLEMENTATION-KICKOFF-20261008.md).

**Approved mobile bottom navigation: Talks · Chats · Assistant · Wallet · Agents, with Assistant in the center and a single in-chat Gwani/Gwana switch.** All old four-tab roots and any duplicate public/private Talk screen are superseded for planned implementation. This line is product documentation, not evidence that the installed APK uses it.

## Audit questions and outcomes

| Check | Documentation result | Implementation/release state |
| --- | --- | --- |
| Exact five-tab order, Assistant center, old link compatibility | Documented in shell and end-to-end UX contracts | Not validated on real Android |
| Audio-only camera-shy host, genuine public live stages, AI Seats, Twins, gifts, replay and earnings | Mapped to P/T/N and R gates | Requires R02–R04/R06/R09/R10/R13/R19 |
| Human-only DMs, contact consent, media privacy, low-data protected local history without manual restore UI | Mapped to M and C01–C05 | Requires real A/B device, DB and server evidence |
| One Gwani/Gwana switchable Assistant, user-approved operations by voice, text and taps | Mapped to A and C07 | Requires native speech, server tools, recovery and money controls |
| Wallet distinct fiat, Credits, crypto and earnings; qualified Flutterwave/NOWPayments/internal transfer | Mapped to W and C06/R05–R08 | Requires ledger, provider, KYC/market and device evidence |
| Profile, real notifications, safety/deletion, Hausa/international/RTL, Android accessibility and Play | Mapped to Q and R11–R18 | Requires API, Firebase, handset/CI/Play evidence |
| Deprecated Home/Agents/Wallet/private Talk root, conditional 4-tab Chats | Explicitly superseded | Do not implement or ship an interim root |
| Ideas only implied by WhatsApp reference, i.e. groups, person calls, E2EE claim | Explicitly UNAPPROVED | Do not introduce product scope without owner decision |
| Exhaustively inspected every past conversation? | **No** — audited recent 7–8 October owner decisions and canonical documents | Keep new explicit decisions under change control |
| Every Flutter/API/DB/audio/crypto/provider feature verified? | **No** — source/runtime qualification is separate | Keep R/C rows open until real evidence exists |

## Requirement index — documented, not certified

### P — Purpose and inclusive access

| Trace ID / decision class | Concise requirement | Mandatory R/C and J cross-reference |
| --- | --- | --- |
| **P01 LOCKED** | A voice can be a creator's identity. Camera-shy people must be able to start, host, share, grow and earn from public audio without filming themselves.… | PRODUCT/TALKS; R02/R04/R10/R13/R16; J01/J05 |
| **P02 LOCKED** | A user who cannot read or write can still discover, communicate where qualified, create a Talk and complete supported bill/crypto actions through… | VOICE; R04/R06–R08/R11/C07; J02/J07/J08 |
| **P03 LOCKED** | Familiar compact WhatsApp-like UX: limited meaningful screens, natural conversation, fast return to recent chats, minimal typing/questions, real… | NAV/FLOW; R01/R16/R17/C05/C08; J03/J10 |
| **P04 LOCKED** | Users may earn through legitimate public Talk/Twin activity, not just consume content. Explain pending vs available earnings and how to withdraw… | TALKS/PRODUCT/MONEY; R06/R10/R16; J05 |
| **P05 LOCKED** | The platform combines communication + public audio creation + private AI operator + Wallet; these are connected but remain different authority/privacy… | NAV/FLOW; R17/C01–C08; J01–J11 |
| **P06 QUALIFIED** | International service and spoken-language access is the direction, but language does not establish residency, supported fiat rails, crypto network or… | VOICE/MONEY; R06–R08/R11/R16/C06; J08 |
| **P07 LOCKED** | Preserve all recently approved implementation details when improving the architecture; do not delete Talks, creators, Twins, services, safety or… | OWNERSHIP/NAV; R01–R19 + C01–C08; all J |
| **P08 LOCKED** | The consumer app must not require a developer token/model key. Consumers authenticate normally; provider and Gemini secrets stay server-side. | R16, app authentication / release, J10 |

### N — Five-tab navigation

| Trace ID / decision class | Concise requirement | Mandatory R/C and J cross-reference |
| --- | --- | --- |
| **N01 LOCKED** | Talks: previous Home Explore + Live Talks in one destination, full-width vertical single-column cards, no horizontal Talk rails/grid; live/replay… | NAV/FLOW; R17/C08; J01 |
| **N02 LOCKED** | Chats: people-to-people messages only, list/unread/search, New message primary action, profile Message entry. No AI-character thread mislabeled human,… | NAV/C01–C05/C08; J03/J04 |
| **N03 LOCKED** | Assistant (CENTER): a single private chat interface for Gwani or Gwana, visible in-chat switch, voice/type/tap. Same scoped user history/drafts/tasks… | NAV/C07/R17/R19; J07 |
| **N04 LOCKED** | Wallet: easy-to-read native fiat, Credits, crypto balances, available/pending creator earnings, history and real qualified Billing/Crypto shortcuts;… | NAV/MONEY; R05–R08/C06; J08/J09 |
| **N05 LOCKED** | Agents: dedicated Masanawa Agents/Experts and Twins discovery/search, persona profiles/private persona conversations, My Twin owner controls and… | NAV/PERSONAS; R03/R04/R19/C08; J06 |
| **N06 LOCKED** | Root header Activity bell + profile avatar; Activity is Talk/social/earnings/platform notice, and Chats owns DM unread badge. Avatar opens editable… | NAV/FLOW; R14/R17/R18/C03; J04/J10 |
| **N07 LOCKED** | Talk creation button only on Talks; New message only on Chats. Agent/Wallet/Assistant have contextual actions; no big competing floating buttons or… | NAV/R17/C08; J01/J03 |
| **N08 LOCKED** | Keep historical routes/deep links functional: /home => Talks; /chats and /home?tab=talk => old private AI/Assistant; /chat/:characterId remains an AI… | NAV/FLOW; R17/C08/C03; J10 |
| **N09 LOCKED** | Back navigation, task/card identity, live audio role, drafts and scroll position survive contextual detours and app restart where applicable. No… | FLOW/VOICE; R17/C05/C07/C08; J10/J11 |
| **N10 LOCKED** | All five labels/targets must remain legible/usable on low-cost 320dp-class Android, large fonts, RTL, keyboard and screen readers. No silent removal… | R01/R11/R16/R17/C05/C08; J10 |

### T — Public Talks, creator and Twins

| Trace ID / decision class | Concise requirement | Mandatory R/C and J cross-reference |
| --- | --- | --- |
| **T01 LOCKED** | Every public live Talk starts with and requires an actually present human Host, not autonomous AI-only radio. Host leaves => explicit grace/reconnect… | TALKS R02/R04; J01/J11 |
| **T02 LOCKED** | Voice topic prompt + real Start Talk → composer → explicit Go Live flow; selects AI Expert, human invite, My Twin without losing draft; only admitted… | TALKS R02/R04; J01 |
| **T03 LOCKED** | Default limits 6 total active Seats, up to 3 AI as server policy; human speaker Seats free and subject to Host admission; Expert/Twin AI Seats… | TALKS/R04/R06; J01/J05/J06 |
| **T04 LOCKED** | Audio actually works Host→audience and admitted human/AI across two devices; permission denial, mute, reconnect, audio focus, speaker and earpiece… | R02/R03/R16; J01/J11 |
| **T05 LOCKED** | Public Talk controls include react, Raise Hand, Ask, comments, poll when supported, gift, share, report/block/mute, invite/admit/remove. Visible… | TALKS R04/R09/R10/R15; J01/J05 |
| **T06 LOCKED** | Public AI sees only authorized bounded topic/Host/stage/questions/hand/seat/gift/moderated-comment events; does not leak private DMs, Direct Twin,… | R09/R15; J05/J11 |
| **T07 LOCKED** | Confirmed server-priced gifts/tips and AI Seat fees; synchronize stage animation, Activity, ledger and owner earnings; false success/thanks forbidden.… | R06/R09/R10; J05 |
| **T08 LOCKED** | Replays are public/authorized only according to Host/recording/storage permissions; usable after ending, subject to retention/deletion/safety. No… | R13/R15/R16; J05 |
| **T09 LOCKED** | Creator monetization can involve legitimate gift/tips, AI Seat fees, Twin rentals and configurable revenue splits among Host, Twin owner and platform,… | PRODUCT/TALKS/R06/R10; J05/J06 |
| **T10 LOCKED** | A Twin is user-owned, trained with voice-first interview, can be hired into public Talk, owner can Direct Twin privately with Host safety preserved.… | PERSONAS/TALKS; R03/R04/R19; J06 |
| **T11 LOCKED** | Discover via people/topics/Talks and follow Hosts; public search distinguishes People, Talks, Masanawa Experts and Twins; public comments ≠ private DMs. | PRODUCT/TALKS; R15/C01/C08; J01/J03 |
| **T12 QUALIFIED** | Subscriptions/sponsorships/advertising/qualified-attention rewards are longer-term monetization concepts; not secretly promoted to first-release… | PRODUCT/TALKS/R16; future policy decision |

### M — Human Chats, privacy and performance

| Trace ID / decision class | Concise requirement | Mandatory R/C and J cross-reference |
| --- | --- | --- |
| **M01 LOCKED** | Human 1:1 private chat by authenticated person/handle; actual Message button on human profile and New message on Chats root;… | C01/C02/R18; J03 |
| **M02 LOCKED** | Two authenticated people can exchange text with honest queued/sending/delivered/read statuses, timestamp, reply and reconnect; retry/restart never… | C02/C03; J03 |
| **M03 LOCKED** | Private voice notes: hold/record/stop, preview/review before send, bounded upload, playback and retry; denied mic leaves text fully usable; no public… | C04/R02; J04 |
| **M04 LOCKED** | Attachment entry supports appropriately qualified image/document/file handling with permissions, storage authorization, type/size limits, scanning,… | C04/R15; J04 |
| **M05 LOCKED** | No manual backup/restore UI requirement, but message history persists server-side and is fetched on another authorized device. Secure recent local… | C02/C05; J03/J10 |
| **M06 LOCKED** | Instant local-first list/thread, indexed per-account cache, background delta sync/cursors, lazy older pagination/media, offline visible drafts/outbox,… | C03/C05; J10 |
| **M07 QUALIFIED** | Performance targets: cached list warm p95 <1s and cached thread p95 <500ms on named inexpensive Android; measure cold/warm, frame time, data bytes,… | C05/R16; J10 |
| **M08 LOCKED** | Push/read/unread state, background/resume, direct notification opening, privacy-safe previews, mute; no duplicate DM Activity feed or wrong-account… | C03/R14; J04/J10 |
| **M09 LOCKED** | Chat composer compact as WhatsApp: emoji/attachment not crowding text entry, clear mic vs send, keyboard/safe-area/back handling, message retry, voice… | C04/C08/R17; J03/J04/J09 |
| **M10 LOCKED** | Private message content/media access checks apply to every API/websocket/download/search; blocked/revoked/deleted identities cannot access private… | C01–C04/R12/R15; J03/J11 |
| **M11 PROPOSED / NOT YET APPROVED** | Group chats, peer audio/video calls, contact-book sync details, E2EE marketing and device-to-device backup are not requirements that can be inferred… | C02 architecture extensibility; owner decision needed |

### A — Gwani/Gwana and AI actions

| Trace ID / decision class | Concise requirement | Mandatory R/C and J cross-reference |
| --- | --- | --- |
| **A01 LOCKED** | Exactly one main private Assistant chat, user can select Gwani/Gwana from the chat header; switching never resets draft/history or silently authorizes… | NAV/C07/R17; J07 |
| **A02 LOCKED** | Voice-first native realtime Gemini Live for eligible voice, deliberate mic, barge-in, spoken prompts/receipt, disconnected/reconnecting state,… | VOICE/R02/R11/C07; J02/J07 |
| **A03 LOCKED** | Type instead, buttons and manual interactions are complete for every supported assistant action; ability to keep silent in public and still pay… | VOICE/C07; J02/J08 |
| **A04 LOCKED** | Gwani/Gwana can, under real scoped tools, discover/search, explain/teach, draft and send human messages with review, start/manage Talks as owner/Host,… | C07/R04/R06–R08/R17/R19; J07/J08/J09 |
| **A05 LOCKED** | Action gateway is one server-authorized typed capability registry/task state machine; quote/recipient/limits/phase/auth, idempotency and immutable… | VOICE/C07/C06/R05–R08; J08/J09 |
| **A06 LOCKED** | Natural no-unnecessary-question conversation with compact option/recipient/quote/receipt cards, ordinal selection pinned to current list,… | VOICE/C07; J02/J08 |
| **A07 LOCKED** | Do not automatically display unreliable/garbled speech transcripts as if the user typed them; show verified structured operation details and AI… | VOICE/R11/C07; J02/J08 |
| **A08 LOCKED** | Private operator never reads unrelated human DMs, exports secrets, publishes in public Talk or overrides Host admission. Sensitive approval… | VOICE/C07/R12/R15; J07/J11 |
| **A09 LOCKED** | Distinct AI roles natural, witty and useful, but clearly labeled AI; consent-based memory, respectful stop/goodbye, no fabricated experience or… | PERSONAS/R03/R19; J06/J07 |
| **A10 LOCKED** | Contextual Ask Assistant from Talks, Chats, Wallet and Agents is same authenticated task/session, returning to origin; private/public… | NAV/VOICE/C07/C08/R02; J07/J11 |
| **A11 LOCKED** | Normal customer login/OTP/token refresh, never prompt user for developer credentials, Gemini API keys or raw Gateway tokens; text turns still work… | R16/C07; J07/J10 |

### W — Wallet, Billing and Crypto

| Trace ID / decision class | Concise requirement | Mandatory R/C and J cross-reference |
| --- | --- | --- |
| **W01 LOCKED** | Billing and Crypto only standalone financial service families; Wallet and Assistant are entry points, not a new third service or duplicate ledger. | MONEY/R05–R08/C06; J08/J09 |
| **W02 LOCKED** | Fiat by native currency, Masanawa Credits, crypto by asset+network and pending vs available creator earnings are separate, exact-unit, properly… | R06/R08; J08/J09 |
| **W03 LOCKED** | Crypto-first Wallet shortcut, then Data, Airtime, Electricity, TV/Cable; read-only balance/history works immediately without model/tool cold-start. | NAV/MONEY/R06/R17; J08 |
| **W04 QUALIFIED** | Flutterwave Nigeria data/airtime/electricity/TV and actual other qualified markets, exact plan/recipient/provider validation, fresh fee/total quote… | R05/R07; J08 |
| **W05 QUALIFIED** | NOWPayments eligible Deposit, Buy, Convert, Withdraw, exact asset/network/region/account fee, address/QR/saved beneficiary, payout readiness and… | R08; J09 |
| **W06 LOCKED** | Internal Masanawa-user crypto transfer by resolved account/handle, asset+network, verified custody-backed spendable balance, exact quote/fees/limits,… | C06/R06/R08; J09 |
| **W07 LOCKED** | Chat Transfer is a contextual initiation into the same Wallet/Assistant transaction task, not a message, a separate new ledger, an external blockchain… | C06/C07/NAV; J09 |
| **W08 LOCKED** | Distinguish internal book transfer from irreversible external on-chain withdraw, with truthful fee/network/speed explanation. Do not promise globally… | C06/R08; J09 |
| **W09 LOCKED** | Any money action via voice, text or tap: quote identity/expiry, exact name/account, amount, network, fees, irreversible warning where relevant,… | VOICE/R05–R08/C06/C07; J08/J09 |
| **W10 LOCKED** | Funding shortfall keeps one quote-scoped intent and verified deposit/funding continuation across crash/webhook replay; no duplicate payout/purchase… | R05/R07; J08 |
| **W11 LOCKED** | Voice must read enough meaningful terms for a nonreader to approve safely; never require dictation of a long address, use trusted saved… | VOICE/R06–R08/C06; J02/J09 |
| **W12 LOCKED** | Earnings and withdrawals based on actual finalized balances, payout eligibility, fraud/chargeback/fees. Public gifts must not expose private balances… | R06/R10/R12/R16; J05/J09 |
| **W13 QUALIFIED** | International ability to transfer value through supported crypto infrastructure is a *goal*, not proof every country's rails, crypto asset, transfer… | MONEY/R06–R08/C06/R16; J09 |

### Q — Trust, quality, international UX and release

| Trace ID / decision class | Concise requirement | Mandatory R/C and J cross-reference |
| --- | --- | --- |
| **Q01 LOCKED** | White/light WhatsApp-like visual, vibrant green, current approved Masanawa logo, semantic theme tokens and consistent header/nav/card/error state. No… | R01/R17; J10 |
| **Q02 LOCKED** | Fully working profile: upload/replace/crop/remove avatar, name/handle/bio persistence, proper validation/retry and cross-profile/Talk/Agents propagation. | R18/C01; J10 |
| **Q03 LOCKED** | Dynamic spoken languages, initial UI localization plan, international numbers/currencies, RTL, accessible error/confirmation, large text and… | R11/C07; J02/J08/J10 |
| **Q04 LOCKED** | Very low-end/weak-connectivity Android performance, fast first useful frame and previous-conversation opening, incremental startup, lazy media; no… | R16/C05; J10 |
| **Q05 LOCKED** | Session-safe auth, block/report, account deletion in app and external request path, privacy retention and media revocation, without wiping required… | R12/R15/C01/C02; J11 |
| **Q06 LOCKED** | Remote push, Activity deep links, unread state, permission handling, replay storage/egress, proper Play signing/payment rules and monitoring all… | R13/R14/R16/C03; J05/J10 |
| **Q07 LOCKED** | WhatsApp/Telegram remain core private assistance and account-linked channels, independently permissioned. They do not automatically become publicly… | R15/channels; J11 |
| **Q08 LOCKED** | Use existing accounts, Postgres/session/realtime/event/outbox/AI runtime/financial ledgers; no hardcoded users, crypto balances, catalogs, fake… | R/C integration; all J |
| **Q09 LOCKED** | Multi-window: latest main, read canonical docs in order, check claims/PRs, one non-overlapping lane, five-minute repository-visible lease, scoped PR,… | OWNERSHIP; all J |
| **Q10 LOCKED** | Tests must genuinely execute: unit, authenticated API, DB concurrency, Flutter/widget/build, two independent devices, live provider/handset where… | R16/C08/#457; all J |
| **Q11 LOCKED** | Consumer web app remains planned for later as same five functional destinations/shared services, not a new product/backlog overtaking mobile completion. | WEB-APP-PLAN.md; W01–W06 deferred |
| **Q12 LOCKED** | Explain live mic/recording consent and real payment outcomes honestly; never expose raw stack/credential errors or publicly announce private… | VOICE/R02/R05–R08/R13/R15; J11 |

## J01–J11 release gates

| Journey | End-to-end test result that must be demonstrated | Implementation owners |
| --- | --- | --- |
| J01 | Camera-free human Host takes real public audio Talk live and another device hears, rejoins and returns | R02/R04/R17/C08 |
| J02 | Hausa/qualified language voice-only user completes a task, then switches to full silent type/tap path | R11/C07/R16 |
| J03 | Authenticated A/B person DM text, reliable ordered history/restart and blocked-recipient denial | C01/C02/C03/C05 |
| J04 | Voice note/attachment authenticated access, retry/revocation and privacy-safe notifications | C03/C04/R14/R15 |
| J05 | Server-settled gift and priced Seat earns truthful creator share, eligible replay and history | R06/R09/R10/R13 |
| J06 | Experts/Twins directory, owner Twin controls and explicit Host-approved paid AI Seats | R03/R04/R19 |
| J07 | Single Gwani↔Gwana chat retains provenance and executes real permission-scoped tasks once | C07/R17 |
| J08 | Supported bill family quote, voice/tap confirmation, real provider outcome, recovery and receipt | R05/R06/R07 |
| J09 | DM/Wallet/Assistant initiate one custody-backed internal crypto transaction, exact quote, A/B receipts | R06/R08/C06/C07 |
| J10 | Low-end Android correct five tabs, indexed fast/offline history, 100k fixture, old links, accessible profile | R01/R11/R16–R18/C05/C08 |
| J11 | Separate public/private/voice-note audio, account/DM/AI/ledger isolation and deletion/revoke | R02/R12/R15/C01/C04/C07 |

## Every implementation PR must contain actual evidence

1. Requirements IDs above + J journey + R/C claim and exact modified paths/PR/commit SHA; latest main, active claims/branches inspected before editing.
2. Backend/API/contracts/auth/database migration, tenant and membership isolation, race/idempotency and private media/financial access tests; security negatives and recoveries.
3. Flutter/Android voice + silent typed/tap parity where promised, denied mic, loading/empty/failed/reconnect, back/notification state, Hausa/RTL/large-text and actual readable small-screen layout.
4. Executed commands and actual output for TypeScript checks, Vitest, PostgreSQL integration, flutter analyze/test/build, relevant native Android and multi-device service tests; an unexecuted test file is UNVERIFIED.
5. Provider/asset/network/currency qualifications, fresh quote/authorization, once-only real ledger outcome/reconcile/refund/receipt as appropriate. Never transfer or charge real customer funds just for a demo.
6. Exact deployed SHA, rollout/rollback and privacy-safe monitoring. Benchmark named inexpensive Android p50/p95 and data/storage usage for messaging performance claims.

## Known outstanding snapshots (not permanent ownership)

- **#468 draft:** C01 human-contact implementation code + Gateway composition exists; tests not executed, not merged, not deployed. R18 **#435** edits shared Gateway app/main; preserve both before integration.
- **#467 draft:** standalone messaging UX reference audit + extension-plan link pending review; do not silently assume unmerged content is canon.
- **#457 / #460:** CI Actions quota exhausted (2,000/2,000 included minutes), budget Stop usage. Zero-step workflows do not count as passing TypeScript/Flutter or production proof.
- All other R01–R19 and C01–C08 items require live evidence; this doc asserts no total completed count without a fresh code/test/deployment audit.

**Implementation handoff outcome:** documented feature coverage ready for parallel windows once this doc and the definitive kickoff are merged to main. Production acceptance remains a separate, evidence-driven task. No requirement is marked DONE by this document.
