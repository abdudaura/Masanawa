# Incoming Masana call signaling

Durable invitations use the existing current visible platform Masana roster,
consumer session authorizer, call history, paid/trial admission and push
registration contracts. Human contacts/personal Twins have no initiation path.

Consumer routes:
- `GET /v1/calls/incoming`: current account/persona-scoped ringing invitations.
- `GET /v1/calls/incoming/:callId`: authoritative invitation, including terminals.
- `POST /v1/calls/incoming/:callId/accept` or `/decline`: body `{}`; atomic replay-safe transition.
- `POST /v1/calls/incoming/:callId/token`: body `{admissionId}`; accepted invitation and canonical paid/trial admission required. Returns the existing ephemeral live voice grant with the same incoming history ID.

Server routes:
- `POST /internal/calls/incoming`: `{tenantId,userId,characterId,requestId,ringDurationMs?}`.
- `POST /internal/calls/incoming/:callId/cancel`: `{tenantId,userId,characterId}`.

Server routes require the separate `MASANAWA_INCOMING_CALLS_SERVER_TOKEN` bearer
credential. Missing configuration denies initiation/cancellation. Never expose it
to mobile clients. Recipient IDs are supplied by the trusted server runtime;
current platform roster eligibility is checked by SQL. `requestId` is scoped to
tenant/account; replay for a different character conflicts. Ring duration defaults
to 60 seconds, bounded to 1–120 seconds. First atomic terminal/accept decision wins.

Gateway sweeps server-clock expiry and one durable push lease every second.
FCM delivery uses existing account registrations, generic notification text,
metadata-only `masanawa://calls/incoming/<id>` hints and a 10-second shared network
deadline. Failed/partial/zero-recipient delivery remains retryable until expiry.
The invitation remains server truth; duplicate/late pushes never authorize media.
Flutter polls a passive account-scoped banner, refreshes on resume, and preserves
existing active call destinations when notifications are opened.

Acceptance records incoming history without proving a media connection. Existing
native connected/end reports remain informational, never billing proof. Token
setup is bounded to two minutes after ring expiry. A token request with unknown
provider outcome or lost post-mint persistence is permanently fenced from remint;
stale issuing leases recover to unknown and end informational history. Existing
paid-voice outbox handles interrupted reservation/completion recovery. Credentials
are not persisted. Unknown outcomes require a new explicit call rather than
silently issuing more credentials or authorizing more spending.

Additive migration `agents/0009_masana_incoming_calls.sql` preserves historical
outgoing call and financial records. Production migration/configuration, signed
Android/iOS FCM/APNs delivery, permission/background/cold-start behavior and real
provider calls have not been qualified by local tests. See the AF11 handoff.
