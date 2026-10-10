# Voice-First Interaction Contract

## Latest AI-first product scope — 2026-10-08

**Owner 2026-10-08 operator quality expansion:** speech, typing and taps must all address the same durable authenticated task, explicit review/consent, actual Gateway operation and receipt with recovery. Gwani/Gwana may prepare Talks, lessons, verified files, permitted person-message drafts and qualified financial quotes. Never treat model speech, an ambient yes or public Talk microphone as approval. Read [canonical action/task specification](AI-OPERATOR-ACTION-AND-TASK-CONTRACT-V1-20261008.md), [product K journeys](AI-FIRST-PRODUCT-AND-HUMAN-COMMUNICATION-20261008.md) and [U01–U20 scopes](20-WINDOW-AI-CHAT-EXECUTION-20261008.md). Native media tests remain required.


Status: **canonical approved experience — 2026-10-08**
Implementation: OPEN/PARTIAL; this document does not enable transactions.
Applies across the consumer app, especially R04–R12 and R15 in MOBILE-READINESS-PLAN.md.

## Core experience

Masanawa must serve people who can speak their language but cannot comfortably type,
read or write. Voice is the primary path; text/taps are equally complete alternatives.
A private conversation with Gwani/Gwana is the main way to operate Wallet, Billing and
Crypto. Small interactive cards accompany the conversation. Forms are an optional
expanded editing mode, not the mandatory checkout architecture.

The owner-approved final shell is **Talks · Chats · Assistant · Wallet · Agents**, with **Assistant centered** as one switchable Gwani/Gwana chat (the Flutter migration is not yet verified). Existing wallet/service routes become scoped
private assistant workspaces, within the approved root shell, not separate chatbot products.
Use the same authenticated assistant, capabilities and durable task authority everywhere.
A returning user can open balances/history immediately without speaking or waiting for AI.

Each applicable surface has a prominent Talk action, Type instead, and contextual
content/actions. The microphone starts only after deliberate user action. Never listen
continuously in the background. Show listening/thinking/speaking/reconnecting clearly.
Prefer qualified Gemini Live native audio, not browser TTS. Input modality never changes
the meaning, price, confirmation requirement or transaction identity.

## One conversation, useful cards

| Card | Spoken and visual behavior |
| --- | --- |
| Balance | Explain each native fiat balance, Credits, available/pending earnings and asset/network balance separately. Optional display-currency estimates are labeled. |
| Recipient | Resolve saved nickname/contact, show masked identity and read a meaningful identifier; ambiguity asks one short question. |
| Options | Offer a small number of eligible choices with spoken ordinal labels; “second one” resolves against the current versioned list. More choices/search remains available. |
| Quote | Exact recipient/product/asset/network, amount, fees, total/outcome and expiry; Repeat, Change, Confirm and Cancel. |
| Funding | Explain the shortfall and qualified method; provide resumable owned bank/checkout details and status. Do not pretend voice performs an external bank transfer. |
| Pending | Show actual pending/unknown state, explain what is happening and offer status/support—not another charge. |
| Receipt | Immutable provider/ledger outcome with spoken summary, reference, applicable delivery token and history link. |

Cards are server-supported projections, not hardcoded fake balances/plans. Each carries
its task/operation identity and appropriate version; stale cards cannot authorize new
prices. Icons have semantic labels, large touch targets and a spoken explanation.
“Repeat”, “slower”, “explain”, “change that”, “go back” and “cancel” work consistently.
Do not flood chat with every streaming transcript or duplicate receipt cards.

Preserve the user's existing preference: do not automatically display potentially
garbled user speech as a chat message. Show the assistant response and verified action
summary; correct misheard details conversationally. Typed input remains visible normally.
Financial truth comes from structured canonical terms, not an unreliable transcript.

## Billing example

User: “Buy data for my mother.”
Assistant resolves the saved recipient or asks who they mean, then asks only missing
country/provider/plan/amount. If all details were given, skip redundant questions.
Offer eligible choices aloud and as small cards. “The second one” selects the current
option, not an old message. Obtain server validation and a fresh quote.
Read recipient, product, total and fees, then require explicit confirmation.
Insufficient balance offers qualified funding, saves progress and resumes after verified
funding. Completion explains success and the receipt/token in the user's language.
Failure/unknown/refund is honest; no invented delivery or blind duplicate execution.

