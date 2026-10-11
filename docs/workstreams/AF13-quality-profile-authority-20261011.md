# QUALITY profile API recovery

Owner/window: quality-profile-authority-20261011-cloud. Claim time: 2026-10-11 UTC.
Branch: lane/quality-profile-authority-20261011.
Base: a8e1c84cebcec9604a6b7c9cbdafc6ba6c2b036d (fresh main after #668).
Exact paths: services/gateway/src/talk_profile_routes.ts,
services/gateway/src/talk_profile_routes.test.ts, this record.

## Narrow stale ownership recovery

Registry claim af06-pr497-chat-list-async-action-lifecycle-20261010085813 expired
2026-10-10T09:32:12.915Z. Branch work/af00-root-navigation-20261010-masanawa01-c
last commit 3c0e88489baa7b5ad99dff66e69325f23937f086 is dated 2026-10-10.
Inspected its exact two profile paths: fixture readback correction and raw-body
rejection via strict_request_body helper. Preserve the branch and all remaining
claimed paths. Transfer only the two profile paths to this Quality window.
Reuse equivalent complete profile changes from continue-chat-reliability-20261011
at 40bf774de (inline validation, no extra helper dependency). No subsystem rewrite.
The claims script refuses stale ownership; this visible recovery record precedes
a narrow compare-and-swap registry transfer and new claim/readback.

## Reproduced evidence and next action

Node 24.19.0 / pnpm 12.8.2; frozen install PASS with lockfile untouched.
Main pnpm test:ci: 24 failed, 1154 passed, 143 skipped, 2 EPERM listen errors.
Profile suite: two FAIL (stale readback and forged body accepted with HTTP 200).
Main pnpm typecheck: FAIL TS2459 packages/agents/src/talk-replay.test.ts imports
non-exported TalkId. Reserved by another unreleased stale claim; no edit here.
Next: acquire/read back exact claim, recover profile fix, execute HTTP denial,
mutation/readback tests, push checkpoints and scoped PR for coordinator.
State: PLANNED. Production/device/provider verification NOT_RUN.
No calls/status/rooms/auth/financial/shared composition edits.
