# Provider Execution Adoption Boundary

Canonical owner: `packages/providers`
Decision: ADR-0010

## Purpose

This boundary turns cross-donor provider behavior into one Masanawa execution model. It is not a copy of ChatWithStars, OpenJarvis, OpenClaw or AIRI.

## Separation of responsibility

Domain/workflow packages own intent and truth:

```
workflow/domain
  -> capability request
  -> provider operation
  -> ProviderAttempt
  -> external system
  -> ProviderReceipt or ambiguous result
  -> reconciliation if required
  -> domain transition
```

The provider layer owns:
- adapter selection;
- credential resolution;
- request normalization;
- timeout/rate-limit/retry classification;
- readiness evidence;
- provider attempt/receipt evidence;
- reconciliation hooks.

It does not own:
- orders, balances, paid state;
- published social state;
- task completion;
- Character state;
- memory;
- permissions.

## Operation contract

Every provider operation must declare:

| Field | Meaning |
|---|---|
| capability | abstract thing the domain requests |
| effect | read / reversible write / consequential write / stream |
| auth | credential scope/type |
| timeout | provider call bound |
| retryClass | safe_read / provider_idempotent_write / reconcile_before_retry / never_automatic / stream_session |
| providerIdempotency | none / header / request field / provider reference |
| callerIdempotencyRequired | whether workflow key is mandatory |
| reconciliation | none / lookup / webhook / poll / operator |
| readinessRequirements | evidence keys that must be current |
| sensitivity | request/receipt data sensitivity |
| cost/rateLimit | accounting/throttle hints |

## Generic execution rules

Before call:
1. authorize workflow/tool operation;
2. resolve active provider policy;
3. verify current readiness requirements;
4. reserve canonical ProviderAttempt with workflow idempotency;
5. resolve scoped vault credential;
6. validate request against operation schema.

After call:
1. normalize provider result;
2. persist ProviderAttempt outcome;
3. persist unique ProviderReceipt when definitive;
4. if ambiguous, create reconciliation work instead of blind retry;
5. return evidence to owning domain/workflow;
6. domain code performs the actual canonical transition.

## Initial donor-to-contract mapping

### Flutterwave
- reads: `safe_read`;
- bill payment: `reconcile_before_retry`, lookup by bill/reference;
- transfer/payout: `reconcile_before_retry`, lookup by transfer ID/reference;
- virtual-account creation: provider reference + workflow request key; reconciliation required if request outcome ambiguous;
- webhook: verified provider inbox event, dedup before domain application;
- cutover: readiness evidence with fingerprint dependency invalidation.

### Telegram
- text: caller delivery key + existing-delivery lookup; ambiguous send must not be blindly repeated;
- document upload: explicitly `reconcile_before_retry` / needs-attention because timeout can occur after acceptance;
- provider message ID becomes transport receipt, not conversation truth.

### Google
- read operations: `safe_read`;
- one credential refresh retry on 401;
- calendar mutation: must run as `reconcile_before_retry` unless a stable provider/client request identity is added; donor implementation alone is insufficient.

### Gemini/model providers
- inference is non-authoritative proposal;
- rate/quota state belongs to provider routing;
- 429/403/404/503 handling is adapter-specific;
- retrying a model call is safe for domain truth only because result is not itself a committed side effect; cost accounting still records each attempt.

### JEV
- retryability classification belongs to adapter;
- durable retry scheduling belongs to workflow/decision executor;
- response schema validation precedes decision admission.

### Facebook/social providers
- publish operations require durable planned-post idempotency and provider receipt;
- resumable upload IDs are provider evidence;
- ambiguous finish/upload needs provider lookup or operator reconciliation before republish.

### Studio render providers
- external render job ID is provider receipt;
- workflow RenderJob remains canonical;
- poll/reconcile by external job ID; never infer completion from request success.

## Certification gate

A new provider cannot be production-certified until every consequential operation has:
- auth scope;
- current readiness check;
- retry class;
- idempotency requirement;
- reconciliation path;
- acceptance test;
- audit/redaction policy.

