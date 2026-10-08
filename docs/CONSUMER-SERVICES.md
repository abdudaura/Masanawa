# Consumer Services

> **2026-10-08 owner coverage:** Validate this Billing/Crypto scope against `OWNER-REQUIREMENTS-TRACEABILITY-20261008.md` (W01–W13) and `WHOLE-PRODUCT-ACCEPTANCE-JOURNEYS.md` (J08–J09). Voice-only and quiet typed/tap access, crypto-in-chat transfer, qualified global eligibility and same-server authorization/receipt/recovery are non-optional. "Bank-like" simplicity must not be interpreted as a new fiat/banking ledger or universal no-fee crypto eligibility. All live provider/device outcomes remain unverified until R05–R08/C06 acceptance.


Status: **canonical consumer service scope — 2026-10-08**

Masanawa has exactly two standalone consumer service families:

1. **Billing**
2. **Crypto**

Everything else that an AI can do—teaching, research, news explanation, writing,
storytelling, translation, search, analysis, planning, brainstorming and similar
capabilities—is consumed through Gwani, Experts or Talks rather than presented as a
“service room” or app section.

## Access principle

A user can reach Billing/Crypto in three simple ways:

- ask private Gwani from anywhere;
- open **Profile -> Services**;
- open **Wallet -> Services**.

No service action should require leaving a public Talk permanently; the private Gwani
sheet can launch a private transaction flow and return the user to the Talk.

Financial values/actions must never be spoken into the public Talk unless the user
explicitly chooses to disclose them as ordinary speech.

## Canonical interaction: conversation first

Follow `VOICE-FIRST-INTERACTIONS.md`. Wallet, Billing and Crypto open a scoped private
Gwani/Gwana conversation with useful balance, recipient, option, quote, funding, pending
and receipt cards. Talk is primary; Type instead and taps complete the same journey.
Users need not read/type to hear terms, choose, explicitly confirm and obtain status.

Forms are optional expanded editing, not required checkout. Collect only missing fields,
bind “second one” to the current option version, and preserve task identity when changing
modes, reopening or reconnecting. Model interpretation is not money authority.
Spoken consent is bound to fresh terms and required authentication; uncertain or unrelated
affirmation does not execute. Crypto addresses use QR/paste/trusted destinations.
Private audio must not publish into the public Talk microphone track.
Read-only balances/history remain directly accessible without invoking AI.

## Global scope and qualification

Masanawa is a global platform. User locale, conversation language, recipient country,
native currency and provider account capability are separate. Nigeria's live service
qualification is a priority, not a platform-wide country/NGN restriction. Other markets
become available only after exact catalog/operation/account qualification; unsupported
rails have honest status and an alternative, never fabricated success.

Providers supply qualified capabilities; the server remains authority for limits,
identity requirements, recipient formats, fees and currencies. Preserve the existing
NGN adapter and ledger history while extending shared currency-aware interfaces.

## Billing

Provider direction: **Flutterwave**, subject to live account and product qualification.

Consumer families:
- Airtime
- Data
- Electricity
- TV/cable

Required purchase shape:

1. user names/selects service;
2. collect only missing recipient/account/plan/amount;
3. server validates current country/catalog/currency/recipient eligibility;
4. show/read back exact quote;
5. explicit confirmation;
6. execute once with durable idempotency;
7. reconcile ambiguous provider outcomes;
8. return receipt/status.

If the user already provides all required fields in one voice/text instruction and has
sufficient authorized balance, Gwani should not repeat unnecessary questions.

Do not expose provider internals or force an external checkout when a supported in-app
private transaction path exists.

## Crypto

Provider direction: **NOWPayments**, subject to exact operation/account/network
qualification.

Consumer operations:
- Deposit
- Buy where eligible
- Convert
- Withdraw

Crypto is not the Masanawa social currency. Crypto balances remain asset/network-specific
custody and must never be merged into creator earnings or generic Credits.

Eligibility is determined by exact:
- asset;
- network;
- operation;
- provider/account availability;
- minimums;
- fees;
- region/policy.