The exact airtime/data/electricity/TV catalog remains provider/account/country qualified.
AI cannot substitute a similar product without fresh consent.

## Crypto and wallet examples

“Buy ten dollars of USDT” collects missing payment currency, eligible rail/network and
whether amount describes spend or receive. Explain exact received amount, fees and any
unfixed outcome; never advertise an exact amount when the provider cannot guarantee it.
“Convert my USDT” clarifies amount and destination asset/network. “Send some to Mary”
resolves a trusted saved destination and clarifies amount; speech is not a safe sole
capture method for a long crypto address. Prefer QR, paste or saved destinations.
Validate asset/network and destination, then show/read the exact quote before consent.

Wallet understands balance, fund, supported send/withdraw, earnings, history, receipts
and support requests. Unsupported currencies/networks/regions have a clear explanation.
Changing UI language never changes country/currency. Addresses, IDs and provider names
remain exact. Withdrawal needs the canonical authentication/security workflow.
Voice is not proof of identity; do not invent voice biometrics.

## Conversation-to-transaction architecture

Reuse canonical intent routing, customer authentication, quote, ledger, provider and
reconciliation services. Add a durable task/session projection if the existing contract
cannot represent progress; do not create a second money state machine.
State includes owner, intent, collected structured fields, unresolved ambiguity, current
option/quote versions, authorized operation ID, confirmation evidence, phase and timestamps.
Persist structured progress necessary for recovery, not raw voice by default.

The assistant interprets and explains; server policy validates and authorizes.
Explicit consent is bound to a specific fresh quote and operation identity. A vague “yes”
from unrelated conversation, background speaker or replayed recording cannot execute.
Resolve affirmation only within the current secure confirmation interaction; uncertain
recognition asks again. High-risk actions use required recent authentication and an
accessible trusted confirmation path. Approval never comes from the model alone.

Before confirmation: edits invalidate and regenerate affected quotes. After execution:
a “cancel” request explains whether cancellation is still possible; irreversible sends
are never claimed undone. Timeout/unknown outcome reconciles the same operation.
Switching voice/text, leaving/reopening, reconnecting and asking for status never creates
a new charge. Multiple tasks need an explicit current-task selection before approval.
Order options and pin selected terms so list updates cannot silently change “second”.

## Privacy and accessible audio

Financial assistance is private even while listening to a public Talk.
Suspend/route the public microphone correctly before private service speech; private
input, assistant replies and card data must never publish to the public audio track.
Verify actual Android audio routing; a UI private badge alone is insufficient.
Warn before speaking sensitive details through a loudspeaker, offer earpiece/headphones
or silent text mode, and mask public/lock-screen notifications.
No blanket automated reading of account numbers, secrets or addresses.

Voice-only users can obtain the same terms, confirmations, status and receipts without
reading. Use short turns and plain language, spoken number/currency disambiguation,
repeat/slower controls and restrained listening/completion cues. Haptics are optional;
no state depends only on color, sound or animation. Provide screen-reader semantics,
text scaling, RTL and reduced motion. Users with hearing/speech disabilities can complete
the full journey through text/taps. Permission denial does not strand the workflow.

Use conversational language detection with explicit correction (“speak Hausa” etc.).
Do not infer country, identity, literacy or ability from accent. Let users correct a
recipient/amount without starting over. Qualify spoken digits, currency names, accents
and code-switching before advertising voice transaction reliability.

## Further critical improvements

- First-use demonstration: optional spoken guidance with a safe example; no marketing
  carousel or mandatory form tutorial. Explain privacy and microphone state clearly.
- Interruption: barge-in stops assistant speech safely; preserve task/confirmation state.
- Connectivity: preserve drafts on poor networks; stop claiming listening when disconnected.
  Offline edits may be drafts only; no offline payment execution or stale confirmation.
- Support: “I need help with this payment” includes an approved masked reference and actual
  status. Support escalation never silently sends private chat/audio to another party.
- Trusted recipients: optional consent-based save/edit/delete; no automatic contact-book
  upload or silent beneficiary replacement.
- Destructive actions: voice can start account deletion or Twin deletion but must explain
  scope and use required reauthentication/confirmation, with durable server completion.
- Other screens: spoken topic creation, persona search, free invitation, Raise hand/Ask,
  selected AI quote, private Direct Twin and Settings support use the same interaction
  principles. Public voice and private commands have explicit modes.
