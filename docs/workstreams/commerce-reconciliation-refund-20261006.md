# Commerce reconciliation/refund/adjustment/receipt journey — Task 134

Owner/window: current ChatGPT continuation window — Task 134
Branch: `work/commerce-reconciliation-refund-20261006`
Base SHA: `e9279476cbf6906812fb530aa5ad1b98dd2f745b` (Task 133 PR #265 exact handoff head)
Production task: 134 — payment reconciliation/refund/adjustment/receipt journeys.

## Exact owned paths

- `packages/commerce/src/reconciliation.ts` (new)
- `tests/recovery/commerce-reconciliation-journey.test.ts` (new)
- `docs/workstreams/commerce-reconciliation-refund-20261006.md`

## Explicitly excluded/shared paths

- existing Commerce `model.ts`, `repository.ts`, `funding.ts`, `settlement.ts`, `index.ts`;
- Task 133-owned `journey.ts`;
- PR #90 Commerce persistence/migrations;
- Security negative-balance recovery policy PR #225;
- provider-specific webhook/requery adapters;
- Gateway/Worker/Ops/mobile and PR #136;
- withdrawal provider/payout transport;
- lockfile/production environment.

## Implementation boundary

- normalize bounded external reconciliation receipt evidence against exact Tenant/Quote/Fulfillment identity;
- exact replay of the same receipt is idempotent; changed evidence under one receipt id fails closed;
- plan deterministic inverse ledger legs only from exact canonical original transfers and caller-supplied LedgerEntryIds;
- customer-payment reversal refunds only to Customer Credit;
- creator-earning reversal debits Pending Earnings, never Customer Credit or Agent Float;
- platform-margin reversal debits Platform Revenue;
- creator fulfillment reserve can only be released back to Agent Float, never Available Earnings;
- automatic reversal refuses already-settled/withdrawn earnings and routes that case to explicit reconciliation/negative-balance policy;
- withdrawal admission accepts only Available Earnings -> external clearing and rejects Customer Credit, Agent Float, reserve or pending earnings as withdrawable principal;
- self-routed purchased Credits/Float can therefore never become withdrawable through this planner;
- provider ambiguity remains reconciliation-only; no blind financial retry.

State: CLAIMED. Implement deterministic reconciliation/refund/withdrawal safeguards as an additive Commerce layer.
