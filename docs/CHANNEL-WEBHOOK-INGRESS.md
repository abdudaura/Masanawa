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
- Compose `DurableChannelActionStore` against canonical server action state and then
  route `ResolvedChannelAction` to the owning action/domain service. Transport-side
  account/subject/conversation/revision/expiry/RequestId reconciliation is now implemented
  in this adapter; canonical User/Relationship/transaction authority and domain
  idempotency remain with their owners. Display labels or opaque IDs never authorize
  purchases, and a new callback update is not automatically a new financial intent.
- Download account-scoped media through an authorized provider edge with MIME/size/
  retention/permission checks. No voice transcription is introduced.
- Compose the new `DurableChannelOutbox` with canonical storage and inject concrete
  WhatsApp/Telegram provider senders. The adapter-side persist-before-dispatch,
  no-blind-resend and explicit ambiguity-resolution contract is now implemented.
  Provider delivery statuses should reconcile that outbox where applicable; delivery
  evidence still cannot settle Commerce.

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


## Opaque callback action reconciliation

The messaging adapter now includes a provider-neutral action reconciliation seam after
durable ingress. It still does not execute any domain action.

`DurableChannelActionStore` resolves an opaque provider `selectionId` to server-owned
action state and durably records the exact ingress observation while the action binding
is still current. `createChannelActionReconciler()` enforces:

- only a durably normalized message with `content.kind = selection` may enter;
- binding channel + ChannelAccountId must match the verified ingress account;
- exact external subject system/namespace/value/kind must match;
- exact conversation system/namespace/value/kind must match;
- the server binding supplies the canonical RequestId, action key and revision;
- action expiry is checked against the trusted server receipt time;
- observation persistence is keyed by ingress dedupe/evidence identity;
- exact provider retry returns `replay: true` with the same canonical RequestId;
- the store must atomically verify binding key + revision when admitting the observation;
- if the binding changes between load and durable observation, reconciliation fails closed;
- storage failures are redacted and retryable.

The returned `ResolvedChannelAction` is routing evidence only. It never grants Tool,
Commerce, approval, Teaching or other domain authority. The owning server action service
must revalidate current canonical authority and execute through its existing idempotent
command path.

This seam supports staged Teaching callbacks without importing Teaching into the channel
adapter: a Teaching owner can bind each compact stage callback to its server action
revision/RequestId, while Commerce or approval owners can use the same transport contract.


## Durable outbound delivery contract

The adapter now also defines a provider-neutral outbound custody protocol for text,
audio references and bounded opaque-option replies.

`createChannelOutboundDispatcher()` enforces:

1. normalize and fingerprint the exact canonical RequestId payload;
2. durably admit the outbox request before provider work;
3. atomically claim `pending -> dispatching` before calling a provider;
4. explicit provider acceptance must be persisted as `sent` with provider message ID
   and acceptance time before success is returned;
5. explicit provider rejection becomes terminal `failed`;
6. thrown/uncertain provider outcomes become `unknown` where possible;
7. replay of `dispatching` or `unknown` is blocked with reconciliation required;
8. replay of `sent` returns the durable receipt without another provider call;
9. replay of `failed` does not silently retry.

`resolveChannelOutboundAmbiguity()` accepts explicit reconciliation evidence and can
resolve an uncertain send to either:
- `sent` with provider message ID + accepted timestamp; or
- terminal `failed` when there is evidence the provider did not send.

Reconciliation never performs provider redispatch. A new send after proven not-sent must
be a deliberate domain decision, not an automatic retry of an uncertain request.

Provider-neutral option output is bounded to 10 choices and callback IDs are limited to
64 UTF-8 bytes so the shared contract remains compatible with Telegram callback data and
bounded WhatsApp interactive identifiers. Audio output carries only an authorized opaque
file reference + MIME type; the channel adapter does not fetch or own media bytes.

Remaining implementation is concrete provider sender translation/HTTP edges, durable
outbox persistence, delivery-status reconciliation and Gateway composition.


## Delivery-status custody

`createChannelDeliveryReconciler()` binds normalized provider delivery statuses back to
the exact canonical outbound RequestId without treating delivery as business settlement.

The durable store resolves provider message ID within the verified channel account and
the reconciler additionally checks exact recipient identity. The delivery observation is
persisted using the ingress dedupe/evidence identity while the outbound binding revision
is still current. Exact webhook replay returns `replay: true`; provider-message or
recipient substitution, unknown messages and binding revision races fail closed.

`sent`, `delivered`, `read` and `failed` remain transport evidence. They do not
prove payment, fulfillment, Teaching progress, approval execution or any other domain
success. Domain owners may use this evidence only through their own reconciliation
policies.
