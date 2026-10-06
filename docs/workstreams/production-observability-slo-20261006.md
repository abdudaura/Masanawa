# Production observability/SLO/incident operations foundation — Task 147

Owner/window: current ChatGPT continuation window — Task 147
Branch: `work/production-observability-slo-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Production task: 147 — observability/SLOs/alerts/runbooks/incident and reconciliation operations.

## Exact owned paths

- `packages/telemetry/src/slo.ts` (new)
- `tests/contracts/telemetry-slo-alerts.test.ts` (new)
- `docs/PRODUCTION-OPERATIONS-RUNBOOK.md` (new)
- `docs/workstreams/production-observability-slo-20261006.md`

## Explicitly excluded/shared paths

- existing Telemetry index/attributes/correlation files;
- Task 142 evaluation files;
- Gateway/Worker/Presence/Ops/mobile and PR #136;
- production dashboards, alert transports, PagerDuty/Slack/email;
- deployment/autoscaling infrastructure and secrets;
- provider/device/channel concrete reconciliation workers;
- Tasks 148–150 recovery/pilot/cutover.

## Implementation boundary

- versioned SLO definitions over privacy-safe aggregate good/total evidence;
- deterministic error-budget burn-rate evaluation with minimum-sample and stale-evidence gating;
- warning/critical alert decisions are data only, never side-effect authority;
- bounded reconciliation queue health evaluation for pending/unknown/manual-review volume and oldest age;
- no prompts, payloads, credentials, user content or raw provider bodies in alert evidence;
- operator runbook defines severity, triage, reconciliation, rollback/escalation and evidence requirements;
- production Task 147 remains incomplete until real metrics/exporters/dashboards/alert transports and incident drills execute on the converged candidate.

State: CLAIMED. Implement SLO/alert contracts, focused tests and the production operations runbook.
