# AF01 — staged MSN funding quote journal & owner readback (2026-10-13)

Base main: `db42827abfa464303833578a3bf49d9ae41f4709` (#714 source integrated).
Branch: `lane/af01-msn-quote-journal-20261013-gpt6`.
Exact claim: `af01-msn-quote-status-20261013-gpt6` on `factory/claims`.

## Source + operational safety

- Existing *staged, nonproduction* `packages/commerce/migration_proposals/0112_msn_wallet.sql` gains an immutable, exact-micro MSN quote journal and globally single-consumption fiat verification registry. There is no parallel financial ledger: the source reads canonical NGN funding/receipt and MSN issuance journal.
- Source-level `createMsnFundingJournal` stores server-issued economics and an external pricing evidence hash; no customer HTTP function creates quotes. This hash alone is **not** a qualified price, liquidity assurance, or custody receipt. Replayed quote IDs require exact unchanged economics and evidence. The internal `verifyFiat` method reuses #714 Flutterwave merchant-key verification plus canonical read-only NGN ledger consistency checks; repeats are idempotent and provider ID collisions fail closed. Provider settlement after quote expiry is conservatively refused until a qualified timestamp policy exists. It writes only an immutable "fiat verified" audit record.
- `GET /v1/wallet/msn/funding` is optional and authenticated with the *existing* session authority. All queries bind authenticated tenant/user; there are **no** customer-facing funding create, verify, mint, convert or send routes. Pending prices never display as spendable MSN; user balance comes only from actual issuance. DB errors return unavailable, not zero.
- Flutter adds an account-epoch fenced, compact status card and exact-result transport through existing Dio/AF08 credentials. Empty, offline, permission, unavailable and retry states are distinct. Only a joined canonical issuance displays minted MSN micros; fiat receipt stays "Payment verified · backing pending".
- Rollout switches independently default OFF: Gateway `MASANAWA_MSN_FUNDING_READBACK_ENABLED`; Wallet compile-time same. Preserve `MASANAWA_MSN_BALANCE_ENABLED` and `MASANAWA_WALLET_CREDIT_SEND_ENABLED` OFF. Do not auto-install `0112` or activate provider checkout/withdrawals.
- Keep Chats · Status · Wallet · Calls · Rooms / Chats default, existing Credits/crypto/billing data, AF08 credential fencing, MUI safety.

## Qualification and next integration

Dedicated `.github/workflows/af01-msn-funding-status.yml` runs actual PostgreSQL18 staged schema tests, Vitest Gateway quote/route/provider tests, Flutter status/regression and focused Dart analyzer. Hosted counts, failures and exact SHA must be recorded from the actual workflow, never inferred. Simulated provider response in tests does **not** constitute live merchant settlement.

**Status:** partial backend+Flutter status source, NOT activated. Pre-existing #576 is not a safe whole-branch merge; #713 owns canonical staged issuance. No pricing/custody evidence, purchase/convert client journey or qualified worker yet.

NEXT: approved executable quote from live treasury/custody and liquidity, authorized worker independently verifying Flutterwave/NowPayments settlement and acquired backing with refund/chargeback and dual-claim prevention, atomic NGN debit and MSN issuance, reconciliation/recovery and eventual audited device/customer receipt; **MSN Send only after ledger and authorization qualified**. MUI-09 combined, MUI-10 signed-installed and AF11 provider/device remain OPEN.
