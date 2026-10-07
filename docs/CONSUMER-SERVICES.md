# Consumer Services

Status: **canonical consumer service scope — 2026-10-07**

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
- open **You -> Services**;
- open **Wallet -> Services**.

No service action should require leaving a public Talk permanently; the private Gwani
sheet can launch a private transaction flow and return the user to the Talk.

Financial values/actions must never be spoken into the public Talk unless the user
explicitly chooses to disclose them as ordinary speech.

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
3. server validates current catalog/eligibility;
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
