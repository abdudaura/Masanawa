# Concurrent verification and final-integration freeze snapshot — 2026-10-09

**STATUS: AUDIT IN PROGRESS; NOT FINAL CONSOLIDATION; NO PR IS APPROVED FOR AUTOMATIC MERGE/CLOSE.**

Owner instruction: verify while independent windows finish, then pause new changes and consolidate frozen final heads with executed checks. This document records observable GitHub evidence, not a source-build pass or a replacement for immutable owner handoffs.

## Exact reference state

- Snapshot source: GitHub authenticated `GET /repos/Baatiku/masanawa/pulls?state=open` pages 1–4, observed 2026-10-09; **70 open PRs** at collection time.
- Main commit observed: `5e758673ae91082520b21b3153da53791ae2cbf3`. Main still does not contain the draft central work.
- Central Work integration: [#497](https://github.com/Baatiku/masanawa/pull/497), branch `work/work-lane-consolidation-20261008`, `98a6cba6515d52214d064a651a3cddad62439c1d` when the PR snapshot was fetched. At this concurrent backend handoff it has 522 filenames changed relative to main (GitHub paginated PR file inventory), including code/test/doc, but *filename presence is not blob equivalence*.
- The central branch is deliberately draft and must remain so while independently owned feature work and external qualification are outstanding. A complete independent [remote branch inventory](work-remote-branch-ledger-20261009.md) now records **583 remote branch refs and HEADs**, of which **70** match an open PR and **513** do not. Branches without an open PR still require historical diff/merge and active deployment checks; none has been deleted.
- GitHub Foundation CI on earlier central head `a423b11bb3589503109fbc9d99a1a710c84f9735`: failed job with **zero steps, runner_id 0**; hosted CI #457 quota exhaustion remains distinct from runtime source failures. Vercel also reports a separate failed status on that earlier head. Do not call either a passing test, and do not retry quota-blocked jobs.
- #497's latest handoff reports **1,609 backend passed, 186 skipped, zero failed** at code head `98a6cba6515d52214d064a651a3cddad62439c1d`; Gateway, Ops and scheduler strict TypeScript checks and production builds passed at that code head. These runs are documented evidence, not independently rerun by this audit window. An earlier mobile checkpoint reports 652 Flutter passes. **No reported result qualifies the future full composite, real DB, devices or providers.** Device, live providers, PG18 and FCM are still not verified by this snapshot.

## Firebase preservation — do not delete #461 yet

- Firebase [#461](https://github.com/Baatiku/masanawa/pull/461) HEAD `11de4361eb7924108b5bd888101eaaac46be5a0a`: all **10 file paths** from its paginated PR inventory are present in central #497's changed-file inventory, including `.firebaserc`, Android/iOS native configuration, package ID, local qualifier and architecture identity tests. This is positive source-presence evidence only; require exact diff, final build, and actual push qualification before closing #461 as superseded.
- Inspected central native `apps/mobile/android/app/google-services.json`: project `masanawa-mobile`, Android package `com.masanawa.app`; inspected central iOS `GoogleService-Info.plist`: project `masanawa-mobile`, bundle `com.masanawa.app`, iOS Google app ID present. No secret values are copied into this audit.
- Local agent must provide private `FIREBASE_API_KEY`, `FIREBASE_APP_ID`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_PROJECT_ID` via an external JSON file. See `docs/FIREBASE-LOCAL-COMPILATION-HANDOFF.md`; service-account JSON stays server-side. Real Android/iOS compile, installation, FCM, APNs, token sign-out and deep links unverified.
- A narrow post-audit commit `1ea2cb8f41e0db57832c50697082aa872e01c507` updates only `scripts/qualify-first10-android.ps1` to reflect the canonical five tabs, FCM/device checks and distinguish release-mode APK from store distribution qualification. No credentials, SDK IDs or financial authority changed. Script not executed in this connector-only window.

## Semantic collisions and missing composition (path counts, not acceptance)

| PR source | File paths present in #497 / PR total | Required semantic disposition |
| --- | ---: | --- |
| #468 C01 contacts | 20/20 | Pagination and handoff paths present; still review exact auth/migration behavior with #510 |
| #472 C02 canonical DM | 18/18 | Reconcile with #475's divergent 0017/contract; exact same path does not prove latest |
| #475 alternate C02 | 10/19 | Salvage unique Flutter/chat/outbox and tests; never install a second competing migration |
| #473 C03 earlier | 12/13 | Source ancestry only; use staged #483 then #486, do not merge all three independently |
| #483 C03 recovery | 14/14 | Cursor/journal retention semantic test and readback |
| #486 C03 retention | 6/6 | Stacked retention operator; integration and security gates |
| #478 C04 human voice media | 18/25 | Backend present; seven Flutter audio files not in central changed-file inventory |
| #474 C05 offline cache | 1/13 | Source not yet composed; #474/#476 both touch `apps/mobile/pubspec.yaml` |
| #476 C05 alternate cache | 1/11 | Choose one encryption/cache/outbox model and salvage tests/dependencies |
| #487 C06 canonical crypto | 13/17 | Backend selected with risk policy fail-closed; four mobile transfer paths not in central changed-file inventory |
| #490 C06 alternate ledger | 10/20 | 11-file direct overlap with #487; reject duplicate 0110, compare unique domain tests |
| #493 five-tab shell | 26/26 | Present paths need final Flutter/runtime acceptance and fresh head comparison |
| #503 replay/seek | 7/7 | Post-await seek authority paths present; Flutter tests and device seek proof pending |
| #508 U21 Contacts Hub | 0/4 | Entire module pending |
| #509 U22 on-device address book | 0/8 | Entire consented module pending; reconcile pubspec and native permissions |
| #510 U24 message privacy | 2/6 | Existing contact-controller/screen overlap; remaining private screen/tests/handoff missing |
| #511 U23 invitations | 9/16 | Backend/docs present; five Flutter and two web paths remain |
| #512 U29 customer support | 12/17 | Backend/docs present; five Flutter paths remain |
| #513 U30 discovery | 4/10 | Backend/docs present; six Flutter paths remain |
| #514 U28 governed research | 11/14 | Backend/docs present; three Flutter paths remain |
| #515 U26 channel linking | 12/15 | Backend/docs present; three Flutter paths remain |
| #516 U27 Ops admin | 6/11 | Ops backend/docs present; five admin Flutter paths remain; mutation disabled without atomic-audit writer |
| #517 U25 scheduler | 16/21 | Backend/package/docs present; five Flutter paths remain; worker/FCM still unregistered |

**Important:** Ratios compare only GitHub changed-filename sets. A path may be present on both branches with *different content or semantics*; zero overlap does not imply safe runtime composition. #497 now has backend source recovery and handoff test evidence for these modules, but not their absent Flutter/web paths or integration readiness.

## Required pre-merge and cleanup sequence

1. Obtain exact final committed HEAD and signed/precise handoff per owner PR. Stop new feature writes for a short freeze. Refresh this inventory, including PRs created after the snapshot; enumerate **all** remote branches, including orphan branches without open PRs.
2. Compare frozen HEADs and unique blob/content diffs against central #497; distinguish `ALREADY_PRESENT_EXACT`, `PRESERVE_UNIQUE`, `SUPERSEDED_WITH_EVIDENCE`, `DEFER_UNVERIFIED`, and `MERGE_VERIFIED`. Require SHA-specific outcome and owner evidence for every row. Do not auto-close any branches from filename overlap alone.
3. Compose C01/C02/C03/C04/C05 messaging + five-tab shell in one known API/migration/auth lineage. Preserve optional Contacts privacy and prevent all-message AI access by default.
4. Compose U21–U30 + F recovery in dependency order, with explicit protected-file ownership for shared Gateway routers, Ops bootstrap, root Flutter router and pubspec/lockfile. Keep scheduler, agent skill writes, provider payouts and crypto operations fail-closed until authority/security tests qualify them.
5. At a *single final composite SHA* run frozen install, backend Vitest, architecture/source lifecycle, strict Gateway/worker/ops typechecks + builds, Flutter analyzer + widgets for consumer and admin, real PG18 migration/rollback/restore and financial negative tests. Record all skipped/failing results without suppressing gates.
6. Native Android package/sign/install/FCM and optional iOS/APNs test, two-device contacts/DM/offline/realtime, LiveKit/Gemini audio, S3 private media and actual provider qualification are separate release gates. Local values remain outside git.
7. Merge only verified code, close PRs only after documenting accepted or superseded unique diffs; remove only fully accounted-for branches by exact SHA after review, and produce one closure table per R01–R19, C01–C08, U01–U30, F01–F18 and K01–K20.

## All open PRs — exact branch heads at snapshot

All rows below are **OPEN** at time of collection. A draft/open flag alone is not an acceptance status. No entries have been merged or closed by this audit.

| PR | Head SHA (prefix) | PR state | Description |
| --- | --- | --- | --- |
| [#426](https://github.com/Baatiku/masanawa/pull/426) | `75cb6a3ae9c2` | Draft | R11: Localize four-tab shell, agent presence and public Twins |
| [#430](https://github.com/Baatiku/masanawa/pull/430) | `df47cd8bbff6` | Draft | R12: Audited financial exposure and crash-recoverable deletion review worker |
| [#433](https://github.com/Baatiku/masanawa/pull/433) | `7a2778c82b78` | Draft | R04: Connect Create Talk participant actions to safe post-create invite and AI Seat flows |
| [#435](https://github.com/Baatiku/masanawa/pull/435) | `145da2fedeee` | Draft | R18: Integrate canonical WebP/S3 avatar upload, crop, CAS and durable cleanup |
| [#436](https://github.com/Baatiku/masanawa/pull/436) | `f846004ca01a` | Draft | R14: Harden FCM retry, OAuth recovery and multi-device delivery |
| [#438](https://github.com/Baatiku/masanawa/pull/438) | `4b823ffd40e7` | Draft | R06: Separate verified NGN balance from Credits with fail-closed recovery |
| [#439](https://github.com/Baatiku/masanawa/pull/439) | `62ec4ccfe2d2` | Draft | R02: Make Host live-session renewal atomic and reject disconnected leases |
| [#440](https://github.com/Baatiku/masanawa/pull/440) | `97936c102ee1` | Draft | R05: Restore authenticated bill funding instructions after restart |
| [#441](https://github.com/Baatiku/masanawa/pull/441) | `3a7465e6e4c4` | Draft | R03: Restore missing canonical support agent after interrupted bootstrap |
| [#442](https://github.com/Baatiku/masanawa/pull/442) | `86ed75fd769a` | Draft | R01: Give shared primary actions accessible green contrast and safe states |
| [#443](https://github.com/Baatiku/masanawa/pull/443) | `287191c787ba` | Draft | R15: Enforce persona safety across paid AI Seat authorization |
| [#444](https://github.com/Baatiku/masanawa/pull/444) | `9836854f5343` | Draft | R08: Isolate crypto wallet state across sign-out and account switching |
| [#445](https://github.com/Baatiku/masanawa/pull/445) | `37a1c190110f` | Draft | R17: Safe Wallet-to-private-Talk service selection (unverified draft) |
| [#446](https://github.com/Baatiku/masanawa/pull/446) | `dd2d75db3998` | Draft | R15: Scope Talk gifts to authorized viewers and safety-visible targets |
| [#447](https://github.com/Baatiku/masanawa/pull/447) | `c5ece5920b0b` | Draft | R07: Refuse ambiguous bill plans and model-invented payment confirmations |
| [#448](https://github.com/Baatiku/masanawa/pull/448) | `bc2dafe54beb` | Draft | R02/R19: Fence concurrent AI Seat turns and persona reassignments |
| [#449](https://github.com/Baatiku/masanawa/pull/449) | `71186a009a69` | Draft | R02: Fence LiveKit AI dispatch identity, duplicate jobs and uncertain sends |
| [#450](https://github.com/Baatiku/masanawa/pull/450) | `a06b154893f5` | Draft | R15: Gate restricted replays and reciprocal Host blocks in Talks |
| [#451](https://github.com/Baatiku/masanawa/pull/451) | `eb14419a5290` | Draft | R15: Require genuine Telegram private identities and bound WhatsApp webhook bodies |
| [#452](https://github.com/Baatiku/masanawa/pull/452) | `7a6a5092f14f` | Draft | R09: Expose only safety-approved Talk comments to AI stage context |
| [#453](https://github.com/Baatiku/masanawa/pull/453) | `b624646dece4` | Draft | R13: Recover replay with exact media stop time and ready-first publication |
| [#454](https://github.com/Baatiku/masanawa/pull/454) | `df4e4c72cbcc` | Draft | R08: Require quote-specific crypto consent, never model-generated approval (draft) |
| [#455](https://github.com/Baatiku/masanawa/pull/455) | `26a19e603d38` | Draft | R16: Block Android app-data backups and plaintext network traffic |
| [#456](https://github.com/Baatiku/masanawa/pull/456) | `20aef41f031b` | Draft | R02: Revoke microphone grants on LiveKit mute/reconnect failures |
| [#459](https://github.com/Baatiku/masanawa/pull/459) | `e8523f64ecf1` | Draft | R09: Supply authorized public Talk stage to production Gemini Live worker |
| [#460](https://github.com/Baatiku/masanawa/pull/460) | `afb47ebdbced` | Draft | Shared CI recovery: confirmed Actions quota exhaustion and Work verification |
| [#461](https://github.com/Baatiku/masanawa/pull/461) | `11de4361eb79` | Open | Configure Firebase for Masanawa mobile |
| [#467](https://github.com/Baatiku/masanawa/pull/467) | `2f9c8d5d1712` | Draft | docs: messaging UX benchmark and implementation guide |
| [#468](https://github.com/Baatiku/masanawa/pull/468) | `fefd2443dfd5` | Draft | C01: private contact admission with Work-verified backend and Flutter tests (draft) |
| [#471](https://github.com/Baatiku/masanawa/pull/471) | `b6186eae6663` | Draft | R10: repair corrupt durable Talk gift transport and empty catalog flow |
| [#472](https://github.com/Baatiku/masanawa/pull/472) | `344c56fd5b55` | Draft | C02: authenticated durable human DM backend and isolated Flutter conversation (draft, unverified) |
| [#473](https://github.com/Baatiku/masanawa/pull/473) | `07f52032fc6c` | Draft | C03: claim private human messaging realtime and recovery lane (draft) |
| [#474](https://github.com/Baatiku/masanawa/pull/474) | `0567c829027d` | Draft | C05: protected indexed offline human DM cache and durable retry journal (draft) |
| [#475](https://github.com/Baatiku/masanawa/pull/475) | `91973de51384` | Draft | C02: authenticated durable human text messaging with PostgreSQL and Flutter (draft) |
| [#476](https://github.com/Baatiku/masanawa/pull/476) | `0ebf63c1d14b` | Draft | C05: encrypted local-first human Chats cache, outbox and widgets (draft, integration blocked) |
| [#478](https://github.com/Baatiku/masanawa/pull/478) | `39cd76b1304d` | Draft | C04: bounded authenticated private human voice notes (draft, integration unverified) |
| [#479](https://github.com/Baatiku/masanawa/pull/479) | `65c53ecd9060` | Draft | R16: portable schema migration status, guarded apply and disposable recovery rehearsal (draft) |
| [#480](https://github.com/Baatiku/masanawa/pull/480) | `6a0f8e456168` | Draft | C07: Assistant Gwani/Gwana transport continuity adapter (partial, unverified) |
| [#482](https://github.com/Baatiku/masanawa/pull/482) | `ee3faff4b3fb` | Draft | R11: expose secure UI language preference in Settings (draft, unverified) |
| [#483](https://github.com/Baatiku/masanawa/pull/483) | `65c91bb239f9` | Draft | C03: recover realtime source and fence pruned cursors (draft, unverified) |
| [#484](https://github.com/Baatiku/masanawa/pull/484) | `fc60bbd2c401` | Draft | R10: require fresh catalog after uncertain gift send (draft, unverified) |
| [#485](https://github.com/Baatiku/masanawa/pull/485) | `0873733191db` | Draft | R16: refuse non-empty disposable databases before schema rehearsal (draft, unverified) |
| [#486](https://github.com/Baatiku/masanawa/pull/486) | `f3d606e2ae04` | Draft | C03: guard journal retention operator with tenant preflight and bounded batches (stacked) |
| [#487](https://github.com/Baatiku/masanawa/pull/487) | `0950b0ce091e` | Draft | C06: internal crypto transfer with custody & active-user guards — DRAFT / UNVERIFIED |
| [#488](https://github.com/Baatiku/masanawa/pull/488) | `0d56bd58d866` | Draft | R15: bound WhatsApp and Telegram provider response bytes and lifetime (draft, unverified) |
| [#489](https://github.com/Baatiku/masanawa/pull/489) | `73a392342cfc` | Draft | R15: persona reporting source [MERGE-STOP: overlaps #491; draft] |
| [#490](https://github.com/Baatiku/masanawa/pull/490) | `532b158e7790` | Draft | C06: partial internal crypto ledger/Gateway/Flutter transfer (draft; compare #487; unverified) |
| [#491](https://github.com/Baatiku/masanawa/pull/491) | `59b0ccc47ab7` | Draft | R15: Report Expert and Twin personas privately (draft, unverified) |
| [#492](https://github.com/Baatiku/masanawa/pull/492) | `7453199a6aff` | Draft | R16: reject ambiguous and hostile Android deep-link hints |
| [#493](https://github.com/Baatiku/masanawa/pull/493) | `050b101c3f70` | Draft | R17/C08: integrate five-tab Flutter shell and typed private routes (DRAFT, unverified) |
| [#494](https://github.com/Baatiku/masanawa/pull/494) | `84f516e14b61` | Draft | R15: authenticated human-profile block and mute with readback (draft) |
| [#495](https://github.com/Baatiku/masanawa/pull/495) | `d2dc8982330c` | Draft | R03: secure and recover default support-agent selection (DRAFT, unverified) |
| [#496](https://github.com/Baatiku/masanawa/pull/496) | `fcfd820abf08` | Draft | R15: authenticated human-profile report with durable retry (draft, unverified) |
| [#497](https://github.com/Baatiku/masanawa/pull/497) | `98a6cba6515d` | Draft | Work: unify R/C foundations with revised U/F plans and passing backend gates |
| [#498](https://github.com/Baatiku/masanawa/pull/498) | `9cff45ffa4cb` | Draft | R19: role-safe AI persona response and explicit private-chat disclosure (DRAFT) |
| [#499](https://github.com/Baatiku/masanawa/pull/499) | `352fc8a7e814` | Draft | R03: protect offline agent directory roster, purge plaintext and fence logout races (draft) |
| [#500](https://github.com/Baatiku/masanawa/pull/500) | `5c293078f970` | Draft | R16: single-flight OTP verification and safe session/logout races (draft) |
| [#501](https://github.com/Baatiku/masanawa/pull/501) | `6ad0f937737a` | Draft | R11: localize authoritative Billing journey and receipts (draft, unverified) |
| [#502](https://github.com/Baatiku/masanawa/pull/502) | `4b0811502006` | Draft | R14: actor-free Talk push previews and safe Flutter foreground copy (draft, unverified) |
| [#503](https://github.com/Baatiku/masanawa/pull/503) | `33cf9adb2309` | Draft | R13: Reauthorize expiring private replay audio and prevent signed-link caching (draft) |
| [#508](https://github.com/Baatiku/masanawa/pull/508) | `3e2e78061f1b` | Draft | U21: human Contacts Hub with C01 admission, C02 compose and account-fenced favorites (draft) |
| [#509](https://github.com/Baatiku/masanawa/pull/509) | `36a51277a246` | Draft | U22: opt-in local-only phone contacts and consent-safe invitations (draft) |
| [#510](https://github.com/Baatiku/masanawa/pull/510) | `7deb1dd40e6b` | Draft | U24: revision-fenced contact request inbox and privacy readback (DRAFT, unverified) |
| [#511](https://github.com/Baatiku/masanawa/pull/511) | `be18b77cd4d2` | Draft | U23: privacy-fenced invitation and opt-in public sharing (draft) |
| [#512](https://github.com/Baatiku/masanawa/pull/512) | `ec460e99e295` | Draft | U29: Consent-based customer support, read-only payment status and triage (UNVERIFIED) |
| [#513](https://github.com/Baatiku/masanawa/pull/513) | `b4ab386f74be` | Draft | U30: authenticated public discovery for Talks, People, Experts and Twins (draft) |
| [#514](https://github.com/Baatiku/masanawa/pull/514) | `a7aad218d51c` | Draft | U28: governed research provider, provenance, quotas and mobile source cards (draft) |
| [#515](https://github.com/Baatiku/masanawa/pull/515) | `4a7e66faeca3` | Draft | U26: secure opt-in WhatsApp/Telegram assistant channel linking (draft, integration gated) |
| [#516](https://github.com/Baatiku/masanawa/pull/516) | `4e16c5957e8b` | Draft | U27: privilege-fenced agent operations catalog and safe skill removal (partial, unverified) |
| [#517](https://github.com/Baatiku/masanawa/pull/517) | `a0d7e83f4f9d` | Draft | U25: consented durable operator reminders with safe occurrence leasing (DRAFT) |

Current audit result: **one release-qualification source correction and this all-PR ledger committed on #497**, in parallel with a separate backend-recovery handoff; all other open PRs retained, no financial/provider activation, no native secrets changed, no unverified automatic merge/deletion or claims of completed combined tests.


## Firebase exact-content cross-check — 2026-10-09

Compared `codex/firebase-masanawa-mobile` (#461 at `11de4361eb7924108b5bd888101eaaac46be5a0a`) with current `work/work-lane-consolidation-20261008` using the GitHub contents API for all ten exact PR file paths. **Nine paths are identical after normalizing CRLF/LF and trimming the final newline only.** Those nine are `.firebaserc`, Android Gradle application configuration, Android `google-services.json`, the Kotlin MainActivity, Android Gradle settings, iOS Xcode project configuration, iOS `GoogleService-Info.plist`, the original first-ten launch handoff, and the architecture mobile identity test. The original and integrated Firebase JSON parse to identical structures and values; no credential contents are reproduced here.

The tenth path, `scripts/qualify-first10-android.ps1`, is **intentionally enhanced** on the integration branch: it preserves `-FirebaseDefinesFile`, Firebase validation and the `com.masanawa.app` identity, and adds correct five-tab, FCM/device and release-signing qualification messaging (commit `1ea2cb8f41e0db57832c50697082aa872e01c507`). This establishes concrete source preservation rather than mere filename overlap; however the local build, Android/iOS native linking, backend service-account deployment, FCM/APNs delivery and low-memory phone acceptance still require execution.
