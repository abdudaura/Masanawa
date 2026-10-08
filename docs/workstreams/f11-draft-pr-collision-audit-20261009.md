# F11 recovery — read-only draft PR collision audit

Updated UTC: 2026-10-08T23:44:00Z (five-minute exact-path lease; recheck before other authors change paths).
Owner: autonomous scoped verification window, **not** the Work integration owner.
Branch: `work/f11-draft-pr-collision-auditor-20261009`
Base `main`: `5e758673ae91082520b21b3153da53791ae2cbf3`.
Status: CLAIMED / SOURCE IN PROGRESS. This claims only an isolated developer verification tool, **not F11's shared CI, deployment or release ownership**.

Exclusive source paths:
- `scripts/audit-draft-pr-collisions.mjs`
- `scripts/audit-draft-pr-collisions.test.mjs`
- `docs/workstreams/f11-draft-pr-collision-audit-20261009.md`

Objective: provide read-only, fail-closed discovery of overlapping draft PR file edits, duplicate migration sequence numbers, and missing verifiable per-window handoff pointers. Support reproducible offline snapshots for tests and authenticated live GitHub read-only inventory for Work; emit structured evidence with exact PR and SHA. No production runtime, finance, Gateway composer, Flutter, Firebase, migration, CI configuration, or existing feature PR files will change.

Current review: U21–U30 each has open draft PR (#508–#517, except U27 #516 etc); Work #497 remains active draft, Firebase #461 preserved there. Known duplicate migrations C02 #472/#475, C05 #474/#476, C06 #487/#490. Five-minute ownership and existing work preserved. This scope is verification utility only, not claim of whole-product implementation. Tests/evidence and precise handoff will be appended in subsequent commit.
