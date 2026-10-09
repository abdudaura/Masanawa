# MASANAWA-01 / AF14 — safe local AI chat clearing

Status: **PARTIAL_IMPLEMENTATION** (connected Flutter source and widget tests authored, Flutter execution/device acceptance NOT RUN). Date: 2026-10-09.

## Ownership and recovery

- Claim: `masanawa-01-af14-clear-local-ai-chat-20261009`, acquired and **read back before code edits** on GitHub CAS `factory/claims` branch, registry commit `97091ea050030eec965c15d40d7b743f8b8b2f64`.
- Owner/window: `MASANAWA-01`; lane `AF14`; work branch `work/af14-confirm-local-ai-chat-clear-20261009-masanawa01`.
- Base: `main@f381f077c485c04261459b77a42c215d3ce3a14b`.
- Source checkpoint: `16b48400a39f97649cae38847bf8415e62cf053d` (latest Settings change); Flutter test checkpoint: `a53ed9a3c56d75ce3cc83f478aaf7036fdb67915`. PR **#587** supplies the moving head SHA; review the exact new head before merging.
- Exact paths:
  - `apps/mobile/lib/src/screens/settings/settings_screen.dart`
  - `apps/mobile/test/audio_first/af14/clear_local_ai_chats_test.dart`
  - `docs/workstreams/AF14-clear-local-ai-chats-20261009.md`.
- No claims on router, SQL, Gateway, native, authentication or financial authority. AF00 baseline/route integration remains dependency; `#497` and local owner source must be reconciled before replacing other screen regions. #435 and #430 preserve separate profile/account source.

## Observed bug and connected fix

Main Settings offered `Clear all chats` with misleading local-everything copy and immediate one-tap invocation of `aiChatProvider.notifier.clearAll()`. The actual controller clears **local AI threads and current agent sessions**, not persistent server/human chats or wallet receipts. Its cache is account-fenced and `clearAll()` stops audio and temporary voice media; no new storage authority was introduced.

The real Settings action now uses `ClearLocalAiChatsTile` and explicitly describes its limited scope. A modal confirmation offers **Cancel** / **Clear local AI chats**. The current authenticated account is rechecked across the operation, the submit control prevents duplicate taps while pending, and success/error feedback is specific, safe and retryable. An error never falsely claims deletion. UI wording for About is adjusted to the approved new audio-first direction, and a false hardcoded installed build version is removed pending AF00/AF14 package metadata integration.

## Executable evidence and gaps

- GitHub exact-source readback: source blob `4a4311542d00f24f115bf6c81f775715b521ea48`; test blob `ca6ca3095da14c707f3dade45943e38bb852ab61`. Confirm these/updated blobs when integrating.
- **PASS_STATIC (17/17):** content-level checks exercised against fetched branch source/test for confirmation, busy guard, cancellation, account check, explicit local-only copy, no fake version, negative tests and error handling. This is **not Flutter execution**.
- Authored Flutter widget tests:
  1. Cancellation never invokes clear and copy excludes human/server/Wallet.
  2. Confirm invokes clear once; pending operation disables further submission.
  3. Failure is not leaked, feedback is recoverable, and retry can succeed.
- `cd apps/mobile && flutter test test/audio_first/af14/clear_local_ai_chats_test.dart`: **NOT RUN** — no Flutter/Dart installed in execution container, and container cannot resolve GitHub for a checkout.
- `flutter analyze`, all mobile tests, actual Android settings/locale/screen reader/logout/cache reread/device: **NOT RUN**.
- `AF14` overall is **NOT completed**: durable notification preferences, installed metadata, account/profile/avatar, activity and export/deletion qualification are still the lane's responsibilities. Financial/deletion/auth constraints remain unchanged. All backend/provider/production checks **NOT RUN**.

## Merge/release next action

PR [#587](https://github.com/Baatiku/masanawa/pull/587) is open against `main`. At PR head `a53ed9a3c56d75ce3cc83f478aaf7036fdb67915`, Mobile Build run **37993200966** and Foundation CI run **37993200932** both report failure with **zero job steps** (`114032427527`, `114032426679`). This is a CI runner/infrastructure failure, **not** a demonstrated Flutter/Dart test failure or pass. A qualified alternate Flutter runner is still required. AF00 must examine #497 overlapping Settings source and locally fixed APK/patch before integrating on a non-deploying safe target, execute the authored Flutter tests plus analyzer and apply tested source if compatible. Main push triggers GitHub Mobile Build and Foundation CI; external Git deployment triggers remain unqualified. **Do not auto-merge or deploy to main** without audited triggers and executable checks. This narrow Settings change is local UI only; no migrations, paid/provider operations or credentials were executed.

Acceptance mapping: `SA01` / `SA-A05` safe scope-confirmed local cache clearing, with other AF14 acceptance IDs pending. No claim of verified end-to-end or APK production readiness.
