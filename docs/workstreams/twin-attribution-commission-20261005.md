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

Status: implementation started 2026-10-05.
