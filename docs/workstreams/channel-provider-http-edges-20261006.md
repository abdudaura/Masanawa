# WhatsApp/Telegram credential-backed HTTP edges — Tasks 101/102 — 2026-10-06

Status: active reclaimed channel slice
Owner/window: ChatGPT continuation window
Branch: `work/channels-provider-http-edges-20261006`
Base: stale PR #92 head `f6e8dbd1115ec1ceaf803826dc4ff24f44eecdef`

## Exact owned paths

- `adapters/channels/messaging/src/whatsapp-http-edge.ts` (new)
- `adapters/channels/messaging/src/whatsapp-http-edge.test.ts` (new)
- `adapters/channels/messaging/src/telegram-http-edge.ts` (new)
- `adapters/channels/messaging/src/telegram-http-edge.test.ts` (new)
- `adapters/channels/messaging/src/index.ts` (HTTP-edge exports only)
- `docs/CHANNEL-PROVIDER-HTTP-EDGES.md` (new)
- `docs/workstreams/channel-provider-http-edges-20261006.md`

## Boundaries

- no Gateway/app/main/storage/migrations/mobile/Commerce/deployment edits;
- provider tokens are `CredentialSecret` values and are revealed only inside one request call;
- token material is never returned, serialized, logged or placed in public error messages;
- explicit provider rejection returns bounded safe codes;
- network/ambiguous failures throw redacted errors so the existing outbound dispatcher can
  preserve uncertain-send reconciliation.

## Goal

Make the existing PR #92 `WhatsAppCloudApiEdge` and `TelegramBotApiEdge` production-usable
with credential-backed HTTP implementations while preserving the existing durable outbox and
ambiguous-send recovery contract.
