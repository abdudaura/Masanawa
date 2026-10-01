# ADR-0010: Entitlements, Usage Reservation and Autonomy

Status: accepted
Date: 2026-10-01

## Decision

Access/trial/subscription/paid-community entitlements are deterministic domain state, independent of model reasoning.

Usage is reserved idempotently against a source request/message and transitions through reserved -> delivered or released/blocked so failed delivery need not consume allowance permanently.

Subscription price/version/payment/period state is durable and auditable.

Autonomy is a separate authorization policy:
- mode;
- per-action amount;
- daily spend/cost caps;
- notification/escalation;
- capability/action class.

Model or JEV intent cannot exceed these limits.

Paid community/service fulfilment may enter manual-required/uncertain states; absence of sufficient channel/contact evidence never becomes fabricated success.
