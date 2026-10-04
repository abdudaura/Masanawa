# WhatsApp and Telegram webhook ingress

Status: bounded adapter implementation on the channels workstream, not deployed.
Tasks 097–102/108 remain open. Current roadmap Task 072 is unchanged.
Ownership and handoff: docs/workstreams/channels.md; draft PR #92.

## Implemented surface

`@masanawa/messaging-channels` lives at `adapters/channels/messaging`.
Registration is explicit, with no import-time behavior, runtime, store or scheduler.
It depends inward only on the public `@masanawa/contracts` entrypoint.

| Input | Normalized transport evidence |
| --- | --- |
| WhatsApp text | External message ID, sender/conversation, text, timestamp and optional reply ID |
| WhatsApp audio/image/video/document | Provider file ID, media kind, optional MIME/caption; no fetch |
| WhatsApp button/list/template reply | Opaque selection ID; labels do not grant authority |
| WhatsApp sent/delivered/read/failed | Separate delivery evidence, not a user turn or financial receipt |
| Telegram private text/media/photo | External update/message/sender/conversation IDs; largest valid photo reference |
| Telegram edited message | Distinct update evidence with original message ID and edit marker |
| Telegram private callback | Sender, configured originating bot, conversation, callback ID and opaque selection |
| Unsupported direct message | Bounded unsupported marker for an explicit recovery response |
| Telegram groups/channels/bots/inline callbacks and unrelated updates | Explicit ignored count; no private admission |

The private-only Telegram scope is intentional for this slice. Group, guest,
business-account, forum/topic and new rich-message operations require explicit
subsequent policy and coverage. WhatsApp Cloud API is the implemented transport;
linked WhatsApp Web sessions, calls and other transport choices are not implemented.

## Verification and limits

WhatsApp subscription verification requires the configured verify token and subscribe
mode; the challenge is a bounded numeric string. POST verification uses HMAC-SHA256
over the exact raw body and the configured app secret. The signature header must be
one scalar value with the expected format. An authenticated request still must match
the configured WABA and receiving phone-number ID throughout the batch.

Telegram requires the dedicated setWebhook secret_token header, compared in constant
time through fixed-size SHA256 digests. It never treats a Bot API token, username,
phone number, label or client-supplied canonical ID as proof of identity. A private
conversation must match the sending user's numeric ID. Callback messages must be
authored by the configured bot; inline/game callbacks do not become private turns.
Callback selection data is bounded to the provider's 64-byte limit.

Bodies are copied before hashing/parsing, bounded to 1 MiB and decoded as strict UTF-8.
Each delivery has at most 128 normalized records, with bounded nested arrays, text
and references. Unsafe numeric IDs, malformed supported events and mixed/conflicting
event identities reject before persistence. Exact duplicate events in one batch
coalesce. Media references are not URLs and are never downloaded by this adapter.
Secret/header values, raw payloads, contact names, usernames, quoted content, filenames,
provider error messages and account profile fields are not copied to result evidence.

Canonical ExternalSubjectRef and ChannelConversationRef are copied and frozen.
Subject authenticationStrength is always transport-verified; linking must be separately
proved through Identity. Transport authenticity is not current account/tenant authority.

## Durable custody and replay contract

The required injected `DurableChannelAdmission.admitBatch` port has no default:

1. The complete transport batch is verified and normalized before the first port call.
2. Gateway must establish the configured ChannelAccountId's current lifecycle, tenant
   and admission policy from authoritative storage. Never derive those from payload text.
3. The Gateway implementation transactionally persists the normalized records and
   canonical dispatch/outbox custody, or reconciles an already persisted delivery.
4. Uniqueness is by account-scoped `dedupeKey`; `evidenceHash` verifies the same evidence.
   A duplicate with changed evidence is a conflict, never a new turn.
5. Return persisted or duplicate only when every unique record has durable custody.
   Returning queued/in-memory success is invalid. A mixed new/duplicate batch may
   report persisted after the complete transaction commits.
6. Only then does receive return HTTP 200. Storage rejection or invalid port outcome
   becomes a redacted, retryable channels.persistence_unavailable error.

