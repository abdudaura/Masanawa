# Twin economy abuse/security controls workstream

Owner/window: current ChatGPT implementation window
Branch: `work/twin-economy-abuse-controls-20261005`
Base SHA: `c00de8cf7845c3a4caa39f088539c547e6a76b87`
Tasks: TWIN-090, TWIN-091, TWIN-092, TWIN-094, partial TWIN-095

## Scope

Implement additive, reusable economy-abuse policy logic without touching active Commerce,
billing, crypto, shared Gateway composition or mobile router files.

## Owned paths

- new `packages/security/src/twin-economy-*.ts`
- new `services/gateway/src/twin_economy_guard*.ts`
- focused tests
- this claim file

## Explicitly not owned

- Commerce repositories/migrations/ledger posting
- billing/crypto code
- public twin profile/memory work
- shared Gateway app/main composition
- mobile router/chat integration

## Controls

- reject self-attribution/self-gift/self-transfer where policy requires;
- detect obvious circular transfer/gift farming;
- configurable per-operation amount/rate limits;
- pending/chargeback-aware earning withdrawal holds;
- block/report/discoverability policy contract;
- launch-age/identity policy seam without embedding legal guesses in UI.

Status: implementation started 2026-10-05.
