# Twin attribution + commission workstream

Owner/window: current ChatGPT implementation window
Branch: `work/twin-attribution-commission-20261005`
Base SHA: `c00de8cf7845c3a4caa39f088539c547e6a76b87`
Tasks: TWIN-034..037 additive contract portion

## Scope

Implement versioned originating-twin attribution and creator commission policy without
editing active billing/funding/settlement files.

## Owned paths

- new `packages/commerce/src/attribution*.ts`
- new `packages/commerce/src/monetization-policy*.ts`
- new `services/gateway/src/twin_attribution*.ts`
- focused tests
- this claim file

## Explicitly not owned

- existing funding/settlement/model/repository files
- Commerce migrations
- billing/crypto provider orchestration
- Gateway app/main
- mobile files

## Invariants

- no hard-coded 1%;
- policy revision is durable input;
- only explicitly qualifying external inflow or eligible commerce may earn commission;
- self-attribution, internal transfers, gifts, refunds/reversals and test/admin traffic
  never create commission;
- reversal creates negative/offsetting settlement intent, never edits history;
- fulfillment executor and originating twin are separate facts.

Status: isolated attribution/commission contracts complete; persistence/shared integration pending.

Implemented:
- originating-twin attribution event model;
- qualifying event types: external funding and eligible commerce purchase;
- explicit non-qualifying internal transfer/gift/refund/reversal/test/admin events;
- configurable CommissionPolicy with basis-points rate;
- initial default policy = 100 basis points (1%);
- admin read/update service allowing percentage changes without app release;
- minimum/maximum commission bounds;
- self-attribution exclusion;
- expiry exclusion;
- zero-base exclusion;
- append-only commission reversal helper;
- authenticated attribution quote service;
- isolated Gateway route registrar;
- focused tests for default 1%, admin override, self-attribution, transfer/gift exclusion and reversal.

Not yet integrated:
- attribution persistence/migrations;
- public twin/share/session origin capture;
- funding/billing/crypto operation hooks;
- canonical commission ledger posting;
- refund/chargeback reversal posting;
- admin-app UI;
- packages/commerce export wiring;
- Gateway app/main composition;
- Activity emission.

No active billing/funding/settlement/crypto files or migrations were modified.


## Local verification

Local strict TypeScript verification: `attribution.ts` compiles cleanly with `tsc --strict --noEmit` in isolation.
