# Private Masana group calls

Compose `createPostgresGroupCallRepository(pool)`, then
`createGroupCallService({ repository, authorizer, liveVoiceTokens,
paidAdmissionConfigured, validateAdmission })` and `registerGroupCallRoutes(app, service)`.
`authorizer` is the existing agent directory authority. `liveVoiceTokens` must use
the existing paid voice admission gate and call-history recorder. Set
`paidAdmissionConfigured` from the real gate's presence; false fails closed.
`validateAdmission` must independently verify the canonical paid admission's
account, tenant, participant, expiry and unsettled state. Non-support participants
fail closed when it is absent. Free support eligibility comes only from the server
platform profile's `support_agent`, never client flags.
Map `GroupCallError.statusCode` in the Gateway error handler.

Creation stores an account/tenant-fenced request key and canonical selection; it
never calls providers or financial services. Group and child records store no
credentials. Child history supplies active/failed state from native reports.
Removal and end close informational child history and prevent later grants.
They do not independently settle billing or revoke an already delivered provider
token; clients must tear down active media.

Token issuance locks the group row across existing admission/mint and verifies
current platform visibility before and after mint. Remove/end take that same lock.
The provider wait is bounded to 30 seconds (repository option `mintTimeoutMs` is
available for tests). A timed-out grant is never returned. Late or rejected child
history is closed with best-effort account-fenced cleanup; history expiry remains
its fallback if cleanup fails. The underlying existing provider service cannot be
aborted by this repository. The pool must allow at least two connections because
existing mint records child history on its own connection.

Tests use an isolated temporary database created from
`MASANAWA_TEST_DATABASE_URL`, apply only the relevant migrations, then drop it.
They require local PostgreSQL create-database rights; no live providers are used.
The repository exposes `drainBackground()` for graceful shutdown after outstanding
mint callbacks finish; tests drain it before closing the pool and dropping their
database.
