# Masana call history backend

This milestone records outgoing Masana voice attempts. It does not implement
incoming ringing, group-call orchestration, or provider disconnect. Mobile recents
now consumes this contract through `apps/mobile/lib/src/calls/call_history.dart`
and the existing Calls screen, with session-fenced pagination and retry.

## Contract

- `POST /agent/live/token`: existing authorized endpoint. Successful issuance
  now persists an outgoing attempt and adds `callId` to the response when the
  default database/history dependency is configured. Provider failures do not
  create successful attempt records. Storage failure prevents returning a token.
- `GET /v1/calls?limit=30&cursor=...`: returns `{ calls, nextCursor }`.
  Limit is 1–50. Opaque keyset cursors use creation time and call ID, ordered
  newest first. Authentication supplies account and tenant; neither is accepted
  from the request. Directory restrictions also constrain results.
- `GET /v1/calls/:callId`: returns an account-scoped record or 404.
- `POST /v1/calls/:callId/connected`, body `{}`: reports local media setup.
- `POST /v1/calls/:callId/end`, body `{}`: reports local connection closure.
  This endpoint records history; callers must close the media connection locally.
  It does not revoke a provider token or perform financial settlement.

Records include `callId`, `characterId`, server-sourced `displayName`,
`direction: outgoing`, `kind: audio`, `state`, `createdAt`, `connectedAt`,
`endedAt`, `expiresAt`, and `connectionEvidence`.

States are `connecting`, `active`, `ended`, or `expired`. Issuing a token is
not proof of connection. `active` means a client reported connection;
`connectionEvidence: client_report` makes that explicit. `expired` means the
credential window elapsed without an end report, not verified media termination.
Duplicate reports preserve timestamps. Late connection reports cannot reopen
ended or expired attempts. No client report authorizes or proves billing.

## Identity and storage

The current Masana roster is existing `agents.platform_agent_profiles` joined
to visible `agents.agent_presentations`. Consumer calls to retired personal
Twins are rejected when this production dependency is configured. Human
contacts cannot create these records. Removing a persona from the visible
roster removes it from this projection without erasing historical storage.

Append-only migration: `agents/0007_masana_call_history.sql`. The existing
agents migration root discovers it automatically. Existing financial tables
and historical migrations remain unchanged. History stores no credentials,
audio, transcripts, quotes, charges or verified usage.

## Verification and remaining qualification

Focused tests cover actual Gateway route registration, account/tenant and roster
fencing, invalid/forged fields, cursor validation, server-token persistence,
provider/storage failures, SQL pagination, concurrent lifecycle reports,
expiry, runtime migration discovery and checksum-preserving migration reruns.
SQL tests create and remove their own local PostgreSQL database.

Next connected milestone: parse the optional grant `callId` on mobile; report
connection after Gemini setup completes, report closure after local teardown;
keep the implemented recents up to date after those events. Keep these reports separate
from existing billing admission/settlement. Incoming/group calls need explicit
participant admission, signaling, provider revocation and device push proof.
Production release also requires retention/account-deletion policy integration,
real provider/device verification and deployment/migration qualification.
