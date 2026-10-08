# U27 — agent operations admin claim and handoff

- Claim UTC: 2026-10-08T19:17:00Z; 5-minute lease on exact new paths. Renew by substantial commits.
- Owner: isolated U27 implementation, branch `work/u27-agent-admin-control-20261008-gpt6`, base `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Exclusive proposed paths: `apps/admin_mobile/lib/src/operator_admin/**`, `apps/admin_mobile/test/operator_admin/**`, `services/ops/src/operator_admin/**`, `services/ops/src/operator_admin_*.test.ts`.
- No ownership of shared `services/ops/src/app.ts`, `services/gateway/src/app.ts`, `main.ts`, migrations, ledger, Firebase/native, consumer router or other windows' paths.
- Intent: reuse existing Ops session/capability and agent/skill contracts, add audited capability change guard and typed admin readback, write Flutter admin module; composition deferred to designated shared owner if necessary.
- Status: CLAIMED — implementation in progress, no tests or validation claimed.

## 2026-10-08T19:23Z lease expansion — Ops-only composition
- Same window claims **exact wiring** in `services/ops/src/app.ts` and `services/ops/src/main.ts` for optional guarded U27 endpoints. Current #497/#506/#468/#493/#480 file inventories show no Ops overlap; no Gateway/shared money/native file ownership requested.
- Fail-closed: only expose U27 endpoint when canonical `AgentAdminAuthorizer` plus existing `AgentAdminService` are provided; default service remains closed. No global Ops grant configuration or production privileges changed.
