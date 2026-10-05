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

Status: additive event-contract implementation complete; export/persistence integration pending.

Implemented:
- one twin-economy event vocabulary for visits, conversations, purchases, gifts, paid
  voice, owner access and earnings;
- stable summary codes suitable for Activity/Wallet projection;
- owner/participant/internal visibility marker;
- reference IDs instead of embedded financial/runtime objects;
- exact optional/required Credit amount rules by event type;
- money forbidden on visit/conversation observation events;
- explicit helper rejecting raw message/text/transcript/prompt/response/content fields;
- focused privacy and validation tests.

Not yet integrated:
- packages/events index export;
- outbox/persistence wiring;
- emission from transfer/gift/voice/owner-access/attribution features;
- Activity and Wallet history source adapters;
- Gateway/mobile composition.

No existing event package files were modified.
