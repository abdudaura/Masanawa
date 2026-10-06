# Credential-backed WhatsApp and Telegram HTTP edges

Status: Tasks 101/102 provider-send implementation slice.

## Secret custody

These HTTP edges accept only the minimal structural surface exposed by canonical
`CredentialSecret`:

`secret.use(value => ...)`

The raw token is revealed only while constructing the one provider request. It is never
returned in provider results, safe error codes or thrown error messages.

No source-controlled token/environment variable is introduced by this slice.

## WhatsApp Cloud API

`createWhatsAppCloudApiHttpEdge()` implements the existing
`WhatsAppCloudApiEdge` used by the durable outbound sender.

It sends POST requests to:

`https://graph.facebook.com/<version>/<phoneNumberId>/messages`

with the access token in the Bearer Authorization header.

Behavior:
- Graph API version must be explicit and version-shaped;
- request JSON is bounded before transport;
- 2xx returns the provider body to the existing accepted-response parser;
- non-2xx maps only numeric Graph error code or HTTP status to a bounded safe code;
- provider error message/detail is not surfaced;
- network/ambiguous transport failure throws a fresh redacted error so the durable
  outbound dispatcher keeps the send outcome uncertain and reconciles rather than
  blindly retrying.

## Telegram Bot API

`createTelegramBotApiHttpEdge()` implements the existing `TelegramBotApiEdge`.

It sends POST requests to the token-scoped Bot API method URL and JSON body.

Behavior:
- request JSON is bounded before transport;
- non-2xx and `ok:false` are explicit rejection;
- numeric Bot API `error_code` becomes a bounded safe code;
- provider descriptions are discarded;
- network/ambiguous failure throws a redacted error and does not expose the token-bearing
  URL.

## HTTP transport boundary

The edge receives a small `ChannelHttpTransport` rather than directly owning global
`fetch`. This keeps TLS/proxy/timeout/observability implementation in the deployment
composition while ensuring the token is only exposed at this credential edge.

A production transport must not log Authorization headers or Telegram token-bearing URLs.
Its errors may contain private details internally; these edges deliberately replace such
errors before they escape into outbound reconciliation.

## Existing durability

These modules do not send outside the canonical PR #92 durable outbox flow. The existing
outbound dispatcher still owns RequestId replay, provider-message binding, ambiguous-send
state and delivery reconciliation.
