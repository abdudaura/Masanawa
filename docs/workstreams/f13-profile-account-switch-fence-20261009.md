# F13 — Profile editor account-switch fence (claim)

Updated UTC: 2026-10-09T02:42:31Z. Window: GPT-6 F13 account-switch recovery.
Status: CLAIMED / PARTIAL_IMPLEMENTATION; draft, unmerged, not deployed.

- Base main: `5e758673ae91082520b21b3153da53791ae2cbf3`
- Existing branch: `work/r18-avatar-end-to-end-20261008`; existing draft PR: #435; last prior visible PR activity: 2026-10-09T01:34:50Z (stale beyond five minutes). Preserve full existing avatar implementation and its history.
- Exclusive bounded paths: `apps/mobile/lib/src/screens/profile/edit_profile_screen.dart`; `apps/mobile/test/edit_profile_screen_test.dart`; `docs/workstreams/f13-profile-account-switch-fence-20261009.md`.
- Aim: prevent signed-out or switched-account late profile read/write/avatar callbacks from updating the wrong on-screen profile or cache; add widget regression evidence. Current R18 profile API/secure-store providers remain authoritative; do not edit shared session, Gateway composer, migrations, root tabs or finance.
- Five-minute lease start: 2026-10-09T02:42:31Z; expires without repository-visible activity at 2026-10-09T02:47:31Z. Subsequent commits are heartbeats.
- Dependencies: original R18 PR #435 source, C01 #468 shared integration, R17/C08 five-tab shell, Work #497, Firebase #461 and CI issue #457.
- Step: inspect entire profile widget/test, implement only bounded fencing and execute all feasible checks; later update this file with tested SHA and missing gates.
