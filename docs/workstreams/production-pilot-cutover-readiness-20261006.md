# Production-like pilot / parity / rollback readiness — Task 149 — 2026-10-06

Status: active isolated release-gate slice
Owner/window: ChatGPT continuation window
Branch: `work/production-pilot-cutover-readiness-20261006`
Base: current `main` `8648c5f524108d825fa52e3a7f735675dd8b78f7`

## Exact owned paths

- `scripts/production-pilot-qualification.mjs` (new)
- `scripts/production-pilot-qualification.test.mjs` (new)
- `docs/PRODUCTION-PILOT-QUALIFICATION.md` (new)
- `docs/workstreams/production-pilot-cutover-readiness-20261006.md`

## Boundaries

- no deployment, Railway, Gateway, mobile/APK, provider, migration, Commerce/Event or production environment edits;
- no live cutover;
- no generated pilot evidence is treated as real production evidence;
- this lane only validates externally produced production-like pilot evidence.

## Goal

Task 149 must produce a deterministic READY/INCOMPLETE/FAILED decision for one exact
release-candidate build + schema using:
- complete first-generation golden-journey family evidence;
- parity ledger with zero blocking items;
- successful rollback rehearsal to a different prior stable build/schema;
- bounded recovery time;
- cutover-readiness checklist;
- exact evidence hashes and pilot observation window.

Task 150 may consume READY output from this qualifier but cannot infer readiness without it.
