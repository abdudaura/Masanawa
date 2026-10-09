# U04 — Scoped platform-service action adapters (active claim)

Window: GPT-6 independent U04 recovery, 2026-10-09 (UTC). Five-minute lease starts with this commit; renew from repository-visible writes. Current status: **PARTIAL_IMPLEMENTATION** until source, integration and executable tests are complete.

Base: `5e758673ae91082520b21b3153da53791ae2cbf3`; branch: `work/u04-scoped-service-adapters-20261009-gpt6`; PR: to be attached after code is committed.

Exclusive exact owned paths: `services/gateway/src/operator_actions/**`, `docs/workstreams/u04-operator-service-adapters-20261008.md`. Tests under same new module root. U01 owns protocol, U02 owns durable task service; this branch imports/adapts them without changing those modules. No access to shared `app.ts`/`main.ts`, DB migration registry, financial ledgers, human DM schema, Flutter router, Firebase, workflows or live providers. Composition delegated to Work/F18; only isolated, injection-bound integration until then.

Scope: fail-closed typed domain service adapters, current-session authority and resource checks, read/preparation vs write separation, safely status-classified errors, attempts/receipt readback, and tests. Previously existing domain APIs are the authority; missing services remain `not_qualified`, never fake success. Security invariants: no model-origin approval, unknown status stays uncertain, no cross-tenant operations, no payload-selected identity, no unreviewed messages or money dispatch.

Conflict inspection: `main` operator module does not exist; no U04 PR or branch as checked. Existing U01 #519, U02 #520, U03 #521, Work #497, C01 #468, C02 #472/#475 and financial #487/#490 remain independent draft owners. No merging/deployment authorized.

Pending detailed handoff: source files, tests/evidence, blockers and precise integration steps to be recorded here after implementation.
