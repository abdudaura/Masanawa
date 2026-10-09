# F13 / R18 — uncertain profile-write recovery lease

Owner/window: GPT-6 F13 profile uncertainty recovery (2026-10-09).
Claim published: 2026-10-09T03:13Z; expires five minutes after last repository-visible commit/claim update unless renewed.
Existing draft PR: #435 (https://github.com/Baatiku/masanawa/pull/435); branch: `work/r18-avatar-end-to-end-20261008`.
Latest inspected main: `5e758673ae91082520b21b3153da53791ae2cbf3`. Pre-claim PR head: `cb40c32de11af93efa5114bf45675f39e8fd4c7c`.
Earlier branch updates at 2026-10-09T02:47:27Z were older than five minutes, so prior F13 claim was stale; preserved all existing profile/avatar/backend source and previous handoffs. No PR rewrite/new migration.

Exclusive exact paths for this lease:
- `apps/mobile/lib/src/screens/profile/edit_profile_screen.dart`
- `apps/mobile/test/edit_profile_screen_test.dart`
- `docs/workstreams/f13-profile-uncertain-writes-20261009.md` (this file).

Task: close the profile-edit UI's retry-after-ambiguous-write hazard; mark writes as needing authoritative server reload before another mutation, distinguish pre-upload picker failure, preserve existing account-switch protection and truthful load/retry controls. Add widget regressions. Dependencies: canonical OwnProfileTransport, ProfileAvatarTransport, sessionProvider; no changes to F12 five tabs, C01 contacts, shared Gateway app/main, migrations, S3, finance or Firebase.

Current status: CLAIMED / SOURCE NOT YET MODIFIED. Test evidence: NOT RUN. Handoff to be appended after code/tests; still DRAFT/UNMERGED/NOT DEPLOYED and whole F13 PARTIAL_IMPLEMENTATION.