- Operational quality: record privacy-safe latency/error/intent correction and transaction
  recovery metrics; never collect raw financial conversations merely for analytics.
  Budget model requests and context; no new inference for every reaction or UI tap.

## Acceptance and implementation sequence

Extend existing R06/R07/R08/R11 tasks rather than introduce a parallel roadmap.
First integrate read-only balance/history/explanation and mode switching. Then connect
Billing quotes, funding and recovery; next qualified Crypto buy/convert/withdraw; then
remaining commands. Financial recovery/security is a dependency, not optional polish.

Test both voice-only and silent text/tap paths:
1. A low-literacy user buys a qualified bill, hears exact terms and obtains a receipt.
2. A non-Nigerian user sees eligible native balances/rails and speaks a supported language.
3. A user switches modes halfway through without losing fields or duplicating execution.
4. Misheard numbers, ambiguous recipient, changed ordinal list and expired quote require
   correction/new consent, never silent assumptions.
5. App restart, provider timeout, lost callback and double confirmation produce one
   durable operation with restored state and honest status.
6. Crypto address/network errors are caught before an authorized transfer.
7. Public Talk audio continues correctly after private assistance; no private financial
   speech or transcript reaches other listeners.
8. Denied microphone, accessibility settings, RTL and weak connectivity retain usable paths.
9. Cancellation after irreversible execution is explained honestly.
10. Voice latency/budget and accuracy are measured on real handsets and target languages,
    with evidence recorded separately from mocked component tests.

A chat-shaped form or a voice button that merely fills a conventional mandatory form
does not satisfy this contract. The completed experience is conversational, accessible,
recoverable and anchored to actual server authority.

## Global message, contact and transfer command parity (C01–C08)

The owner extends **voice-first, not voice-only** interaction beyond Wallet: private **human-to-human DM**, voice notes, contact discovery, public Talk preparation/authorized Host actions and qualified internal wallet/crypto transfers are accessible through **speaking, typing or contextual taps** with one shared server-owned task/action identity and same recovery, privacy and explicit-confirmation rules. Gwani/Gwana are platform operators only within granted capability; they cannot assume access to unrelated human messages, spend on their own or override a Host.

Example: inside a private chat with Ibrahim, “send him five USDT” must resolve the **actual saved person**, exact custody-backed asset/network/account, fees/limits/expiry and display/read-back recipient and quote; ask for fresh transaction-specific approval and appropriate authentication before **one** ledger transfer. “Send Ibrahim a message about tonight’s Talk” can be drafted and reviewed then sent by the user's authorized action, with a server delivery receipt. Pronouns/ordinals bind to the **active versioned context**, never an old conversation. A silent typed instruction and buttons complete the same task, without microphone permission.

Protected human DMs are not public Talk transcripts, AI participant context or general model memory. Public audio recording and private voice-note/assistant audio use separate consent and track routing. No long address accepted solely from uncertain speech; no “yes” heard from background authorizes payment. See C06/C07 and `COMMUNICATIONS-EXTENSION-PLAN.md`. Implement the approved five-tab target once under R17/C08, not an interim four-tab shell.

## Approved five-tab shell entry points and one Assistant chat

Bottom navigation is **Talks · Chats · Assistant · Wallet · Agents**, with Assistant visually centered. **Talks** contains the former Home **Explore / Live Talks** feeds and its sole public **Start Talk** FAB; Chats is for human person-to-person threads and voice notes only; **Agents** contains Experts/Twins browsing and their distinct private persona chats.

**Assistant is the single private Gwani/Gwana operator conversation**, not separate Gwani and Gwana chat tabs. Show a visible **switch between Gwani and Gwana inside the chat header**; preserve the same user-owned, scope-authorized conversation, per-message speaker attribution, drafts, pending tasks, voice/text/tap parity and correct permission/consent across switches. Do not treat switching as a new payment approval or privileged agent identity. No microphone starts simply by visiting Assistant.

The root header has Activity bell and profile avatar. Wallet orders **Crypto, Data bundles, Airtime, Electricity, TV/Cable**; selecting any verified action sets the same private Assistant/Wallet task intent and never pays or activates the microphone automatically. Public Expert/Twin Seat admission requires explicit host policy and quote/consent. Preserve named old deep links, return state, selected persona, language and task context. Shipping and device evidence remain separately required.
