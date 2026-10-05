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

Status: isolated transfer/gift command implementation complete; persistence/shared integration pending.

Implemented:
- Credit transfer command/fingerprint/provenance contracts;
- exact integer Credit validation;
- self-transfer/self-gift rejection;
- internal-transfer destination provenance;
- explicit commissionEligible=false for Credit movement;
- append-only reversal contract;
- Gift admission with explicit economic reason;
- authenticated transfer service;
- server-side recipient resolver;
- authenticated gift service resolving owner from twin/Character server-side;
- required abuse-policy guard hooks;
- executor ports for canonical atomic ledger posting/idempotency;
- isolated transfer/gift Gateway route registrars;
- tests proving client-supplied sender/owner fields are ignored;
- tests proving transfers/gifts cannot become acquisition-commission events.

Not yet integrated:
- append-only PostgreSQL command/receipt persistence;
- canonical balance debit/credit transaction;
- idempotency repository/replay handling;
- recipient identifier resolver implementation;
- twin -> owner resolver implementation;
- packages/commerce exports;
- Gateway app/main composition;
- Wallet transport;
- Activity event emission;
- security guard adapter from the abuse-control lane.

No active billing/crypto Commerce files or migrations were modified.


## Local verification

Local strict TypeScript verification: `transfers.ts` and `gifts.ts` compile cleanly with `tsc --strict --noEmit` in isolation.
