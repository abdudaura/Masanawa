# U02 — durable operator tasks (2026-10-09)

- **Claim/status:** ACTIVE IMPLEMENTATION, isolated U02 only; owner/window: GPT-6 U02 independent development window. Source NOT yet implemented or verified.
- **Claim time:** 2026-10-09 00:48 Africa/Lagos (~2026-10-08T23:48Z). Five-minute activity lease measured by fresh GitHub commits/PR changes, not this document alone.
- **Base:** main `5e758673ae91082520b21b3153da53791ae2cbf3`.
- **Branch:** `work/u02-durable-operator-tasks-20261009-gpt6`; planned draft PR to main, unmerged.
- **Owner paths:** `packages/operator-tasks/**` (new package, source and unit tests), `services/gateway/src/operator_tasks/**` (new isolated API handler composition contract, if safe), `adapters/storage/postgres/src/operator_tasks/**` (new private SQL source, no central migration registry writes), this specific handoff file.
- **Scope:** U02 journal, task/operation authorization, evidence-only success, idempotency/versioned approval and reconciliation, observable event cursor/tenant fencing, cancel/retry fail-closed; backend and tests with real PostgreSQL contract as feasible.
- **Upstream:** U01 freshly claimed on `work/u01-operator-contract-20261009-gpt6` at `640428edf51683a02baa99b3234d8cf2247649b7`; read v1 docs until published and do not edit U01 paths. Canonical R/C, finance/C07/Work PR #497, Firebase #461, R17/C08 #493 and CI #457 remain external dependencies.
- **Protected shared paths:** DO NOT edit `services/gateway/src/app.ts`, `main.ts`, migrations registry, finance ledger, Firebase, Flutter root router/five-tab navigation or other PR-owned files.
- **Current step:** source/schema/auth conventions inspection, then isolated code and tests; no deployment, merge or production mutation.
- **Verification:** no tests executed at claim; add exact executed results and blockers in final handoff.
