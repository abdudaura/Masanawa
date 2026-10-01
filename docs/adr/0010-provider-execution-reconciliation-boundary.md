# ADR-0010 — Canonical Provider Execution and Reconciliation Boundary

Status: accepted
Date: 2026-10-01

## Context

Phase 0B ChatWithStars remediation exposed a recurring failure in donor architectures: each integration independently invents credential checks, retry rules, idempotency, readiness, health, receipts and reconciliation.

Examples:
- Flutterwave distinguishes configuration, current live cutover evidence, provider acceptance, side-effect ambiguity and reconciliation.
- Telegram deliberately avoids automatic retry for document delivery because a timeout may occur after provider acceptance.
- Google OAuth retries exactly once after an HTTP 401 by refreshing credentials.
- Gemini uses model/project scoped cooldowns, persisted quota state, bounded transient retries and fallback routing.
- JEV classifies retryable transport/status failures but leaves durable retry scheduling to the caller.
- Facebook upload sessions expose provider object/session identifiers but currently lack a complete ambiguous-publish recovery contract.
- ComfyUI exposes long-running external jobs whose result must be reconciled from prompt/job state rather than inferred from request completion.

Copying those implementations independently would reproduce inconsistent behavior and duplicate authority.

## Decision

Masanawa will have one canonical provider execution boundary owned by `packages/providers`.

A Provider is an external capability adapter. It never owns Character, memory, workflow, commerce, social, studio or world truth.

Provider implementations register capabilities and operation descriptors. Domain/workflow code invokes providers through canonical operations.

### Canonical concepts

`ProviderDefinition`
- provider key/version;
- capability families;
- environment(s);
- supported auth schemes;
- supported operation descriptors;
- provenance/license metadata.

`ProviderCredentialRef`
- opaque vault reference;
- tenant/org/user/device scope;
- environment;
- expiry/rotation metadata;
- fingerprint only where correlation is needed;
- never raw secret in domain records.

`ProviderOperationDefinition`
- operation key and capability;
- read-only vs side-effecting;
- timeout;
- retry class;
- provider idempotency support;
- required caller idempotency key;
- reconciliation strategy;
- sensitivity;
- cost/rate-limit hints;
- readiness requirements.

`ProviderReadinessEvidence`
- requirement key;
- observed value/fingerprint;
- verified_at;
- expires_at;
- verifier;
- dependency links;
- invalidation reason.

`ProviderAttempt`
- operation;
- workflow/domain correlation;
- caller idempotency key;
- request fingerprint;
- attempt number;
- started/completed times;
- classified result;
- provider reference/request ID when available;
- redacted error/evidence.

`ProviderReceipt`
- stable provider-side result evidence;
- provider reference/object ID;
- normalized outcome;
- raw payload reference/hash;
- observed_at;
- verification method.

`ProviderReconciliation`
- operation/correlation;
- prior ambiguous attempt;
- lookup strategy;
- observed provider state;
- normalized outcome;
- reconciliation timestamp/evidence.

## Retry classes

The platform does not apply a single retry policy to all providers.

1. `safe_read`
   - may retry boundedly on transient transport/429/5xx according to provider hints.

2. `provider_idempotent_write`
   - retry allowed only when the provider accepts a stable idempotency/request key with documented replay semantics.

3. `reconcile_before_retry`
   - timeout/network failure after request dispatch is ambiguous;
   - do not repeat automatically;
   - schedule reconciliation using provider reference/request fingerprint;
   - retry only after reconciliation proves no side effect occurred or provider contract explicitly permits replay.

4. `never_automatic`
   - destructive/non-repeatable action with no reliable reconciliation;
   - surface needs-attention/HITL.

5. `stream_session`
   - reconnect/resume semantics are provider-specific and must be declared separately from business retries.

## Normalized result classes

Provider calls normalize to:
- `succeeded`
- `pending`
- `failed_terminal`
- `failed_retryable`
- `ambiguous`
- `rejected_policy`
- `rejected_auth`
- `degraded`

Domain packages decide state transitions. A provider adapter cannot mark a business order paid/delivered/published by itself.

## Idempotency

Idempotency is layered:

- workflow operation idempotency key — canonical caller authority;
- provider idempotency/reference — external replay identity where supported;
- ProviderAttempt uniqueness — prevents duplicate concurrent execution;
- ProviderReceipt uniqueness — prevents duplicate domain application;
- delivery/event inbox uniqueness — protects webhook/outbound edges.

A provider-specific key never replaces canonical workflow idempotency.

## Reconciliation

Every side-effecting operation must declare one of:
- direct receipt is definitive;
- provider lookup by reference/object ID;
- provider event/webhook reconciliation;
- no reliable reconciliation -> `never_automatic`.

Unknown/timeout is not success and not automatically failure.

## Readiness and acceptance

Configuration, readiness and acceptance are separate:

- configured: credentials/settings exist;
- ready: current prerequisites are observed healthy;
- accepted: required end-to-end production journey has recent evidence.

Readiness evidence can depend on other evidence and invalidates transitively when credentials, webhook secrets, egress/network fingerprints, provider environment or capability configuration changes.

This generalizes the strong Flutterwave cutover behavior to all consequential providers.

## Credential scope

Credentials are vault references with explicit scope. Provider adapters receive decrypted material only at execution time. Raw credentials must not enter:
- workflow/domain state;
- traces;
- model context;
- audit logs.

## Domain ownership examples

- Commerce owns order/payment/ledger truth; payment provider returns receipts/evidence.
- Social owns planned/published post lifecycle; social providers return publish receipts/status.
- Studio owns render jobs/assets; media providers return job/result receipts.
- Decisions owns typed decision records; model/JEV providers return evaluated output/evidence.
- Gateway/presence owns message/session state; channel/realtime providers return transport receipts/session references.

## Donor synthesis

Adopt behavior, not donor boundaries:
- ChatWithStars Flutterwave: evidence freshness, provider event inbox, uncertain-state reconciliation, current cutover validation.
- ChatWithStars Telegram: pre-send idempotency lookup; no blind retry after ambiguous upload timeout.
- ChatWithStars Google: bounded 401 token-refresh retry.
- ChatWithStars Gemini: persisted route/quota state, per-model cooldowns, bounded transient retries, health evidence.
- ChatWithStars JEV: explicit retryability classification + schema validation.
- OpenJarvis/OpenClaw/AIRI: provider registry/adapter separation and runtime-neutral capability descriptions.

## Consequences

- No provider may invent its own business state machine.
- No generic middleware may blindly retry all POST/side-effect requests.
- Provider adapters must declare ambiguity/reconciliation behavior before production certification.
- Ops can display configuration, readiness, acceptance, failure and reconciliation through one model.
- Provider replacement becomes possible without rewriting domain workflows.

## Rejected alternatives

- Keep provider logic inside each domain service: duplicates failure policy and makes replacement difficult.
- Adopt one donor provider framework wholesale: none models Masanawa's domain/reconciliation requirements completely.
- Treat all HTTP 5xx/timeouts as retryable: unsafe for consequential writes.
