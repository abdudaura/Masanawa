# Twin Credit transfer no-commission acceptance — TWIN-102

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/twin-credit-transfer-acceptance-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Task: TWIN-102 — end-to-end Credit transfer must not duplicate acquisition commission.

## Scope

This lane adds an isolated integration acceptance harness over already-merged canonical Credit transfer and Twin commission contracts. It does not add a second wallet/ledger/commission system and does not change protected shared integration.

## Exact owned paths

- `tests/integration/twin-credit-transfer-no-commission.test.ts`
- `docs/workstreams/twin-credit-transfer-acceptance-20261006.md`

## Excluded/shared paths

- PR #136 Gateway/mobile/router/chat/APK/production paths;
- Commerce model/repository/index and PostgreSQL persistence/migrations;
- Events/Activity/Wallet production composition;
- billing/crypto provider integrations;
- production environment and credentials.

## Dependencies

- merged `packages/commerce/src/transfers.ts`;
- merged `packages/commerce/src/attribution.ts`;
- persistent atomic Credit ledger execution and production composition remain integration-owner work.

## Acceptance intent

Prove that:
- an eligible external funding event can earn its configured commission exactly once;
- moving those resulting Credits user-to-user always becomes `internal-transfer`;
- the transfer contract is explicitly commission-ineligible;
- even if an attribution record is presented for the internal transfer, canonical commission policy rejects it as event-not-eligible with zero commission;
- transfer reversal is append-only and remains commission-ineligible.

State: CLAIMED / IMPLEMENTATION IN PROGRESS.

Last update: 2026-10-06.
