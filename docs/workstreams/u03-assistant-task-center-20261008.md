# U03 — Assistant task-center claim and handoff

Updated (UTC): 2026-10-08T23:52:00Z; owner: GPT-6 U03 autonomous window
Status: CLAIMED — implementation in progress, NOT RELEASED.
Lease: five minutes after latest GitHub write/activity. Inspect fresh claim before competing writes.
Base main: `5e758673ae91082520b21b3153da53791ae2cbf3`
Branch: `work/u03-assistant-task-center-20261009-gpt6`
PR: pending code checkpoint.

## Exact owned paths

- `apps/mobile/lib/src/operator_workspace/**`
- `apps/mobile/test/operator_workspace/**`
- `docs/workstreams/u03-assistant-task-center-20261008.md`

No shared router, C07 source, Gateway app/main, PostgreSQL/migration, finance, Firebase, native build, or global pubspec edits.

## Collision and dependency checks

Live main and 71 open PRs inspected; no U03 open PR or `work/u03*` branch immediately before claiming. U01 #519 and U02 developing on different roots. C07 #480 owns the canonical Assistant conversation; R17/C08 #493 and Work #497 own navigation/composition. U03 is a nested feature module only. Do not duplicate C07 conversation stores.

## Plan

Implement an account-fenced, server-authoritative U02-compatible task presenter with typed task states, approval preview (never authorizing via AI text), bounded paginated history, operation receipt/status display, explicit cancel/retry/resume and offline/failure recovery. Integration adapter and widget/controller tests; no unearned E2E success claims.

## Initial verification

Not yet run. The remote repository is private and local Flutter/Dart SDK unavailable in this execution environment. Actual checks and SHA-specific final handoff to follow.
