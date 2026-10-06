# Production Security Hardening

Status: Task 145 reusable hardening foundation. This document is **not** production
security sign-off. Final Task 145 completion requires executing the full matrix against
the exact converged release candidate and production-like infrastructure.

## 1. Public projection audit

`packages/security/src/public-projection-audit.ts` provides a bounded fail-closed
security audit for data that is intended to leave a trusted service boundary or appear
in customer/admin-safe projections.

It detects:

- credential-bearing field names such as access/refresh tokens, API keys, secrets,
  authorization/cookie material, private keys and credential ciphertext/plaintext;
- high-confidence private-key, bearer/JWT, GitHub, AWS and provider API-key material;
- HTTP(S) URLs containing username/password credentials;
- cyclic, non-plain, non-JSON or non-finite structures;
- attacker-controlled projections that exceed depth/node traversal bounds;
- cross-Tenant records in an explicitly Tenant-scoped projection.

It deliberately allows safe metadata such as CredentialRef IDs, fingerprints, hashes,
provider/status/version metadata and token-count telemetry.

This audit is defense in depth. It does not replace domain-specific allowlist projections,
Security credential storage, transport authentication or log redaction.

## 2. Required abuse matrix

| Abuse case | Required invariant | Existing isolated evidence | Release-candidate execution still required |
| --- | --- | --- | --- |
| Cross-Tenant read/write | every record, command and evidence ref is bound to the authenticated Tenant | canonical ID/scope guards across domains; Task 145 public-record guard | run customer/admin/API matrices with Tenant substitution across every exposed route |
| Authority substitution | User/Character/Device/provider evidence cannot manufacture approval/authority | Security AuthorityContext/approval/device/plugin grant contracts | replay real production requests with forged Principal, Character, Device and approval IDs |
| Replay with changed payload | same RequestId/Operation/idempotency identity cannot bind different effects | Tool/Workflow/channel/Commerce/device/social replay contracts | restart services and resend exact/changed requests through real queues/providers |
| Secret projection/log leak | plaintext credentials/tokens/private keys never leave Security/provider edge | Task 145 projection audit + credential-reference architecture | scan production logs, traces, errors, Ops/admin projections and mobile/network captures |
| SSRF / private-network bridge | externally supplied endpoints cannot reach metadata/private control planes | provider/plugin bridge URL constraints where implemented | enforce and test DNS-resolution/egress firewall against RFC1918, link-local and metadata after resolution |
| Callback/webhook forgery | unauthenticated/replayed provider callbacks cannot settle authority or money | channel/provider signature/evidence contracts | hit live webhook routes with missing/wrong signatures, stale/replayed and payload-substitution cases |
| Self-payment / value laundering | Customer Credits/Agent Float cannot become withdrawable earnings via self-routing | Commerce anti-self-earning + Task 134 withdrawal guards | execute same-user clone purchase/refund/fallback cycles against durable ledger/payout stack |
| Plugin capability escalation | requested capability is not a grant; bridge/plugin cannot silently expand authority | Tasks 139–144 Plugin manifest/grant/bridge/isolation contracts | run loader/process sandbox tests with malicious plugins, filesystem/network/process escape attempts |
| Device stale credential / reassignment | stale device generation/credential/assignment cannot execute after rotate/revoke | Tasks 104–107/124–125 contracts | rotate/revoke while device is offline, reconnect/replay after restart and replacement |
| Social account impersonation | social publication stays bound to the linked account + originating Character | Tasks 131–132 + Task 137 identity-consistency contracts | publish/retry/reconcile with account/Character/version substitutions through real provider adapter |
| Memory/privacy scope leak | Relationship/private Memory and owner-session privacy cannot cross User/Relationship boundaries | Memory/Teaching/owner-session/privacy contracts | multi-user/device/channel session tests against production persistence/cache |
| Proactivity abuse | quiet hours/frequency/privacy and world-event scope remain server authoritative | Tasks 113–118 contracts | schedule/clock/timezone/restart tests through real worker/notifications |
| Financial ambiguity | unknown provider outcome cannot be blind-retried | billing/crypto/device/social/Commerce reconciliation contracts | kill connectivity immediately after real provider dispatch and prove requery-before-retry |
| Output injection | provider/plugin/tool output cannot grant permissions or execute hidden follow-up effects | typed bounded output contracts | malicious remote/provider payloads through production composition and UI renderers |

## 3. Secret-leak release gate

For every externally visible projection/log/trace sample collected during the pilot:

1. run the domain's explicit safe projection first;
2. run `assertPublicProjectionSafe(...)` on test/pilot fixtures where the shape is JSON-like;
3. verify raw request/response bodies are not emitted into general logs;
4. verify credential metadata exposes only opaque refs/status/fingerprint-safe fields;
5. inspect mobile HTTP/WebSocket captures for provider keys, admin tokens and internal service credentials;
6. inspect failure paths, stack traces and provider error wrapping as aggressively as success paths.

Any detected plaintext credential, private key, bearer/session token or credential-bearing
URL is release-blocking.

## 4. Tenant-isolation release gate

Task 145 is not complete until at least two real test Tenants exercise every production
surface that returns Tenant-owned data. For each surface:

- valid Tenant A request returns only A;
- replacing any Tenant/User/Relationship/Character/Device/Operation ID with a Tenant B
  object fails closed;
- pagination cursors, replay receipts, callback IDs and cached results cannot cross scope;
- background workers and scheduled tasks preserve Tenant binding after restart;
- admin/Ops queries require an authorized operator scope and cannot use caller-selected
  Tenant IDs as authority.

## 5. Completion rule

Task 145 may move to **complete** only when all of the following are true:

- the exact release candidate is converged;
- full security/architecture/contract suites execute successfully rather than failing
  before checkout;
- abuse matrix cases are executed against production-like services and durable stores;
- live provider/device/channel ambiguity and callback-forgery tests are evidenced;
- secret scanning covers logs/traces/admin/mobile/network captures;
- unresolved findings have owners, severity and release disposition;
- no critical/high isolation, authority, secret or value-integrity finding remains open.

Until then the correct state is **HARDENING FOUNDATION IMPLEMENTED /
PRODUCTION SECURITY SIGN-OFF PENDING**.
