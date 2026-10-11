# C46 Following — integration checklist (J01/J16 related; not a J18 seed acceptance)

**Source baseline:** integration/rebuild@7d817a87cda31e761a9de42724739ec41244d1a2
**Activation:** OFF until AF00 registers the feature on the canonical authenticated Gateway, migrations and fan Account route.

Full path:
1. Staff approves a platform Masana with licensed portrait/banner. Sign in as fan A, follow using the existing POST /v1/masana/:id/follow. Navigate Account → Following (AF00 mount), filter name/profession/language and open the Masana profile.
2. PUT /v1/me/following/:id/mute {muted:true}; verify the canonical notification worker skips that fan at send time, while the followed account still appears in Following and feed. Unmute and verify permission is restored only while Follow remains active.
3. Unfollow using the existing DELETE /v1/masana/:id/follow. Readback no longer includes the character, linked mute preference cascades, and any delayed notification is denied.
4. Sign in as fan B and force the fan A query to settle later. Ensure fan A's Following and stale mute results never appear. Test denied login, offline read-only, retry after restart, empty results, pagination and duplicate cursors.
5. Negative tests: forge tenant/fan ID/body; mute another fan, non-Masana, retired/draft character, or without a Follow; enforce 401/403/404 and no storage mutation.
6. PostgreSQL 18: apply the forward-only migration on disposable fresh and upgrade snapshots; verify FK cascade/unfollow, composite tenancy, checksum and existing followers/financial history preserved. Rehearse worker outage and retry.
7. Flutter low-end Android: search, dropdown language, mute, confirm-unfollow, offline, account switch, English/Hausa, text scale/dark mode and back stack.

AF00 protected composition:
- Append migration 0005_follow_preferences.sql under the ONE existing masana migration root, after 0002 chat inbox / 0003 calls / 0004 rehearsal if accepted. Never replay or modify applied migration checksums.
- Register registerFollowingRoutes() with canonical MasanaAuth.fan and createFollowingStore(existing PG pool); no duplicate user session, follow authority or global /v1/me registration.
- Connect MasanaFollowingScreen with GatewayFollowingRepository(existing authorized Dio) in fan Account > Following; default-off until router/account privacy gates and J16 tests pass.
- Add mayNotifyFollower(existing PG pool, tenantId/fanId/characterId) as an invocation-time filter to the existing notification outbox worker. Do not create a notification queue.

**Evidence:** Source/test files alone do not establish runtime success. The test execution and integrated SHA must be appended by an eligible AF00/runner.
