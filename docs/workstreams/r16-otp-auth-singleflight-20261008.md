# R16 / P08 — native OTP sign-in single-flight and durable credential-order recovery

Updated (Africa/Lagos): 2026-10-08. Window: GPT-6 scoped authenticated sign-in recovery.
**Status: IMPLEMENTED_UNVERIFIED for this bounded OTP/session-race slice; R16 overall PARTIAL_IMPLEMENTATION. DRAFT / UNMERGED / NOT DONE.**

## Ownership/lease, exact refs
- Repository-visible five-minute claim: 53e6676ae39537decc2d95f06ef7575150c2c6ec; heartbeat = most recent branch push/commit. Recheck timestamp before reclaim.
- Base main: 1d6a67ea3c182455b55a7d1d07eacdb4311682e3.
- Branch: work/r16-otp-auth-singleflight-20261008-gpt6; fetch its latest HEAD (includes this handoff).
- Core implementation commit: 12bc2694044b89afcbe237b6f2bd75208c1ce23c.
- OTP screen commit: 840ca72bb5451b0d0a7df18358980d8391f93a06.
- Test commit: 856bf5f2376401a9eb883a79f9f50461a72c24cb.
- Logout ordering hardening commit: 2c9f7565328b4d3b9e220c0b27cc347a75dd064f.
- Deterministic secure-storage race fixture commit: b3dd912489ac80bb0175f2274776caf84acfcba8.
- 401/logout refresh fencing commit: 74f0ea6eebf588d17ef0cc0f94efd8181f309cbc.
- Logout 401 regression commit: 9ff956d24e05d5587abdee4c334a83445b63751c.
- PR: review the draft PR associated with this branch; exact URL and terminal handoff commit are in its GitHub metadata.
- Requirements: R16 and shared sign-in safety P08; J10/J11, silent onboarding/login accessibility.

Exclusive files:
1. apps/mobile/lib/src/state/session_state.dart
2. apps/mobile/lib/src/screens/onboarding/otp_screen.dart
3. apps/mobile/test/session_state_test.dart
4. docs/workstreams/r16-otp-auth-singleflight-20261008.md

Existing open drafts #497/#461/#493/#495/#498/#480/#474/#476/#482/#455/#492/#438/#444 did not list these specific files when checked. Still recheck latest PR diffs before integration. No change to Gateway composer/app, R17/C08 router, Firebase, credentials, SQL, finance, native Android, or l10n.

## Existing real end-to-end domain contract
Onboarding PhoneLoginScreen -> SessionController.sendOtp -> configured GET /auth/capabilities + POST /auth/otp; OtpScreen six digits or Verify -> SessionController.verifyOtp -> POST /auth/verify -> native FlutterSecureStorage auth_session_v2 -> SessionSignedIn -> authoritative API token. The backend route, database account/session identity and OTP provider authority already exist on main and are NOT altered here. This scope hardens racing client responses and secure persistence; it does not create fake authentication, hardcode OTP, or bypass real backend checks.

## Implemented source
- Session generation fence supersedes stale OTP send/verify, refresh, restored session and native keychain migration completions when a newer authentication action/logout starts. A past error/response cannot replace a new account's pending/authenticated state.
- Same-context OTP send while pending sends only once. OTP verification enforces one pending flight even when six-digit auto-submit and Verify tap fire together.
- OTP screen disables Verify and Resend while a verification is pending; typed correction still clears the prior error via the existing clearVerifyError path. Existing EMAIL/SMS, resend cooldown, NAME_REQUIRED_ON_SIGNUP, auth error, fallback restart and secure session shape retained.
- Serialized native secure credential operations order legacy migration, signed-in persistence, refresh and logout deletion, preventing an older in-flight write or delayed sign-out from recreating old credential bytes or deleting a newer sign-in's bytes.
- Logout invalidates pending responses and disables unauthorized token-refresh while the authenticated server revocation request is dispatched with the existing bearer. It fences new OTP/refresh starts throughout logout, then clears credentials in the serialized native storage queue even if server revocation fails. UI becomes signed out after local deletion completes.
- No new schema or API: existing authenticated routes and persistence contracts serve as authority. Changes are client-side integration only; the existing release Android app has not been exercised here.

## Regression test source
Added to existing apps/mobile/test/session_state_test.dart using the repo's established deterministic Dio adapter and a mocked platform method channel *only in test*; no test-only authorization path in production:
1. Sixth-digit auto-submit / Verify tap issue a single POST /auth/verify and one secure token write.
2. Logout while verify HTTP is pending refuses the late successful token.
3. A new OTP context is not overwritten by an old invalid-code response.
4. Duplicate send in the same channel+identifier while pending issues one POST /auth/otp.
5. A deliberately paused native token write then logout completes with deleted tokens and signed-out state; fixture synchronizes from an explicit write-start Completer, not sleeps.
6. An authenticated logout receiving HTTP 401 never triggers an auth refresh and still clears the persisted session.

