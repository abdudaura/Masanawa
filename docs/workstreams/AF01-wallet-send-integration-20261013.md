# AF01 Wallet Credits Send: qualification-gated Flutter ↔ Gateway ↔ canonical ledger

**Date:** 2026-10-13.
**Base:** `bf6c9f2386d5b7c22ad8eb6b035b949cdbd64269` (AF08 #711 merged).
**Branch:** `lane/af01-wallet-credit-send-20261013-gpt6`.
**Claim:** `af01-wallet-credit-send-20261013-gpt6`.

## Dependency-ready connected customer journey

Preserve current Chats · Status · Wallet · Calls · Rooms and root Wallet.
The prior mounted Wallet intentionally did not provide `onSend`, although
`SendCreditsSheet`, `WalletController.sendCredits`, the idempotent
`GatewayWalletTransport`, canonical `/v1/wallet/transfers` API, authenticated
recipient resolution and PostgreSQL twin-economy credit ledger already existed.
The old sheet misleadingly labeled its direct irreversible POST "Review & send".

This patch connects Wallet → reviewed legacy Credits transfer → second explicit
Confirm → typed canonical server receipt → Wallet refresh and receipt sheet.
It uses the existing `CreditTransferReceipt`, existing Gateway operation
request ID and source-ledger replay/reconciliation; neither a second ledger,
MSN↔Credits rate, fiat funding nor a provider API is added. Sender identity is
always from authenticated server session, recipient resolved server-side;
self-transfer/insufficient/blocked guarded by the existing economy authority.

The **new server gate** `MASANAWA_WALLET_CREDIT_SEND_ENABLED=true` is
default OFF. `registerCreditTransferRoutes` checks the trusted Gateway
operator-supplied enabled predicate before parsing, resolving sender or
touching the ledger and returns HTTP 503 `WALLET_SEND_DISABLED` when off.
The root service explicitly injects the flag only when its canonical
`twinProduction` runtime is present. Headers/body cannot enable it.
The **new client build gate** with the same dart-define name defaults OFF.
The root and standalone Wallet screens retain the existing optional
`onSend` compatibility but offer the internal Send sheet only to signed-in
fans when the build gate is explicitly enabled and a real Wallet view exists.
Direct tests may opt in with the constructor; this does not qualify production.

The sheet prevents invalid/zero/over-balance submissions, requires separate
Review and Confirm actions, disables repeated taps while the request is
pending, and refuses to show another account's result after a fan swap.
If a response is absent, malformed, or uncertain it shows **unconfirmed,
check history before retrying**; no fabricated success is emitted.
A completed receipt shows the actual server transfer ID, recipient user ID
and exact amount. Wallet account isolation and AF08 Dio fencing still apply.

## Verification plan / limitations

- Dedicated hosted `AF01 Wallet Credit Send` workflow: Flutter screen,
  dialog and transport regressions, auth fencing and focused Dart analysis;
  Gateway transfer and credit-economy Vitest plus real PostgreSQL18 twin
  ledger integration, Node24/pnpm frozen dependencies.
- The root `Status Video Integration` and `Foundation CI` suites run
  independently; do not conflate their known Gateway/global TS debt with
  introduced scoped failures.
- **Execution pending** exact-PR-head hosted jobs; do not claim passes or
  merge before focused validation.
- Both client/server flags default OFF. Real joined fan accounts, signed
  installed APK, in-production PostgreSQL restore, receipt/readback, finance
  operations and financial/provider acceptance **NOT QUALIFIED**.
- AF01 MSN-primary issuance, backing/NGN conversion, crypto funding/provider
  credential authority, gas/network route confirmation and deposit/webhook
  reconciliation remain OPEN. Draft MSN PR #576 has a divergent old base;
  no old branch wholesale merge or ledger relabel occurred.
- MUI-09 full multi-tab combination, MUI-10 signed installed identity,
  AF11 real device/provider and overall launch acceptance remain OPEN.

## 2026-10-13 concurrent replay repair checkpoint

Previous hosted #38381724205: Flutter **50 passed** with 6 informational lints; PostgreSQL/Gateway **56 passed, 1 failed**. The failing exact replay hit the independent (tenant_id, ledger_entry_id) uniqueness constraint even with a conflict arbiter restricted to (tenant_id, request_id). Both receipt identities are unique. Use targetless ON CONFLICT DO NOTHING followed by strict same-request stored receipt comparison; a different request trying to reuse a ledger entry must **not** return a successful receipt. The PostgreSQL acceptance now tests eight simultaneous exact replays plus the negative distinct-request/same-ledger collision. Introduced Flutter lint items are corrected, without broad unrelated formatting changes.

**New verification:** pending exact-head CI; this source checkpoint is not a claimed pass. Existing feature flags both remain default OFF. Main merge must occur only after the new focused Gateway/PostgreSQL + Flutter results pass and current head/claims are reconciled. Full Flutter/TypeScript debt, device, providers and financial issuance remain separate open gates.