Ethereum-mainnet ERC-20 routes are excluded by current low-fee policy. Do not imply that a
ticker is eligible on every network.

Required transaction shape:

1. choose operation;
2. resolve exact asset/network;
3. show amount, fees, minimums and quote expiry;
4. explicit confirmation;
5. execute with one durable operation identity;
6. reconcile webhook/provider ambiguity;
7. show final/unknown/refunded status honestly.

## Wallet separation

The user can conceptually hold:

- qualified fiat balances, each with its own native currency/precision;
- spendable Masanawa balance/credits, if enabled;
- creator earnings;
- crypto assets.

These must remain visibly and financially separate.

Do not expose:
- Agent Float;
- executor reserves;
- provider settlement accounts;
- internal margin ledgers.

## Talk monetization is not a “service”

AI Seat fees, gifts, Twin rentals and creator earnings belong to the Talk creator economy.
They appear in Wallet/Earnings and Talk flows, not as extra entries in Services.

## Retired consumer service concepts

Do not create standalone screens for:
- teaching;
- research;
- news;
- stories;
- business planning;
- general work;
- writing;
- search;
- translation;
- image/video generation;
- Skills/tools.

Those capabilities may still exist internally and can be used by Gwani or an Expert when
appropriate.

## Required recovery and release evidence

The current open financial tasks are R05–R08 in `MOBILE-READINESS-PLAN.md`:
working wallet actions/native balances, quote-scoped funding reuse/restoration, durable
credit-to-bill continuation, correct webhook error classification, scheduled bounded
reconciliation, four-family live billing qualification and exact crypto capabilities.
Every flow needs one operation identity, exact terms, explicit confirmation, pending/
unknown handling, receipt/refund and support reference. No duplicated parallel ledger.

Fiat uses native currency metadata/exact minor units; crypto uses asset/network precision.
No float arithmetic, silent FX or assumption all currencies have two decimals. Optional
preferred display-currency totals are labeled estimates with rate/time, not spendable
balance. Language is never a substitute for country or financial eligibility.

A configured credential, flag name or returned category list is not live fulfillment
qualification. Verify duplicate/concurrent action, lost callback, timeout and restart,
refund and real provider receipts before enabling advertised operations.
Digital AI Seat/Credit/gift purchases require their own Google Play payment classification;
do not route all product categories through utility billing by assumption. Release
channel/regional policy and provider eligibility are acceptance gates, not extra Services.

## Human-to-human transfers within the existing Crypto family

The communications extension adds **eligible user-to-user internal crypto transfers** (C06 in `COMMUNICATIONS-EXTENSION-PLAN.md`, issue #462) to Crypto's supported operations; it does **not** add a third standalone service, invent a new wallet or turn crypto into the social Credit. Extend the **same canonical custody-backed exact asset/network ledger** used by R06/R08, after funding and balances are truly qualified.

A transfer recipient is an authenticated eligible account/handle, resolved privately with blocked-user and risk controls. The server owns spendable funds, exact network/asset, fee/limits/market/identity eligibility, fresh quote, confirmation, atomic balanced debit/credit, idempotency, reconciliation and immutable receipt on both sides. It can be initiated from a conversation, Wallet or private Gwani/Gwana by **voice, text or tap**, but all use the same authority. Internal book transfers are not on-chain withdrawals; explain that difference, and never promise globally free/instant external transfers or unsupported region/asset rails.

Secure chat storage is independent of money custody. No human DM content or wallet amount automatically enters public Talk/AI stage. Existing fiat, Masanawa Credits and creator pending/available earnings stay visibly separate from crypto.

## Root Wallet shortcuts

Wallet is a root destination. Order Crypto first, then Data bundles, Airtime, Electricity
and TV/Cable, with balance/history and qualified funding/send/withdraw controls. These
remain Billing/Crypto intents. Selection starts a private assistant task with the chosen
intent already known; it neither executes nor turns on the microphone. Profile/Services
and Agent chat may reach the same task authority. See APP-SHELL-CONTRACT.md.
