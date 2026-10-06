# Observability/SLO/alerts/runbooks/incident/reconciliation ops — Task 147

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/ops-slo-incident-runbook-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`

## Task references
- `docs/PRODUCTION-MASTER-TASKS.md` — **147** Complete observability/SLOs/alerts/runbooks/incident and reconciliation operations.
- Canonical reconciliation state remains owned by `packages/events`; Ops observes/escalates only.

## Owned paths
- `services/ops/src/operational-readiness.ts` (new)
- `tests/contracts/operational-readiness.test.ts` (new)
- `docs/runbooks/incident-reconciliation.md` (new)
- `docs/workstreams/ops-slo-incident-runbook-20261006.md`

## Excluded/shared paths
- No reconciliation mutations, Gateway/Worker instrumentation changes, alert-provider integration, app/ops UI, package manifests/lockfile, migrations or production monitoring configuration.
- No synthetic alert is treated as a production incident without observed evidence.

## Current state
CLAIMED. Implement deterministic SLO evaluation, burn/latency/no-signal/reconciliation alerts, explicit incident lifecycle tied to runbooks, and a concrete reconciliation escalation runbook.