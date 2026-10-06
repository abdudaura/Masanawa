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

## Completed implementation

The integration acceptance harness proves:
- an eligible external-funding attribution under the canonical default 1% policy earns exactly 100 Credits on a 10,000-Credit base;
- transferring those Credits preserves the source provenance but forces the destination provenance to `internal-transfer`;
- every admitted Credit transfer is explicitly `commissionEligible: false`;
- all supported source provenance classes still produce a non-commissionable internal transfer;
- presenting an `internal-transfer` attribution to the canonical commission evaluator yields `event-not-eligible` with zero commission;
- the original funding commission plus the subsequent transfer commission remains exactly the original funding commission, preventing duplication;
- reversal is a new append-only receipt, swaps sender/recipient, remains `internal-transfer`, remains commission-ineligible and a `reversal` attribution also evaluates to zero commission.

## Verification

- changed-file audit against `main`: ahead 2 / behind 0 at implementation head and only the two owned files changed;
- exact canonical source blobs inspected on the branch:
  - `packages/commerce/src/transfers.ts`: `d9d06f4601ef8b3c46972d2c591414777f063b0c`;
  - `packages/commerce/src/attribution.ts`: `12a1829f36a22222afb98d57ce8d737b63cec75c`;
- PR #287 opened on implementation head `c05976850cb13686ec5f0dc27f7f4fba9512ed92`;
- GitHub had not attached a workflow run/check to that head when inspected, so no CI success is claimed;
- local repository execution could not be used because the execution sandbox has no outbound DNS to GitHub and the repo is not mounted there; this is recorded rather than substituting a mock result.

## Handoff

- implementation head: `c05976850cb13686ec5f0dc27f7f4fba9512ed92`;
- PR: #287 — Add Credit transfer no-commission acceptance;
- isolated implementation status: COMPLETE;
- full production TWIN-102 status: NOT COMPLETE.

## Remaining dependencies

Full TWIN-102 production acceptance still needs protected/shared integration evidence:
- persistent atomic Credit debit/credit and idempotent receipt storage;
- production transfer route/Wallet composition;
- actual Activity/Wallet event emission;
- restart/retry evidence against the persistent ledger.

Those paths are intentionally not taken by this lane.

State: ISOLATED COMPLETE / SHARED PERSISTENCE + PRODUCTION COMPOSITION REMAIN.

Last update: 2026-10-06.
