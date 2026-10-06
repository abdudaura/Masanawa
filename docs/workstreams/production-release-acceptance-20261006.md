# Production release acceptance qualifier — Task 150

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/production-release-acceptance-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Production task: 150 — production release, post-release health verification and first-generation acceptance audit.

## Scope

This lane implements a deterministic release-acceptance evidence qualifier and operator handoff only. It does **not** perform production cutover, mutate production infrastructure, change deployment configuration, touch shared Gateway/mobile/router/APK ownership, modify migrations, or claim Task 150 complete without externally produced production evidence.

## Exact owned paths

- `docs/workstreams/production-release-acceptance-20261006.md`
- `scripts/production-release-qualification.mjs`
- `scripts/production-release-qualification.test.mjs`

## Excluded/shared paths

- PR #136 and all shared Gateway/mobile/router/APK/production composition paths;
- migrations and production environment/configuration;
- Commerce/Event ownership and canonical transaction state machines;
- Task 145-149 owned files and active workstream paths;
- provider credentials, live deployment state and physical-device actions.

## Dependencies

- Task 149 production-like pilot evidence must be READY before release acceptance can pass;
- production cutover/post-release checks are externally executed and supplied as evidence;
- rollback authority and exact release/build/schema identity remain integration-owner evidence.

## Completed implementation

- added schema-v1 production release evidence normalization with strict types, bounded identifiers/timestamps/counts and SHA-256 evidence hashes;
- requires Task 149 pilot status READY and binds pilot build/schema identity to the exact release;
- requires explicit cutover completion and a configurable minimum post-release observation window;
- requires availability, latency, errors, queues, realtime, channels, commerce and devices health evidence;
- fails release on blocking parity items, active severity-one incidents, failed health checks or unavailable rollback;
- requires rollback target to differ from the release build;
- requires all first-generation acceptance audit families covering identity/memory, Skills/runtime/workflows, channels/devices, proactivity/presence, commerce/social/studio, plugins/evaluation/learning, hardening and pilot/cutover;
- classifies missing evidence as INCOMPLETE and violated invariants as FAILED;
- CLI exits non-zero unless qualification is READY.

## Verification

Focused executable test:
- `node --test scripts/production-release-qualification.test.mjs`
- result: **7 passed, 0 failed** after correcting invalid non-hex fixture characters.

PR CI:
- Foundation CI run `37477060924` on implementation head `4a8ca3a33151248a90d26462ed84ff0ef0abf599`;
- conclusion: failure before repository steps executed;
- job `112315109381` exposes **zero steps** and no retrievable job log blob, so this is not counted as an application/test failure or success.

## Changed-file audit

Comparison against `main` at the implementation head is ahead 4 / behind 0 and contains only:
- `docs/workstreams/production-release-acceptance-20261006.md`;
- `scripts/production-release-qualification.mjs`;
- `scripts/production-release-qualification.test.mjs`.

No protected/shared path is changed.

## Handoff evidence

- implementation/test head: `4a8ca3a33151248a90d26462ed84ff0ef0abf599`;
- PR: #286 — Add production release acceptance qualification;
- isolated implementation status: COMPLETE;
- Task 150 production status: NOT COMPLETE.

## Remaining dependencies

Task 150 cannot be marked complete from this lane. Remaining work belongs to protected production/integration ownership or external execution:
- Task 149 must produce READY production-like pilot evidence on the exact release candidate;
- authorized owner must execute the real production cutover;
- real post-release observation/health evidence must be collected;
- rollback availability must be proven against a prior stable build;
- any real parity or severity-one blocker must be resolved;
- the first-generation acceptance audit must be populated with production evidence.

State: ISOLATED COMPLETE / BLOCKED ON TASK 149 + PROTECTED PRODUCTION CUTOVER EVIDENCE.

Last update: 2026-10-06.