Existing tests for OTP error/name-required/refresh legacy migration and channel/server capabilities are retained. These are **written unexecuted tests**, NOT passing evidence.

## Verification executed and NOT executed
Executed: GitHub file/branch commits succeeded; no runtime/Flutter/Android tests executed in this connector-only window.

Unexecuted by this window (toolchain/CI #457 already blocked):
1. cd apps/mobile && flutter pub get
2. cd apps/mobile && dart format --output=none --set-exit-if-changed lib/src/state/session_state.dart lib/src/screens/onboarding/otp_screen.dart test/session_state_test.dart
3. cd apps/mobile && flutter analyze
4. cd apps/mobile && flutter test test/session_state_test.dart
5. cd apps/mobile && flutter test
6. cd apps/mobile && flutter build apk --release (after configured signing and release gates, do not publish)
7. Real supported Android: SMS and email sign-in against configured server/provider, six-digit auto-submit/button simultaneous tap, failed OTP then edit, resend cooldown/limit, NAME_REQUIRED registration, airplane mode, force-kill/relaunch, 401 refresh, sign-out when verification or secure native write is pending, account A→B and revoked sessions; independently re-read auth/session state and server profile. Do not use live personal OTPs or expose access tokens in logs.
8. Validate before merge with R17/C08 draft #493 routes, R14 Firebase and R03 cache #499 to ensure logout clears signed-in projections without route regressions; rerun at *merged* SHA.

CI incident #457: GitHub Actions account quota consumed, workflow jobs failed with zero steps, not evidence of code tests. Do not retry unavailable cloud runners repeatedly or claim green. The final **owner-designated ChatGPT Work integration window** must execute/fix these commands and verify them; no merge until then.

## Data/privacy/recovery, dependencies, risks
- Database/migrations: N/A (existing platform session backend authority). API authentication stays on server, app writes only existing versioned native secure session shape; secrets never in docs/tests.
- Logout revocation is best-effort on failed network; local deletion happens after the network call resolves. A hung server logout can delay signed-out navigation; actual network timeout/recovery must be device-tested. Server-side token expiry/rotation and backend session invalidation still govern. Secure-storage plugin must be tested on actual device; platform MethodChannel fake is unit test only.
- No new permission to read DMs, personas, ledger, or paid actions; no public Talk audio from OTP path.
- Low-speed OTP completion/retries must be tested against a real 401/429 and existing resendInSeconds. Concurrent signout/new auth behavior is subject to actual plugin and provider qualification.
- Fatal native secure-storage failures and sign-out delete exceptions should be reviewed with device evidence; the source does not invent a bypass or developer token.
- Rollback by reverting this branch changes only mobile sign-in control; restoring the prior code reintroduces duplicate/stale sign-in risks. Prefer fixing specific failures rather than reverting guards.
- Known source vs test distinction: whole sign-in/Android release qualification and whole R16 remain open. No DB/API/Flutter root code missing for *this isolated client concurrency seam*, but real integration execution is missing.

## Final ChatGPT Work next actions
1. Fetch this branch and PR at exact current HEAD, compare with latest main and PRs editing session/auth if any; obey 5-minute live claim.
2. Run formatter/analyzer/focused and full Flutter tests; fix compile/typecheck/formatter/test failures and rerun with recorded logs/SHA. Inspect paused secure-store fixture for hangs and async lifecycle.
3. Test with real authenticated server/device and dual-account/poor network/OTP provider scenarios; confirm secure storage, server re-login/revocation and no duplicate verification.
4. Reconcile existing R17/C08 root navigation, R14 push and R03 protected cache PR #499 without crossing ownership; include late callback/restart/logout J10/J11 evidence.
5. Keep draft/unmerged until full required evidence, then review for merge in the one Work integration window, update release ledger and document actual outcome at merge/deploy SHA.

## Release gate matrix
SOURCE_WRITTEN: YES. LOCAL_TESTED: NO. CI_EXECUTED: NO (#457). DB_INTEGRATED: preexisting route only, no new SQL; feature E2E UNVERIFIED. APP_INTEGRATED: existing UI/controller source, runtime UNVERIFIED. DEVICE_VERIFIED: NO. PROVIDER_QUALIFIED: NO. DEPLOYED: NO. MERGED: NO.
