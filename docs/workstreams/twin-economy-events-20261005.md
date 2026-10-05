# Twin economy event contract workstream

Owner/window: current ChatGPT implementation window
Branch: `work/twin-economy-events-20261005`
Base SHA: `c00de8cf7845c3a4caa39f088539c547e6a76b87`

## Scope

Define one additive event vocabulary for the transformed twin economy so Activity,
Wallet, transfers/gifts, paid voice, owner access and attribution can converge on
compatible event payloads.

## Owned paths

- new `packages/events/src/twin-economy*.ts`
- focused tests
- this claim file

## Explicitly not owned

- `packages/events/src/index.ts`
- event persistence/outbox migrations
- existing operation/receipt/reconciliation files
- Gateway/mobile integration

## Privacy rule

Events contain references, status, amounts and summary metadata only. Raw chat message
text/transcripts are not part of the event contract.

Status: implementation started 2026-10-05.
