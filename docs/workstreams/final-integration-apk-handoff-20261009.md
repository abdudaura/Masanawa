# Final integration handoff audit and APK recovery — 2026-10-09

**Status: PARTIAL_IMPLEMENTATION; APK COMPILATION EXTERNALLY BLOCKED; DRAFT/UNMERGED.** The user assigned the sole final integration window. No other writer is assumed active. This audit supersedes earlier 69-PR/92-document snapshots: a fresh two-page GitHub enumeration found **112 open PRs**; all **150 referenced or changed window handoff documents** were fetched at exact recorded heads. Eight handoffs were present in changed files but missing from PR body links; they are now indexed. Original owner claims are retained, not promoted to verified DONE.

## Repository-visible source and handoffs

- Base Work source: `d23a8fac4dc073ea5171e9d133a2c46253d664fe`; main parent `5e758673ae91082520b21b3153da53791ae2cbf3`.
- First 92-document preservation commit: `39ad1f7b3591a6ee3bfa0faf1f0c6a598c5ea6f8`.
- Tested bounded profile/C04 repair commit: `c105108aaa461ee6006e8fefb0a835f581e56710`. Eleven mobile source/test files and source-specific handoff are preserved; see `final-profile-media-verification-20261009.md`.
- `window-handoff-manifest-20261009.json` records every original PR/full commit/path/source blob and archive path. Duplicate filenames live under separate `window-handoffs/pr-N/` directories. `final-open-pr-ledger-20261009.json` contains all 112 pinned open heads.
- The base Work tree already retained 198 workstream documents; this archive adds exact current owner snapshots instead of overwriting their historical evidence.

## Executed verification

- Flutter **3.47.7**, Dart **3.13.5**: full local combined `flutter test --concurrency=2 --reporter expanded` — **874 passed, zero failures**.
- Focused profile/private media command — **28 passed**. Tests caught actual upstream stream cancellation and lazy form retention defects, now pushed in the bounded repair commit.
- Local combined `flutter analyze --no-fatal-infos --no-fatal-warnings`: **zero errors; 643 warning/info findings**. It is not a warning-free check.
- These combined local results apply to the larger recovered integration source; it was not fully published before the execution environment failed. Do not attach 874-test evidence to main or claim every unassembled API is enabled.
- First combined backend run: **1689 passed, 21 failed, 186 skipped; 303 files passed, 14 failed, 32 skipped**. Some failures came from omitted local baseline config/workflow/API manifest files, which were subsequently recovered; others are real source/package/test problems. No successful full backend retest occurred after all repairs.
- Workspace typecheck found new-package metadata/linking problems, exact optional-property errors, fixture UUID/mock typing issues and invalid U16 SQL/template source. Local repairs are partly prepared, but the final full check was interrupted.

## Exact external build blocker

Android release compilation progressed through native plugins and dependency resolution after installing the full JDK and Android SDK. The execution service disconnected and recovery then returned: **`409 Conflict, environment_offline: Environment is not connected.`** Existing session polling also failed with an exec-server transport disconnection/recovery timeout. A fresh command could not start. No completed APK was inspected or saved, and no successful build/signature/device claim is made.

