# F13 — Profile account-switch safety fence — SHA-specific handoff

Updated UTC: 2026-10-09T02:46:27Z. Owner/window: GPT-6 F13 profile session-race recovery.
**Whole F13 status: PARTIAL_IMPLEMENTATION. Bounded editor session fence: IMPLEMENTED_UNVERIFIED. DRAFT / UNMERGED / NOT DEPLOYED.**

## Claim and source identity

- Latest `main` at discovery: `5e758673ae91082520b21b3153da53791ae2cbf3`. Continued **existing** R18 draft [#435](https://github.com/Baatiku/masanawa/pull/435), branch `work/r18-avatar-end-to-end-20261008`; preserved all earlier commits, S3/avatar implementation and prior handoff.
- Previous #435 source HEAD: `b85d9fd0fe98f55fec17058e2812f50630ad00a4`. Claim commit: `435e85f17edbd197544252285652b6f5a4b0ebd0`. Source commits: `dc70768294fcf3ab803544ab5e54c8bbd53392e5`, `e8e06a9a1f4b1c2b1e836392f4275d6b94114568`, **`4d0853d9bc2201541ac26a29ac56807537ad6023`** (source/test checkpoint). Handoff commit is the later PR head, retrievable from branch; no SHA of a future commit is asserted here.
- Five-minute claim began 2026-10-09T02:42:31Z, initial expiry 02:47:31Z absent a new repository-visible commit; source commits renew the lease. Claimed exact paths: `apps/mobile/lib/src/screens/profile/edit_profile_screen.dart`, `apps/mobile/test/edit_profile_screen_test.dart`, this handoff only.
- Requirements: F13/R18 authenticated person profile update and account-switch isolation, J-person-profile read/edit/reload path. No changes to R17/C08 five tabs, finance, Firebase, Gateway composition, auth provider, database/migrations, production or common router.

## Implemented source

- `apps/mobile/lib/src/screens/profile/edit_profile_screen.dart`: listens to session identity changes; clears every previous person's profile, form draft, avatar-removal intent, busy/error state on sign-out or a different user; starts the new signed-in user's **real** authenticated profile read.
- Tracks session epoch **and** latest load version to discard stale/overlapping profile reads. Guards asynchronous name/bio/create save, avatar remove and pick/crop/upload/readback callbacks before applying UI or cache updates. A stale first save cannot perform a *second* avatar delete/readback after account switch; later errors/success SnackBars/finalizers cannot reintroduce the previous identity. Same-user token refresh deliberately preserves unsaved input.
- While signed out, shows sign-in guidance rather than a misleading reload action.
- `apps/mobile/test/edit_profile_screen_test.dart`: adds widget regression tests using completing futures for (1) A read resolves after B read, (2) A save resolves after B switch, (3) logout while read pending, (4) same-user token refresh retains draft. There are now **10 written widget tests** in this file. Existing photo, CRUD and error tests are preserved. Simulated transports exist **only in tests**; production uses the existing authenticated OwnProfileTransport/ProfileAvatarTransport.

## Evidence actually observed

- GitHub readback (source at checkpoint `4d0853d...`): **8/8 static structural assertions true**, including account-bound listener/dispose, latest load wins, fenced callback locations, no follow-up removal on stale save, signed-out reload disabled, four newly written regression cases, 10 widget test definitions. This is **not** Dart compilation or test execution.
- GitHub compare `b85d9fd..work/r18-avatar-end-to-end-20261008` at source checkpoint: four commits ahead, zero behind; **only the two claimed Flutter files plus this claim/handoff document** changed.
- CI for source commit `4d0853d...`: Actions check run **37876088020** / job **113644904396** and build run **37876088075** / job **113644904761** concluded **failure**, each with **zero steps** (confirmed by job-step API), consistent with [issue #457](https://github.com/Baatiku/masanawa/issues/457) runner/quota blockade. No code/test outcome may be inferred.
- Local tool check: `which flutter` and `which dart` returned no binary in available container; Node and git are available, but the private repository is accessible through the authenticated GitHub connector rather than a mounted Flutter checkout. **No Dart analyzer, flutter test, APK, physical-device, PostgreSQL, S3 or live customer tests executed.**

## Deferred runnable acceptance

1. On an authorized checkout of the exact PR head, execute `cd apps/mobile && flutter pub get && flutter analyze lib/src/screens/profile/edit_profile_screen.dart test/edit_profile_screen_test.dart && flutter test test/edit_profile_screen_test.dart`. Fix any analyzer/test failure, rerun and record raw logs/Flutter version/SHA; test-authoring alone is NOT PASS.
2. Test genuine session A→B, A→sign-out, B→A rapid switching on real Android with slow/intercepted A profile GET/PATCH, and begin a photo picker before switching; ensure old request results never appear under B. Verify wrong identity cannot delete B's avatar; compare DB-backed GET after restart and across devices. Existing signed-in requests may already have reached server **before** logout; this Flutter fence does not replace server-side session revocation/policy.
3. Reconcile #435 shared Gateway files and migration `0015_profile_avatar_objects.sql` with C01 [#468](https://github.com/Baatiku/masanawa/pull/468), [#497](https://github.com/Baatiku/masanawa/pull/497), Firebase [#461](https://github.com/Baatiku/masanawa/pull/461), F12 five-tab router owner, PR #457 CI, and S3/CDN operator qualification. Existing public handle rename/alias/reference-safe migration, profile consistency and complete F13 acceptance **remain missing**; don't label R18/F13 done.
4. Qualify live S3 policy, WebP metadata stripping, staged TTL/concurrency, authenticated removal and 2-device cache invalidation from original R18 PR; don't execute production changes without owner approval.

## Data/security, portability, release risk

No new database tables, migrations, provider settings, credentials, financial writes, native dependencies or routing changes. This reduces a client-side cross-account privacy disclosure; it does not cancel already-dispatched server operations or supersede server auth, CAS/tenant checks. Retain canonical five-tab architecture, Firebase, existing audit/ledger safeguards and profile edit endpoint. Rollback: revert only this bounded F13 diff on PR #435; do not delete earlier avatar source. Requires Android/widget qualification before any release. Release gates: SOURCE_WRITTEN yes (bounded); STATIC_READBACK yes; LOCAL_DART_TESTED no; CI_EXECUTED no (jobs zero steps); DB_INTEGRATED unverified; APP_INTEGRATED unverified; DEVICE_VERIFIED no; PROVIDER_QUALIFIED no; DEPLOYED no; MERGED no.
