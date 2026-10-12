# MUI-09 / AF13 — bounded combined regression on integrated UI source

## Named directory recovery continuation — 2026-10-12, PR #692

**Scope:** MUI-09/AF13 bounded AF07 directory journey: a signed-in fan opens
`/masana`, refreshes an available roster, encounters a transient outage,
retries, then receives authorization denial. The mounted picker incorrectly
kept a green availability dot when canonical presence became unknown. Green
now requires explicit `available`; other states stay neutral, with the existing
localized status exposed through accessibility semantics. Persona/chat routing,
account-fenced roster/cache authority and private feedback remain intact.

- Fresh base: `950fe2e5ac66d8162b8c151a30d268eaeee76493` (#691 delivered).
- Implementation/test source: `92d8ba67a1f83f8b293e29a35eb07cf521e5dc55`.
- Branch: `lane/af13-directory-presence-recovery-20261012`;
  [PR #692](https://github.com/weavewellindustrieslimited/masanawa/pull/692).
- Integration: PENDING_MAIN_MERGE. Scoped verification: **PASS_SIMULATED**;
  release **NOT_RELEASED**. Overall MUI-09 and unresolved feature acceptance
  remain **PARTIAL / OPEN**.

### Allocation and preserved source

Exact-path claim `af13-directory-presence-recovery-20261012` was acquired before
edits through the existing CAS registry; allocation commit
`fee79b3cbe799fbe7ddd054579c7598bd130358a`. The owner-authorized bounded
AF07→AF13 presentation/test allocation is recorded there. Four paths only:

- `apps/mobile/lib/src/screens/chat/masana_list_screen.dart` — actual mounted
  availability color and status semantics; no new presence authority.
- `apps/mobile/test/agent_directory_readiness_test.dart` — recover the released
  #460 malformed-presence correction: unknown/status-unverified/cache JSON,
  retaining explicit offline and recognized-state assertions.
- `apps/mobile/test/agent_recovery_test.dart` — recover released #460 semantic
  roster checks and add the real mounted 320px refresh/503/retry/401 journey.
- `docs/workstreams/UI-MUI-09-verification.md` — this handoff.

Latest Software Factory remains `b8e9437ea40ce22094758a4352d9c88462d3e17a`;
AGENTS/operating/verification/claim implementation reviewed. Current project
main-development policy governs integration. Fresh claims and paginated #616
comments still have no subsequent AF00/AF05 canonical inbox transfer. Preserve
#497 `82e4f436e47828be76088cabe2c9064a80a548ec`, #576
`aa88511f4add1bbcf9e213283088fea5a6b0561b`, prior narrow Chats recovery and
AF05 voice checkpoint `d9ec3a3c6`. #593 directory work at
`8d261cc2c857c0dcc963052dc5ff2f195d30027e` is disjoint and preserved.

Released #460 repairs were already available on
`work/shared-ci-recovery-work-20261008` at head
`06d30813b39e8681da30793d0b4e448a14ebd07c`. Only the two relevant assertion
repairs were recovered, preserving current Masana names and newer tests. No
wholesale ancestry merge, source deletion, auth/finance/router/voice/migration
or dependency change. SDK-generated lock/analysis changes restored to original
bytes; pub resolution was executed, not a frozen-lockfile qualification.

### Executed evidence

Runner: local official Flutter **3.47.7** (`abaf9c5237`), Dart **3.13.5**.
Tests use synthetic transports and real mounted widgets/controller/theme code;
no live server/account/provider or installed-app evidence.

- **RED:** original source plus new mounted test: **17 passed / 3 failed**.
  Both retained directory failures reproduced; new test proved the actual
  refresh indicator stayed green while controller presence was unknown.
- **PASS:** **35 focused tests**, directory readiness/recovery/cache fast-start,
  MUI-03 Chats and shell route compatibility. Mounted journey checks immediate
  revocation, retained persona after 503, neutral unknown indicator, accessible
  status, private-error redaction, restored availability after successful retry,
  and removal after 401. Existing stale-query/account/cache tests retained.
- **PASS:** focused Dart analysis, **zero issues**. Three pre-existing informational
  diagnostics in touched files were corrected without changing domain behavior.
- **FAIL:** full Flutter suite **578 passed / 6 failed**, source `92d8ba67...`.
  The two named directory failures now pass; remaining failures:
  `edit_profile_screen_test.dart` — missing profile offers real first-time creation;
  unsaved or invalid updates cannot be submitted; saved public profile survives
  leaving and reopening editor; failed save keeps previous server state for recovery.
  `talk_screen_test.dart` — listener opens Sponsor Seat sheet from Add AI;
  host opens direct Add AI semantics. No introduced failure found.
- Exact source-head Foundation [38315646012](https://github.com/weavewellindustrieslimited/masanawa/actions/runs/38315646012)
  **FAIL**: `packages/agents/src/talk-replay.test.ts(6,8)` TS2459, `TalkId` not
  exported. Mobile [38315646005](https://github.com/weavewellindustrieslimited/masanawa/actions/runs/38315646005)
  **IN_PROGRESS** at readback (Install); later steps not passed. Vercel **FAIL**:
  deployment build rate limit. Routine development merge is owner-authorized;
  these pre-existing global failures are retained, not waived.
- Whole analysis **NOT_RERUN**; prior executed **322 diagnostics / FAIL** retained.
  TalkId TS2459/global CI debt is not fixed or waived. Android SDK/signing/phone
  absent; prior APK blockage and MUI-10/AF11 qualification remain OPEN.
- Independent reviewer examined source `92d8ba67...` and canonical controller:
  **no actionable correctness/regression findings**. Non-English mounted status
  semantics are not separately qualified; existing localized status authority
  is reused. Hausa production English fallback/full translation remain OPEN.

Initial verification caught and corrected a non-null localization lookup in a
fixture without delegates, a merged-label assertion, and semantics-handle
cleanup timing. Final focused run passed; unsuccessful intermediate runs are
retained in `/workspace/scratch/directory-{red,green,green-final,focused}.log`.
Final logs: `directory-focused-final.log`, `directory-analyze-final.log`,
`directory-full-suite.log`. No CI/protection/test suppression or admin bypass.

```sh
cd apps/mobile
/workspace/flutter/bin/flutter pub get
/workspace/flutter/bin/flutter test --no-pub --reporter expanded \
  test/agent_directory_readiness_test.dart test/agent_recovery_test.dart \
  test/agent_directory_fast_start_test.dart test/ui/mui03_chats_search_test.dart \
  test/app_shell_route_compatibility_test.dart
/workspace/flutter/bin/dart analyze lib/src/screens/chat/masana_list_screen.dart \
  test/agent_directory_readiness_test.dart test/agent_recovery_test.dart
/workspace/flutter/bin/flutter test --no-pub --reporter expanded
```

### Acceptance and next action

The named simulated directory recovery journey is closed for the mounted
picker at the delivered source; canonical server/device qualification remains
OPEN. Two retained directory assertion failures are corrected by integrating
existing useful source. This does not close the full MUI-09 milestone.
Preserve the earlier **158 focused**, **24 corrected font-render cases** and
**27 audio rechecks PASS**, earlier full **575 passed / 8 failed**, and the
exact MUI-07 **496/9 → 524/10** results, optional-test-set caveat, outage fixture
repair and timing-sensitive audio failures/rechecks below and in MUI-07.
Different test sets/counts do not independently prove a production repair.

Prefer MUI-03 only after explicit AF00 trusted composition/auth/migration
transfers and AF05 `main.ts` coordination. Otherwise continue MUI-09/AF13
with a bounded AF14 transfer for the named first-time profile creation/save/
reload journey, reproducing its remaining failures before correction; preserve
its useful prior #460 source. MUI-04/06 require canonical protected composition;
MUI-07 MSN/funding/Send needs AF01/AF00 reconciliation with #576; MUI-08 exposes
`quotedAt`, not expiry, and needs AF01's authoritative contract. Keep MUI-10
signed installed identity and AF11 incoming/native/group/provider checks OPEN.
Do not rerun the same combined matrix as a replacement for missing integration.


## Earlier combined regression delivery (retained evidence)

## Identity and scope

Base: `576ecda13e8c3f9c034c325986a27376faa87589`, freshly cloned/fetched main.
Test-source checkpoint: **`df7ca6f1453ff646dfdeab28151724a3c4b20bc5`**,
branch `lane/af13-mui09-combined-20261012`. [PR #690](https://github.com/weavewellindustrieslimited/masanawa/pull/690) exact head
`3fbe06c82391841d33ff0b788740e67ada93669e`, normally merged at
**`3990d546972f9afec9f2e17117049add9e69883c`**, 2026-10-12 21:05:27 UTC.
Merged test blob equals the tested checkpoint exactly. Implementation: **INTEGRATED_SCOPED_TEST_SOURCE /
PARTIAL_MUI09_ACCEPTANCE**. Verification: **PASS_SIMULATED** for the named
focused/combined cases; full suite and whole analysis remain **FAIL**.
Release: **NOT_RELEASED**; no signed artifact, phone, live account or provider.

Exact CAS claim: `93f8ade5-997c-479c-aae1-fb325e7bb37c`, owner
`AF13 MUI-09 combined regression`, acquired 2026-10-12 20:51:19 UTC.
Only two paths allocated and changed:

- `apps/mobile/test/ui/mui09_combined_regression_test.dart`.
- `docs/workstreams/UI-MUI-09-verification.md` (this handoff).

No production source, existing test, auth, financial, voice, router,
composition, migration, dependency, CI or protection change. No new checker
or ownership registry. Five tabs, Chats default, Masana identities, newer
Calls/native/group/incoming/history/billing, Status/media and Rooms source
are preserved. No relabelled Cr/MSN, second ledger or provider activation.

## Fresh reconciliation and selection

Read AGENTS, CONTINUE-HERE, multi-window rules, queue/next-window seed,
MUI-03/07/08 handoffs and the relevant audit design/Task 8. Latest Software
Factory v0.4.4 still resolves to `b8e9437ea40ce22094758a4352d9c88462d3e17a`;
read its AGENTS, skill, operating, owner-default and verification references.
Current project/owner main-development policy supersedes older Factory
integration-only gates. Applied executing-plans, worktree, debugging,
verification and independent review guidance; already-approved design was
not reopened.

Fresh open PR heads retain #497 `82e4f436e47828be76088cabe2c9064a80a548ec`
and #576 `aa88511f4add1bbcf9e213283088fea5a6b0561b`. Registry remains held
by `cloud-api-v1-20261011` for AF00 composition and
`af05-android-voice-repair-20261012` for voice/`main.ts`. Latest paginated
#616 comments still end with [the existing bounded integration request](https://github.com/weavewellindustrieslimited/masanawa/pull/616#issuecomment-6128601248),
with no subsequent transfer. Expiry is not release. Prior narrow Chats
claim recovery, #497 unique source and AF05 voice work remain untouched.
The authorized fallback is MUI-09 bounded regression, not a claim that all
MUI-01…08 source acceptance is ready.

## Implemented regression and visual evidence

24 combined widget journeys: widths **320/360/390/430**, text scales **1/2**,
requested locales **en/ar/ha**. The actual `FiveTabShell`, domain screens,
production localization negotiation and theme mount in an injected test
GoRouter. Tests assert Chats default/five destinations, local empty/offline
query clear, query teardown on signed-in A→B→logout, simulated 300px keyboard
inset/clear control, each tab, balance outage with retained Crypto access,
real Crypto detail screen, visible Back button returning to Wallet, signed-out
Calls, and explicit legacy Status/Rooms unavailable states. The test fixtures
provide synthetic data/errors; they do not establish authenticated backend
search, provider authority or the full production router/deep-link bindings.

**Hausa remains unavailable as a native UI locale.** Production's
`MasanawaLocalization` deliberately resolves requested Hausa to English;
tests verify that exact fallback. Arabic direction and actual Arabic Wallet
navigation label render; much existing screen copy remains English.
Passing RTL geometry is not complete Arabic translation.

Optional capture defines produced **168 software-rendered fixture captures**
(7 screen states × 24 journeys). Official SDK Roboto/MaterialIcons and Google
Fonts NotoSansArabic were loaded. Test-only AppBar/chip/navigation font
substitution replaces Flutter test Ahem fallback without changing production
fonts or typography sizes. Representative 320px/2x English/Arabic sheets and
all-width 2x Wallet/Crypto/Chats-keyboard matrices were inspected. Exact values
wrap; navigation, clear, Crypto and Back remain reachable. Keyboard captures
show body content below the viewport; they do not qualify every scroll/IME
interaction. Initial captures had Ahem chip text/missing icon/Arabic glyphs
and are **not** counted as visual qualification; corrected captures overwrite
them. This is bounded synthetic visual evidence, not real mobile-device proof.

Initial run failed 24 cases because the test expected the wrong Wallet error
copy. After that fixture correction, 16 passed/8 failed because generated
locale lists incorrectly enabled Hausa without Material/Cupertino delegates.
Using production locale negotiation fixed the harness. No production defect
or localization workaround was introduced. Independent read-only reviewer
executed 24 passing cases and found no blockers; its three test suggestions
were incorporated (inset cleanup, Status error assertion, visible Back tap).
Final relevant checks were rerun after these test changes.

## Executed checks

Flutter **3.47.7** (`abaf9c5237`), Dart **3.13.5**, `/workspace/flutter`.
`flutter pub get` passed; generated lock/analysis-options edits were restored
to original bytes. Later checks used `--no-pub`; no frozen-lock qualification.

- **PASS, 158 focused tests**, final test source `df7ca6f1453ff646dfdeab28151724a3c4b20bc5`, command below. Includes 24 new combined cases and 134 preserved MUI-01/02/03/07/08, Wallet/Crypto/account/receipt/transport/root and Calls/history cases.
- **PASS, 24 corrected font-loaded combined render cases**, same source, 168 captures. Capture command below.
- **PASS, zero issues:** `dart analyze test/ui/mui09_combined_regression_test.dart`; `git diff --check`.
- **FAIL, 322 diagnostics:** full `dart analyze`. Production files unchanged; focused new-file analysis is clean. MUI-08's executed baseline comparison remains 322 versus 324, zero introduced; this is not a waiver or whole-analysis pass.
- **FAIL, 575 passed / 8 failed:** final `flutter test --no-pub --reporter expanded`, on the final test checkpoint. An earlier pre-final-render-loader run also finished **575 passed / 8 failed**. Names below; no failures hidden or tests disabled.
- **PASS, 27 tests:** `flutter test --no-pub --reporter expanded test/group_call_controller_test.dart test/talk_live_audio_session_test.dart`. Full-run and separate rechecks remain different evidence.
- **BLOCKED:** `flutter build apk --debug --no-pub` → `[!] No Android SDK found`. No APK/signing/device qualification.
- Backend compiler/Vitest/PG18/provider execution **NOT_RUN** locally: no backend source changed or trusted composition transferred. Existing standard CI is **FAIL**: delivered-main [Foundation #38300182291](https://github.com/weavewellindustrieslimited/masanawa/actions/runs/38300182291) fails Typecheck with later tests/build skipped; [#688 Mobile #38299948610](https://github.com/weavewellindustrieslimited/masanawa/actions/runs/38299948610) is now completed FAIL at Analyze, later tests/APK skipped. Current job logs could not be retrieved through the runner; do not infer new compiler details from that failure. Preserve MUI-08's prior executed TalkId TS2459 evidence and global diagnostics.

### Exact full-suite failures and retained historical caveat

The same eight historical failures remain reproduced in this window:

- `edit_profile_screen_test.dart`: missing profile offers real first-time creation; unsaved or invalid updates cannot be submitted; saved public profile survives leaving and reopening editor; failed save keeps previous server state for recovery.
- `agent_directory_readiness_test.dart`: malformed presence does not crash the whole agent directory.
- `agent_recovery_test.dart`: directory keeps roster on transient failure and clears it on 401.
- `talk_screen_test.dart`: listener opens Sponsor Seat sheet from Add AI; host opens direct Add AI semantics.

Preserve [MUI-07's exact earlier results](UI-MUI-07-wallet.md): baseline
**496 passed / 9 failed**, implementation **524 passed / 10 failed**. Its full
source run began before the final optional-callback test was added; its final
96-case focused run covered that addition. Baseline-only Wallet outage failure
was a corrected missing-theme fixture. Two unchanged timing-sensitive audio
cases failed its source full run: `group_call_controller_test.dart: paid
participant ends at consented duration cap` and
`talk_live_audio_session_test.dart: ended heartbeat closes media instead of
keeping synthetic audio alive`. Subsequent group-file (13), isolated baseline
duration-cap (1), and isolated source/baseline heartbeat (1 each) passed.
These historical failures/test-set differences are not erased by a newer run.
No claim that count changes across these different test sets prove a repair.

## Acceptance and smallest remaining action

| Acceptance | Current evidence / remaining owner |
| --- | --- |
| Combined narrow/large-text/RTL tab/query/keyboard/Wallet-Crypto Back geometry | 24 PASS_SIMULATED journeys + representative inspected font-loaded captures; live IME, populated full-account journeys, all supported actions and complete translation remain OPEN |
| Query/account teardown | Real mounted Chats widget A→B→logout query reset; existing account/controller/history race cases pass in focused set; live account/staging and full Crypto races OPEN |
| MUI-03 canonical server-wide inbox | OPEN, AF06 + explicit AF00 trusted composition/auth/migrations and AF05 `main.ts` coordination; existing #616 request and #497 recovery preserved |
| MUI-04 Status / MUI-06 persistent Rooms | OPEN, domain owners + AF00. Tests reproduce current legacy Talk outage projection; that does not satisfy canonical feed/Rooms resource acceptance. Unsupported New status `/talk/create` remains a known protected-shell gap |
| MUI-07 MSN/funding/Send | OPEN, AF01/AF00 reconcile #576 and canonical issuance/receipts/settlement; mounted Cr denomination is not renamed |
| MUI-08 expiry and live reconciliation | OPEN, AF01 authoritative expiry/admission contract: DTOs expose `quotedAt`, no expiry or bound quote identity. Never invent expiry in UI |
| Full-suite/profile/directory/Talk debt | OPEN, AF14 profile; AF07 directory/recovery; AF09 legacy Talk tests/source; AF13 coordinates exact-path transfers before any production correction |
| MUI-09 overall acceptance | PARTIAL; final focused regression does not close unresolved MUI-03/04/06/07/08, global diagnostics, staged services or fully localized/populated combined flows |
| MUI-10 installed identity / AF11 qualification | OPEN, release/device owner + AF11: Android SDK/signing/artifact/install identity and real incoming/native/group/provider checks absent |

No new production defect is attributed to this test-only patch. Existing
protected source gaps and reproducible baseline failures require their owner
transfers; this window does not seize those paths. Prefer MUI-03 when explicit
AF00/AF05 transfers are published. Otherwise AF13 should obtain the exact
owner allocation for one named failing customer journey and reproduce it on
fresh main before correction. Do not repeat this same matrix as a substitute
for required source integration, nor continue cosmetic extras.

## Reproducible commands

From `apps/mobile` with `/workspace/flutter/bin` on PATH:

```sh
flutter test --no-pub --reporter expanded \
  test/crypto_wallet_test.dart test/wallet_account_fencing_test.dart \
  test/ui/mui08_crypto_test.dart test/ui/mui07_wallet_test.dart \
  test/wallet_service_shortcuts_test.dart test/wallet_models_test.dart \
  test/wallet_http_transport_test.dart test/wallet_receipts_test.dart \
  test/ui/mui01_presentation_test.dart test/ui/mui02_auth_language_test.dart \
  test/ui/mui03_chats_search_test.dart test/ui/mui09_combined_regression_test.dart \
  test/app_shell_route_compatibility_test.dart test/calls_screen_test.dart \
  test/call_history_transport_test.dart

dart analyze test/ui/mui09_combined_regression_test.dart
dart analyze
flutter test --no-pub --reporter expanded
flutter test --no-pub --reporter expanded \
  test/group_call_controller_test.dart test/talk_live_audio_session_test.dart
flutter build apk --debug --no-pub

# Obtain the font from the official Google Fonts source for optional Arabic capture:
curl -fsSL 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosansarabic/NotoSansArabic%5Bwdth,wght%5D.ttf' \
  -o /workspace/scratch/NotoSansArabic.ttf
mkdir -p /workspace/scratch/mui09-renders
flutter test --no-pub --reporter expanded \
  --dart-define=MUI09_CAPTURE=/workspace/scratch/mui09-renders \
  --dart-define=MUI09_FONTS=/workspace/flutter/bin/cache/artifacts/material_fonts \
  --dart-define=MUI09_ARABIC_FONT=/workspace/scratch/NotoSansArabic.ttf \
  test/ui/mui09_combined_regression_test.dart
```

Local raw logs: `/workspace/scratch/mui09-{focused-final,renders-qualified,
focused-analyze-final,full-analyze-final,full-suite-final,audio-recheck,apk}.log`.
Fixture captures/contact sheets remain outside Git; no customer data.

## Integration and next continuation

PR #690 is merged into main at `3990d546972f9afec9f2e17117049add9e69883c`,
exact reviewed head `3fbe06c82391841d33ff0b788740e67ada93669e`. Main/test
blob `18c9645832781eab56a03ca754064220240195f5` was compared to `df7ca6f1453ff646dfdeab28151724a3c4b20bc5`
and matches exactly. No admin bypass/protection/test change. Exact-head
Foundation #38308371422 and Mobile #38308371576 were IN_PROGRESS at merge
readback, not passed; Vercel check FAIL reports build-rate-limit. The earlier
main/standard compiler and analyzer debt remains. This documentation-only
post-merge update changes no executable source. Release exact claim after
this handoff integration; registry release publishes the delivered identity.

```text
Continue weavewellindustrieslimited/masanawa from fresh origin/main.
Read AGENTS.md, CONTINUE-HERE.md, docs/MULTI-WINDOW-WORK.md,
docs/workstreams/UI-CONTINUATION-QUEUE-20261012.md,
docs/workstreams/UI-NEXT-WINDOW-PROMPT-20261012.md,
docs/workstreams/UI-MUI-03-chats.md, UI-MUI-07-wallet.md,
UI-MUI-08-crypto.md and UI-MUI-09-verification.md (all under docs/workstreams).
Read latest Software Factory instructions; reconcile fresh PR heads/claims.

MUI-09 bounded combined tests source df7ca6f1453ff646dfdeab28151724a3c4b20bc5.
PR #690 exact head 3fbe06c82391841d33ff0b788740e67ada93669e;
source merge 3990d546972f9afec9f2e17117049add9e69883c.
Ownership release is published on factory/claims after handoff integration.
158 focused tests and 24 font-loaded combined cases PASS_SIMULATED;
168 captures generated, representative matrices inspected; focused analysis
zero issues. Full suite 575 passed / 8 retained failures; 27 audio rechecks PASS. Full analysis remains 322 diagnostics;
APK blocked by missing Android SDK. Preserve MUI-07 exact failure names,
test-set caveat/audio rechecks and MUI-08 TalkId TS2459/global CI failures.
Hausa uses production English fallback; full Hausa/Arabic localization,
real IME/account/staging/provider/signed-device acceptance remains OPEN.

Prefer MUI-03 canonical server-wide inbox only with explicit AF00 trusted
composition/auth/migration transfers and AF05 main.ts coordination.
Preserve prior claim recovery, #497 unique source and AF05 voice work.
MUI-04/06 require canonical Status/Rooms composition through AF00;
MUI-07 MSN/funding/Send requires AF01/AF00 reconciliation with #576.
MUI-08 DTOs provide quotedAt, not expiry: obtain AF01 authoritative contract.
If protected dependencies remain unavailable, continue MUI-09/AF13 by
obtaining a bounded owner transfer for a named failing profile/directory/
Talk customer journey, then reproduce and fix it; no repeated checker,
cosmetic or documentation-only loop. MUI-10 needs signed artifact/install
identity and device runners; preserve AF11 native/incoming/provider work.

Preserve five tabs, Chats default, Masana-only identities, Calls/native/group/
incoming/history/billing, Status/media, Rooms, auth and finance. No second
ledger, Cr-to-MSN relabel, invented data, unsupported actions or provider
activation. Keep unfinished MUI-03/04/06/07/08 acceptance, full MUI-09,
MUI-10 installed identity and AF11 device/provider qualification OPEN.
Claim exact paths, implement relevant source/tests, execute checks, review,
commit/push/merge compatible work normally. Update the selected handoff,
release ownership and print the next queue-aware continuation prompt.
```