Hosted fallback evidence: [Mobile Build run 37892805899](https://github.com/Baatiku/masanawa/actions/runs/37892805899) at `c105108aaa461ee6006e8fefb0a835f581e56710`, job `113697286985`, **failed with zero steps**. It is neither compiler/test evidence nor a produced artifact. Do not keep spending Actions retries or infer the exact quota reason without its error evidence.

## U01–U30 / F01–F18 accounting

All rows remain partial or qualification-pending. Document counts are evidence preservation, not feature completion.

| Scope | Source PRs | Pinned handoffs | Remaining integration/qualification |
| --- | --- | --- | --- |
| U01 | [#519](https://github.com/Baatiku/masanawa/pull/519) | 1 | Permission callbacks and approval binding; runtime capability catalog/qualified domain adapters remain gated. |
| U02 | [#520](https://github.com/Baatiku/masanawa/pull/520) | 1 | Durable task source; runtime service/migration integration remains open. |
| U03 | [#521](https://github.com/Baatiku/masanawa/pull/521) | 1 | Task-center Flutter tests executed locally; real U02 runtime binding remains open. |
| U04 | [#523](https://github.com/Baatiku/masanawa/pull/523) | 1 | Read-only adapter source; unknown-field route rejection and package composition need final retest. |
| U05 | [#522](https://github.com/Baatiku/masanawa/pull/522) | 1 | Opt-in memory source; production retention/admission integration remains open. |
| U06 | [#525](https://github.com/Baatiku/masanawa/pull/525) | 1 | Study source; null initial checkpoint and optional error code repairs remain local/unpublished. |
| U07 | [#524](https://github.com/Baatiku/masanawa/pull/524) | 1 | Verified artifact source PR; real journal/transport/runtime binding remains open. |
| U08 | [#526](https://github.com/Baatiku/masanawa/pull/526) | 1 | Selected-message consent source; backend fixture identifier error requires repair/retest. |
| U09 | [#534](https://github.com/Baatiku/masanawa/pull/534) | 1 | Private voice focus tests executed locally; provider/device voice acceptance remains open. |
| U10 | [#529](https://github.com/Baatiku/masanawa/pull/529), [#530](https://github.com/Baatiku/masanawa/pull/530) | 2 | #530 chosen for overlapping composer paths; #529 unique draft code retained, not blindly overlaid. Runtime send/outbox composition remains open. |
| U11 | [#531](https://github.com/Baatiku/masanawa/pull/531) | 1 | Search source/tests; canonical C02 secure read/jump composition remains open. |
| U12 | [#533](https://github.com/Baatiku/masanawa/pull/533) | 1 | Preview/review source; image/PDF send remains disabled until a qualified private upload port exists. |
| U13 | [#537](https://github.com/Baatiku/masanawa/pull/537) | 1 | Notification preference source; register API and qualify FCM device delivery. |
| U14 | [#535](https://github.com/Baatiku/masanawa/pull/535) | 1 | Host preparation source; concurrent fixture must model atomic reservation, then PostgreSQL/provider qualification. |
| U15 | [#536](https://github.com/Baatiku/masanawa/pull/536) | 1 | Stage copilot source; reject hostile keys before schema stripping, then bind qualified worker. |
| U16 | [#543](https://github.com/Baatiku/masanawa/pull/543) | 1 | Source repository contains duplicated/outside-template SQL; repair checksum/clearance predicates and re-test before registration. |
| U17 | [#538](https://github.com/Baatiku/masanawa/pull/538) | 1 | Twin training source; real interview/provider/publication qualification remains open. |
| U18 | [#546](https://github.com/Baatiku/masanawa/pull/546) | 1 | Twin quality/ledger views; real owner/readback qualification remains open. |
| U19 | [#539](https://github.com/Baatiku/masanawa/pull/539) | 1 | Accessibility/onboarding tests executed locally; low-end-device measurements remain open. |
| U20 | [#527](https://github.com/Baatiku/masanawa/pull/527) | 1 | Fail-closed release gates are source, not release/device evidence. |
| U21 | [#508](https://github.com/Baatiku/masanawa/pull/508) | 2 | Contacts Hub source; local nested route addition not published when environment went offline. |
| U22 | [#509](https://github.com/Baatiku/masanawa/pull/509) | 1 | Local-only phonebook source; opt-in OS permission/native-device acceptance remains open. |
| U23 | [#511](https://github.com/Baatiku/masanawa/pull/511) | 1 | Invitation source incorporated in Work baseline; Gateway runtime registration remains open. |
| U24 | [#510](https://github.com/Baatiku/masanawa/pull/510) | 1 | Privacy/request source and local controller reconciliation tested; publish/retest full integration. |
| U25 | [#517](https://github.com/Baatiku/masanawa/pull/517) | 1 | Scheduler source incorporated in baseline; timer and qualified push/worker binding remain open. |
| U26 | [#515](https://github.com/Baatiku/masanawa/pull/515) | 1 | Channel linking source incorporated in baseline; provider callback/runtime registration remains open. |
| U27 | [#516](https://github.com/Baatiku/masanawa/pull/516) | 1 | Admin source incorporated in baseline; atomic audit writer is mandatory before enablement. |
| U28 | [#514](https://github.com/Baatiku/masanawa/pull/514) | 1 | Research source incorporated in baseline; governed provider/runtime composition remains open. |
| U29 | [#512](https://github.com/Baatiku/masanawa/pull/512) | 1 | Support source incorporated in baseline; real support runtime/escalation and consent qualification remain open. |
| U30 | [#513](https://github.com/Baatiku/masanawa/pull/513) | 1 | Public discovery source incorporated in baseline; register safe public-only search runtime. |
| F01 | [#442](https://github.com/Baatiku/masanawa/pull/442), [#547](https://github.com/Baatiku/masanawa/pull/547) | 2 | Local semantic contrast repair; confirm final build and warning audit. |
| F02 | [#439](https://github.com/Baatiku/masanawa/pull/439), [#448](https://github.com/Baatiku/masanawa/pull/448), [#449](https://github.com/Baatiku/masanawa/pull/449), [#456](https://github.com/Baatiku/masanawa/pull/456), [#549](https://github.com/Baatiku/masanawa/pull/549) | 5 | Server/native grant safety; physical LiveKit reconnect/audio checks remain open. |
| F03 | [#441](https://github.com/Baatiku/masanawa/pull/441), [#495](https://github.com/Baatiku/masanawa/pull/495), [#499](https://github.com/Baatiku/masanawa/pull/499), [#545](https://github.com/Baatiku/masanawa/pull/545) | 5 | Retain persona/support catalog authorities; recover and qualify 17-persona/private Expert seed. |
| F04 | [#433](https://github.com/Baatiku/masanawa/pull/433), [#452](https://github.com/Baatiku/masanawa/pull/452), [#459](https://github.com/Baatiku/masanawa/pull/459), [#471](https://github.com/Baatiku/masanawa/pull/471), [#484](https://github.com/Baatiku/masanawa/pull/484) | 7 | Latest R04/R09/R10 handoffs preserved; actual gift ledger and stage A/B qualification remain open. |
| F05 | [#438](https://github.com/Baatiku/masanawa/pull/438), [#440](https://github.com/Baatiku/masanawa/pull/440), [#447](https://github.com/Baatiku/masanawa/pull/447) | 4 | Funding no-store recovery handoff preserved; each Flutterwave family and ledger/webhook/restart acceptance remains open. |
| F06 | [#444](https://github.com/Baatiku/masanawa/pull/444), [#454](https://github.com/Baatiku/masanawa/pull/454), [#487](https://github.com/Baatiku/masanawa/pull/487), [#490](https://github.com/Baatiku/masanawa/pull/490) | 5 | Keep #487 canonical; adapt #490 unique source only. Explicit risk policy required; never enable payouts by model/Flutter. |
| F07 | [#426](https://github.com/Baatiku/masanawa/pull/426), [#482](https://github.com/Baatiku/masanawa/pull/482), [#501](https://github.com/Baatiku/masanawa/pull/501), [#542](https://github.com/Baatiku/masanawa/pull/542), [#574](https://github.com/Baatiku/masanawa/pull/574) | 5 | Locale/ICU/bidi handoffs preserved; final locale and screen acceptance remain open. |
| F08 | [#430](https://github.com/Baatiku/masanawa/pull/430), [#443](https://github.com/Baatiku/masanawa/pull/443), [#446](https://github.com/Baatiku/masanawa/pull/446), [#450](https://github.com/Baatiku/masanawa/pull/450), [#451](https://github.com/Baatiku/masanawa/pull/451), [#488](https://github.com/Baatiku/masanawa/pull/488), [#489](https://github.com/Baatiku/masanawa/pull/489), [#491](https://github.com/Baatiku/masanawa/pull/491), [#494](https://github.com/Baatiku/masanawa/pull/494), [#496](https://github.com/Baatiku/masanawa/pull/496), [#548](https://github.com/Baatiku/masanawa/pull/548), [#571](https://github.com/Baatiku/masanawa/pull/571) | 12 | Safety/recovery source and overlapping reporting PRs retained; latest privacy/channel hardening must be reconciled. |
| F09 | [#453](https://github.com/Baatiku/masanawa/pull/453), [#503](https://github.com/Baatiku/masanawa/pull/503) | 10 | Latest signed-link, seek, stop/egress handoffs preserved; provider and permission-expiry playback checks remain open. |
| F10 | [#436](https://github.com/Baatiku/masanawa/pull/436), [#502](https://github.com/Baatiku/masanawa/pull/502), [#555](https://github.com/Baatiku/masanawa/pull/555) | 4 | Latest FCM credential-race hardening preserved as handoff; OAuth/device integration remains open. |
| F11 | [#460](https://github.com/Baatiku/masanawa/pull/460), [#461](https://github.com/Baatiku/masanawa/pull/461), [#479](https://github.com/Baatiku/masanawa/pull/479), [#485](https://github.com/Baatiku/masanawa/pull/485), [#492](https://github.com/Baatiku/masanawa/pull/492), [#500](https://github.com/Baatiku/masanawa/pull/500), [#518](https://github.com/Baatiku/masanawa/pull/518), [#527](https://github.com/Baatiku/masanawa/pull/527), [#554](https://github.com/Baatiku/masanawa/pull/554), [#557](https://github.com/Baatiku/masanawa/pull/557), [#559](https://github.com/Baatiku/masanawa/pull/559), [#561](https://github.com/Baatiku/masanawa/pull/561), [#563](https://github.com/Baatiku/masanawa/pull/563), [#566](https://github.com/Baatiku/masanawa/pull/566), [#567](https://github.com/Baatiku/masanawa/pull/567), [#569](https://github.com/Baatiku/masanawa/pull/569), [#570](https://github.com/Baatiku/masanawa/pull/570) | 15 | Local toolchain installed; hosted mobile job failed with zero steps and execution environment is offline. No APK/provider/backup acceptance claimed. |
| F12 | [#445](https://github.com/Baatiku/masanawa/pull/445), [#493](https://github.com/Baatiku/masanawa/pull/493), [#497](https://github.com/Baatiku/masanawa/pull/497), [#552](https://github.com/Baatiku/masanawa/pull/552) | 4 | Canonical five tabs preserved. One integrator; added local Contacts routes need source publication. |
| F13 | [#435](https://github.com/Baatiku/masanawa/pull/435), [#565](https://github.com/Baatiku/masanawa/pull/565) | 6 | Account/uncertain-write profile and full form retention repair pushed at c105108; handle alias migration remains missing. |
| F14 | [#468](https://github.com/Baatiku/masanawa/pull/468) | 10 | Latest C01 revision/uncertain-write/readback handoffs retained. Local U24 reconciliation requires publication. |
| F15 | [#472](https://github.com/Baatiku/masanawa/pull/472), [#475](https://github.com/Baatiku/masanawa/pull/475) | 4 | Canonical #472 schema; preserve #475 unique UI/outbox adaptation, never apply competing 0017 blindly. |
| F16 | [#473](https://github.com/Baatiku/masanawa/pull/473), [#474](https://github.com/Baatiku/masanawa/pull/474), [#476](https://github.com/Baatiku/masanawa/pull/476), [#483](https://github.com/Baatiku/masanawa/pull/483), [#486](https://github.com/Baatiku/masanawa/pull/486) | 8 | Canonical #474 encrypted index; retain #476 unique UX, #483 cursor/reset fences and #486 retention operator. |
| F17 | [#478](https://github.com/Baatiku/masanawa/pull/478), [#533](https://github.com/Baatiku/masanawa/pull/533) | 8 | C04 private audio and upstream cancellation repair pushed at c105108; real S3/native media acceptance remains open. |
| F18 | [#480](https://github.com/Baatiku/masanawa/pull/480), [#498](https://github.com/Baatiku/masanawa/pull/498), [#519](https://github.com/Baatiku/masanawa/pull/519), [#520](https://github.com/Baatiku/masanawa/pull/520), [#521](https://github.com/Baatiku/masanawa/pull/521), [#523](https://github.com/Baatiku/masanawa/pull/523) | 8 | Retain #480 account/history fences. Universal operator/runtime/service binding remains open. |

C09 #575 voice/video calls is additive; its source/hand-off is preserved separately, but native permission/token/device and runtime composition acceptance is not qualified. Firebase #461 has no `docs/workstreams` body reference; the canonical Work `docs/FIREBASE-LOCAL-COMPILATION-HANDOFF.md` and local configuration remain authoritative. #460 is shared CI evidence and #467 is a reference-only UX document; neither absence is hidden by an invented owner handoff.

## Resume commands and files

Recovered source: `/workspace/scratch/88b2711eedab/masanawa`; isolated Android build source: `/workspace/scratch/88b2711eedab/apk-build/apps/mobile`. Preserve local changes; the local Git root is a reconstructed snapshot, **not authentic upstream history**, so do not push that history. Publish source through an authentic checkout or a compare-and-swap Git tree/commit based on the current Work head. Root dependency lock must use pnpm **12.8.2**, not the environment fallback 11.25.0; put the 12.8.2 executable first on PATH so nested scripts use it.

Toolchain: `/workspace/scratch/88b2711eedab/flutter-sdk`; JDK `/workspace/scratch/88b2711eedab/jdk17/jdk-17.0.20.1+1`; SDK `/workspace/scratch/88b2711eedab/android-sdk`; `platforms;android-37.0`, plugin SDK 34/35/36, build-tools 37 and NDK 28.2.13676358 installed. Keep `CI=true FLUTTER_SUPPRESS_ANALYTICS=true TAR_OPTIONS=--no-same-owner`. CI prevents Flutter's metadata-service detection probe. Generate task-local Gradle HTTP/HTTPS proxy properties from the current invocation environment; proxy endpoints expire. Full JDK is required, and use `/etc/ssl/certs/java/cacerts` for the managed proxy trust store. Limit Gradle workers to two and run TypeScript workspace checks serially to avoid resource pressure.

Relevant logs in the workspace: `mobile-tests-final.log`, `profile-media-fixed.log`, `mobile-analyze-final.log`, `mobile-apk-verbose.log`, `backend-tests-combined.log`, `backend-typecheck-next.log`, `backend-lock-update.log`. Native build command used `flutter build apk --release -v` with the task JDK/SDK/Gradle home; expected output is `build/app/outputs/flutter-apk/app-release.apk`. Recover/reconcile all local source, rerun available checks, build the exact published source, inspect ZIP/manifest/minSdk/applicationId/signature/checksum, and save the APK as a user deliverable. The existing debug-signed local release APK fallback is for testing; store release signing remains fail-closed.

## Security and remaining acceptance

Preserve Firebase, canonical five tabs, real session/tenant fencing, private media authorization, explicit financial risk admission and all provider credentials outside source. Reject caller-owned authority fields before validators can strip them. Do not register a new write API before its service, migration, auth, audit and recovery dependencies are wired and tested. Real provider/PG/S3/FCM/LiveKit and physical-device checks remain unexecuted. No production changes, money spending, PR merge, force update or branch deletion occurred.
