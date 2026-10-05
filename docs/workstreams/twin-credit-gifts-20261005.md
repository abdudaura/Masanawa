# Twin Credits transfer + gifts workstream

Owner/window: current ChatGPT implementation window
Branch: `work/twin-credit-gifts-20261005`
Base SHA: `c00de8cf7845c3a4caa39f088539c547e6a76b87`
Tasks: TWIN-031..033 plus Gateway seams

## Scope

Implement additive financial command contracts for user-to-user Credit transfers and
gifts/blessings without touching active Commerce model/repository/migrations or shared
Gateway composition.

## Owned paths

- new `packages/commerce/src/transfers*.ts`
- new `packages/commerce/src/gifts*.ts`
- new `services/gateway/src/credit_transfer*.ts`
- new `services/gateway/src/gifts*.ts`
- focused tests
- this claim file

## Explicitly not owned

- `packages/commerce/src/index.ts`, `model.ts`, `repository.ts`
- Commerce migrations
- PostgreSQL Commerce repository
- billing/crypto files
- Gateway `app.ts` / `main.ts`
- mobile Wallet surface

## Invariants

- transfers move existing Credits only;
- no transfer or gift mints acquisition commission;
- idempotency key + fingerprint are mandatory;
- self-transfer/self-gift is rejected;
- amount must be exact integer Credits;
- source provenance is preserved;
- reversal is a new command/event, never mutation;
- Gateway accepts user intent only; canonical account/ledger posting remains server-side.

Status: implementation started 2026-10-05.