Telegram keys use exact update_id, not a highest-seen watermark. Out-of-order and
post-inactivity update numbering must remain acceptable. WhatsApp messages use the
external message ID; delivery keys also distinguish status and provider timestamp.
Keys include the canonical channel account. Normalized evidence hashes exclude local
receipt/observation times, so retry timing and JSON whitespace cannot create a new turn.
Same key plus altered normalized evidence must fail closed in durable storage.

Partial admission is not a supported success. If a port implementation can fail after
partially persisting, retries must reconcile every per-event key without duplicating
dispatch. The preferred integration is one atomic transaction for the full batch.
Separate-session DB concurrency, crash/restart and outbox delivery are not qualified
by these adapter tests. No process-local replay cache is used.

## Gateway and cross-window dependencies

The integration owner must:

- Add the new package importer for @masanawa/contracts to pnpm-lock.yaml in its shared
  lock reconciliation. This window does not own that file. Frozen workspace install
  is not yet a passing integration gate for this new package.
- Register composition/routes explicitly and supply bounded original raw bytes,
  scalar signature/secret headers and a trusted server receipt clock. Preserve raw
  bytes before Fastify JSON parsing. Require HTTPS, supported content type/encoding,
  ingress rate limits and request-body limits before buffering.
- Map authentication to 401/403, invalid input to 400/413, durable admission failure
  to 503 and completed admission/intentional ignored events to 200. Do not convert
  rejected persistence into HTTP success or log private payloads/secrets.
- Obtain app secrets, subscription verification tokens and dedicated Telegram webhook
  secrets through Security-owned custody/composition. Keep secrets out of paths/URLs,
  checked-in environment examples and response bodies; register needed environment
  inputs only through the designated composition owner.
- Revalidate channel account revocation on every admission. Account-specific WhatsApp
  adapters reject mixed-account batches: a multi-account dispatcher must authenticate
  and preserve raw evidence before explicit routing, never re-sign or trust split JSON.
- Persist and dedupe ingress through canonical Events/Gateway ports, resolve proof-based
  linked Identity, recheck current authority and deterministically resolve the existing
  Character/Relationship/CharacterSession. No automatic User linking by phone/ticker/name.
- Route edits through explicit continuity/context revision semantics; do not treat edits
  as new purchase confirmation or falsely claim historical server context was erased.
- Resolve callbacks against the canonical server action state, scoped to User,
  Relationship/conversation, transaction, revision, expiry and RequestId. Display labels
  or opaque IDs never authorize purchases. A new callback update is not automatically
  a new financial intent; financial idempotency remains in Commerce.
- Download account-scoped media through an authorized provider edge with MIME/size/
  retention/permission checks. No voice transcription is introduced.
- Deliver replies/audio/options/status/receipts through canonical durable outbox
  custody, including answerCallbackQuery as appropriate. Reconcile ambiguous outbound
  sends; no blind resend. Delivery evidence cannot settle Commerce.

These requests are dependencies for PR #89/integration and the Commerce/action owners,
not ownership transfer. This window edits no existing Gateway/mobile/financial paths.

## Validation and known gaps

The channels implementation passed strict adapter typecheck, declaration-bearing
production build and 72 tests across ingress, adapter boundaries, public API lifecycle,
package boundaries and no-reference imports.

The full architecture + ingress run passed 112 tests and failed one existing environment
registry check: main's apps/ops/src/app/page.tsx reads NEXT_PUBLIC_OPS_API_BASE_URL,
but config/production-env.json does not register it. Both source/registry were checked
against exact main blobs. No environment registry changes are owned by this claim.
Do not interpret this as a passing full repository gate.

Provider fixtures and injected persistence prove adapter behavior, not a live channel,
real DB dedupe, account linking, Gemini audio, purchase, teaching or physical phone journey.
No deployment, webhook subscription, outbound send, task closure or public launch is claimed.

## Protocol references

- Telegram Bot API: https://core.telegram.org/bots/api (Update, Message, CallbackQuery,
  setWebhook, secret_token and callback_data).
- Meta's WhatsApp SDK webhook verification reference:
  https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/
- WhatsApp webhook payload examples:
  https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages

Official Telegram/Meta verification references were read on 2026-10-04. These references
describe transport contracts, not production account access or provider qualification.
