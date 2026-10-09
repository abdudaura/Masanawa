# MASANAWA-01 — AF00 incoming private deep-link admission

**Status:** PARTIAL_IMPLEMENTATION (isolated source + regression tests authored; Dart/Flutter runtime, combined integration and real-device journey NOT VERIFIED).

- Owner/window: MASANAWA-01, AF00 scoped recovery.
- Authoritative branch: `work/af00-deeplink-authority-20261009-masanawa01`.
- Fresh base `main@f381f077c485c04261459b77a42c215d3ce3a14b` (2026-10-09).
- Before-edit GitHub CAS registry claim: `factory/claims@76520d8d7e1ac5f3a3f3ae5655a553f38a3540a0`, claim ID `masanawa-01-af00-deeplink-20261009`; fetched and read back prior to source changes.
- Code/test checkpoint: `8b5ce00363df78e6301de38e01d0d5dbbad94950`.
- Owned exact paths (no others):
  - `apps/mobile/lib/src/core/shell_deep_link.dart`
  - `apps/mobile/test/shell_deep_link_test.dart`
  - `docs/workstreams/AF00-deeplink-authority-20261009.md`

## Inputs and preserve-first boundary

Read current `CONTINUE-HERE.md`, `AGENTS.md`, Software Factory skill and relevant parallel-delivery protocol, current AF00 prompt, audio-first screen/integration contracts, recovery and whole-app audit. Inspect #497 Work, #493 five-root integration and #552 verification guard: all remain recovery inputs; none was overwritten. The owner's locally fixed APK/source is not available to this execution environment. Current main remains a four-root Flutter shell; this patch **does not** rename/rearrange root tabs, claim five-tab acceptance or substitute a placeholder screen.

## Connected fix

Deep-link parsing previously collapsed repeated query values into `queryParameters`, allowing contradictory `characterId` parameters to be interpreted by unspecified first/last-value behavior. A work/approval/artifact URI with missing or extra path segments could also silently open a private conversation, because its resource path was not checked. Unbounded identity/path input was accepted if characters matched the regex.

Now the real `shellDeepLinkRoute(Uri)` rejects duplicate query parameters, input URIs beyond 2048 characters, malformed or multi-segment work/approval/artifact IDs, and character IDs over 256 characters. Existing private chat, privacy-aware Twin lookup, public Talk, owner session, activity and legacy no-character fallback stay unchanged. The Gateway retains final identity/action authorization; incoming links are not grants. No financial, device, DB or provider code changed.

## Evidence and executable gates

- GitHub connector readback: source blob `570a03d7f3ed25d7424ff515ba0f0ab33a50a9db`; Dart regression blob `c3857f9834ab2345101b9c4308669eead3f1ec61`.
- `compare_commits(base, branch)`: four commits ahead, exactly two Dart files edited before this handoff; no unrelated source.
- 13/13 **static source/test structure checks** PASS on the exact fetched GitHub branch; this is not Dart test execution.
- New regression cases are checked in for repeated same/different character IDs, missing/extra resource IDs, encoded separators, invalid query keys and size boundaries; original suite preserved.
- `flutter test test/shell_deep_link_test.dart` from `apps/mobile`: **NOT RUN** (Flutter/Dart binaries not installed here; GitHub private checkout also unavailable because environment cannot resolve github.com). `flutter analyze`, `flutter build apk`, device/FCM deep links and signed-out routing: **NOT RUN**. The committed tests must execute against a qualified checkout before merge.

## Acceptance and next integrator

- UX-A03: narrowed private-route parser safety authored, NOT full five-tab/default/deep-link acceptance.
- Preserve legacy `/chats` no-character fallback when migrating tabs: historical `/chats` pointed to private AI, whereas the new root Chats is human messaging. AF00 must explicitly map old aliases to Gwani and keep typed human `/messages/:conversationId` separate from `/chat/:characterId`.
- Reconcile the owner's unpublished local changes first; integrate this two-file fix with #497/#493 into a non-deploying integration branch. Run the actual Dart tests, full analyzer, signed-in and signed-out deep-link widget tests, locale/route regression, and Android intent device tests. Do not auto-merge to a production-deploying main branch before checking triggers.
- No migrations, secrets, payments, deployments, refunds, Android binary or external services touched. Uncompleted AF00 integration is still owned by the next integrator; do not mark full lane done.

## 2026-10-09 MASANAWA-01 same-lane compiler repair

**Priority: source correctness. Status remains PARTIAL_IMPLEMENTATION / Dart runtime NOT RUN.**
After readback of draft #586, the existing validator region in source blob
`570a03d7f3ed25d7424ff515ba0f0ab33a50a9db` was found to contain an unterminated
raw regular expression and *duplicated function definitions*, so the previously
reported 13/13 structural checks were insufficient and did **not** establish
a compiling implementation. This is a real source defect, not a CI runner
failure. Do not merge that prior blob.

- Exact-path claim before the repair: `masanawa-01-af00-fix-broken-dart-20261009`,
  verified in `factory/claims` after CAS publication. This continues the
  released original MASANAWA-01 AF00 claim on the same three paths; no new
  cross-lane ownership or local-source claim was made.
- Repair code commit: `bdc6eda732a1f7303b3fbbb80ed394273f92dda0`.
  Canonical source blob: `07e14d81d18a7cb5436da196d9da9362b107193c`.
  All four validators are now distinct complete anchored expressions;
  character/resource identifiers are bounded to 256 decoded characters.
  Legacy no-character work/approval/artifact fallback continues only when the
  query map is empty; unrelated query keys now fail closed.
- Regression test commit: `5a42a61f98a48bad4c53a1487275c5a6d4530860`.
  Test blob: `63af5b44cb271ae8e2820d2e7726c80008a6484d`.
  Added boundary tests for 256/257-character IDs, duplicate authority keys,
  invalid encoded path separators and malicious query keys. Preserved the
  prior test coverage and private/public route semantics.
- GitHub readback on these exact two blobs: **12/12 additional static source/
  test integrity assertions PASS** (distinct anchors, regex, bounds, negative
  cases and no conflict markers). These are **not Dart compilation/tests**.
- Executed Flutter/Dart analyzer, test, Android signed APK, physical-device,
  provider and end-to-end checks: **NOT RUN**. In this window `dart` and
  `flutter` executables were absent. Run on exact PR SHA:
  `cd apps/mobile && flutter analyze && flutter test test/shell_deep_link_test.dart`.
  Verify cold-start/foreground signed-out flows, old `/chats` AI fallback to
  Gwani after the canonical five-tab shell integration, and account isolation.
- Do **not** merge this isolated source onto a production-deploying main until
  AF00 reconciles the owner's unprovided local source/APK and #497/#493,
  verifies exact-head tests, and audits deployment triggers. Non-deploying
  integration is the intended first merge target once executable gates pass.

The scope remains **an isolated complete deep-link parser repair plus authored
regression tests, not complete AF00 integration, not an APK, and not E2E proof**.
