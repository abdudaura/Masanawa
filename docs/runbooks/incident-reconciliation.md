# Incident and reconciliation runbook

Use this runbook for availability, latency, no-signal, and reconciliation alerts produced by the Masanawa Ops readiness boundary.

## First response

1. Confirm the alert is based on current telemetry and identify the exact service, time window, request/correlation IDs, provider references, and reconciliation case IDs.
2. Acknowledge the incident. Do not mark it resolved merely because traffic falls or a provider dashboard looks healthy.
3. For consequential operations, stop blind retries when outcome is ambiguous. Preserve the original Operation, receipt and reconciliation evidence.
4. Check current service health, queue pressure, provider readiness, deployment health, and recent configuration/deployment changes.
5. Keep secrets, raw credential material, customer message bodies and other non-allowlisted data out of incident notes and telemetry.

## Reconciliation handling

- Canonical reconciliation state belongs to `packages/events` and its persistence owner. Ops observes and escalates; it does not edit ledger/payment/provider truth directly.
- `needs-attention` cases are operator work items. Verify provider evidence and external receipts before any compensating action.
- For ambiguous external effects, reconcile before retrying. Never create a second consequential dispatch merely to discover whether the first one succeeded.
- Resolve a case only when canonical evidence supports the final outcome and any required compensation/receipt is recorded through the owning domain.

## Mitigation

Prefer reversible mitigation: disable a faulty provider/route, reduce admission, pause a risky feature, or roll back a known bad deployment/configuration through its normal control plane. Record the exact action and correlation evidence.

## Resolution

An incident moves open → acknowledged → mitigated → resolved. Resolution requires restored SLO signal and, when reconciliation alerts were involved, a bounded active backlog with no unexplained stale/needs-attention cases above policy.

## Follow-up

Capture root cause, affected window, user/business impact, missing telemetry, reconciliation defects, and one or more prevention actions. New monitoring or policy changes should be versioned and reviewed rather than edited silently during the incident.
