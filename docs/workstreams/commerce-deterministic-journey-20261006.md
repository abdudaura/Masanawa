# Deterministic quote/payment/ledger/fulfillment journey — Task 133

Owner/window: current ChatGPT continuation window — Task 133
Branch: `work/deterministic-commerce-journey-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Production task: 133 — deterministic quote/payment/ledger/fulfillment domain.

## Existing canonical foundations preserved

Current `main` already owns:
- versioned Offer pricing linked to SkillVersion;
- Customer Credit, Agent Float, fulfillment reserve, pending/available earnings and platform revenue account kinds;
- immutable quote economics with originating Character + creator attribution;
- insufficient-Float platform fallback planning;
- fulfillment admission/completion contracts;
- anti-self-earning settlement invariants.

This lane composes those primitives; it does not redefine them.

## Exact owned paths

- `packages/commerce/src/journey.ts` (new)
- `tests/integration/commerce-deterministic-journey.test.ts` (new)
- `docs/workstreams/commerce-deterministic-journey-20261006.md`

## Explicitly excluded/shared paths

- existing Commerce `model.ts`, `repository.ts`, `funding.ts`, `settlement.ts`, `index.ts`;
- PR #90 Commerce persistence/Float commands and migrations;
- Task 134 refund/reconciliation/withdrawal;
- Identity one-clone ownership implementation;
- Gateway/Worker/Ops/mobile and PR #136;
- provider adapters, production environment and lockfile.

## Implementation boundary

- derive immutable quote economics only from an active exact OfferRevision;
- preserve customer, originating Character and creator attribution independent of selected executor;
- deterministic admission chooses creator Float or platform fallback from the existing funding policy;
- customer payment and creator reserve ledger legs require caller-supplied canonical LedgerEntryIds;
- deterministic completion settlement requires caller-supplied canonical LedgerEntryIds for reserve release, creator earnings and platform margin;
- same inputs reconstruct byte-equivalent economic plans; no random IDs inside this layer;
- self-purchase creator earnings fail closed through existing canonical settlement rules;
- platform fallback preserves originating Character/customer relationship and applies fallback commission from the Offer;
- no external provider/payment truth or Task 134 reversal logic is introduced.

State: CLAIMED. Implement the deterministic orchestration layer and integration tests without editing existing Commerce owners.
