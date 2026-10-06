# Production Incident and Reconciliation Runbook

Status: Task 147 operational baseline.

## Purpose

Use this runbook when Masanawa reports degraded SLOs, an ambiguous external side effect, or a provider/device result that cannot yet be classified as succeeded or failed.

## First response

1. Preserve the exact Tenant, Operation, request/correlation, provider/device and time-window identifiers.
2. Do not copy raw prompts, access tokens, credential material, payment secrets or private message bodies into incident notes or alerts.
3. Stop new admission only when the affected capability or dependency is demonstrably unsafe; do not broaden an incident into unrelated Tenants.
4. For an Operation in `unknown`, `partial` or reconciliation state, **do not redispatch the side effect** merely because the client timed out.

## Ambiguous Operation reconciliation

1. Load the canonical Operation and verify Tenant, operation kind, idempotency key, authority-scope hash and request fingerprint.
2. Gather provider/device evidence using the exact provider reference, dispatch key, external receipt or other bounded reference already attached to the Operation.
3. Compare evidence against the original canonical request. A changed request must not reuse the original idempotency identity.
4. If evidence proves the side effect happened, record the verified receipt and settle the canonical Operation forward.
5. If evidence proves the side effect did not happen and policy permits retry, create the next bounded attempt under the canonical reconciliation flow.
6. If evidence remains ambiguous, keep the Operation non-terminal and escalate; never infer success or failure from absence of a callback alone.

## SLO response

- **healthy**: no incident action.
- **ticket**: create an operational ticket, inspect dependency saturation and trend the affected SLO window.
- **page**: page the on-call owner, consider bounded admission reduction/circuit breaking, and begin an incident timeline.

The alert payload should contain only SLO key, service, window, counts, target, burn rate, alert level and correlation-safe identifiers. It must not contain raw user content or secrets.

## Tenant isolation during incidents

Every query, repair, reconciliation or replay must remain scoped to the exact Tenant. Operator or manage-other authority does not authorize cross-Tenant mutation. Bulk repair tooling must require an explicit Tenant set and dry-run evidence before mutation.

## Closure evidence

Before closing the incident:

- affected Operations are terminal or intentionally left in a tracked reconciliation state;
- SLO burn has returned below the incident threshold;
- no blind retries or duplicate financial/device effects were introduced;
- any temporary admission/circuit-breaker change is reverted or documented;
- a follow-up issue records root cause, remediation owner and regression test/runbook update.
