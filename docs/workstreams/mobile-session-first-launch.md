# Mobile session first-launch optimization — 2026-10-05

Owner/window: ChatGPT startup-performance continuation after first-frame deferral.
Branch: `work/mobile-session-first-launch-20261005`
Base: `5fc46c204839e050afbf960ece36b2e1dc928f74`

Purpose:
1. Reduce secure-storage platform calls on fresh installs and legacy-session upgrades.
2. Preserve backward-compatible migration to the single-record `auth_session_v2` format.

Owned paths:
- `apps/mobile/lib/src/state/session_state.dart`
- `apps/mobile/test/session_state_test.dart`
- `docs/AGENT-HARNESS.md`, `CONTINUE-HERE.md` and this claim at checkpoint

Boundaries:
- no auth protocol/Gateway changes;
- no token semantics or expiry-policy changes;
- no removal of legacy-session compatibility;
- no APK rebuild.

Acceptance:
- current-format returning sessions still restore with one secure-storage read;
- when the current record is absent, legacy compatibility uses one bulk secure-storage read instead of four individual reads;
- legacy sessions still migrate asynchronously to `auth_session_v2`;
- fresh signed-out installs do not make five secure-storage calls;
- focused tests cover current, legacy and empty-store paths;
- docs updated before merge.

Status: active.
