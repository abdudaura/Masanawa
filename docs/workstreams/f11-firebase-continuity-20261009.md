# F11 — Firebase cross-platform continuity verification (nonconflicting recovery)

**Ownership claim — 2026-10-09T02:06:40.168Z UTC.** Window: `chatgpt-f11-firebase-continuity-20261009`. Workstream: **F11 verification-only subclaim** (does NOT seize F10, Firebase #461, CI #457, Work #497 or F11 #518). Base `main` SHA `5e758673ae91082520b21b3153da53791ae2cbf3`. Branch `work/f11-firebase-continuity-guard-20261009`.

**Exclusive paths:** `tools/firebase-continuity/**` and `docs/workstreams/f11-firebase-continuity-20261009.md`. Neither exists on inspected main. Five-minute review/heartbeat obligation applies; no stale-lease takeover; review PR heads before any path change. Existing active F11 #518 only touches its own PR-audit script paths.

**Permitted operation:** implement and execute a dependency-free read-only check for Android/iOS Firebase package/project consistency, native plugin presence, client-safe config handling, build defines contract and fail-closed missing/mismatch checks. Do not copy native Firebase configs, secrets, or build values into this branch. Do not modify shared Flutter, Android/iOS, backend, migration, CI workflow, finance, signing or production files. The guard is not an actual FCM delivery test and must not become mandatory CI until final integration owns the composed state.

**State:** CLAIMED, no implementation/test assertions yet. Branch is draft-only, no merge/deploy authority. Update this document with exact head, tests and limitations after source is pushed.
