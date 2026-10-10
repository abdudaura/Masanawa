# R04 — Create Talk participant actions and post-create handoff

- **Owner/window:** ChatGPT R04 create-intent integration, 2026-10-08T05:30:48.177Z
- **Branch:** `work/r04-create-participant-intents-20261008`
- **Base main SHA:** `88e67cc6c79de1ca09e02f11e929065dcfb2ea82`
- **Lane:** R04 / talks-live mobile Create/Host participant intent flow
- **Status:** HANDOFF / lease released; PR #433 DRAFT and unmerged pending executable tests and device integration
- **Last repository-visible update:** 2026-10-08T05:43:37.566Z

## Exact owned paths
- `apps/mobile/lib/src/screens/talks/create_talk_screen.dart`
- `apps/mobile/lib/src/screens/talks/create_talk_participant_handoff.dart` (new)
- `apps/mobile/lib/src/talks/talk_create_action_store.dart` (new)
- `apps/mobile/lib/src/router/app_router.dart` (shared navigation; collision-check before changes)
- `apps/mobile/lib/src/screens/talks/add_ai_seat_sheet.dart` (only focused optional initial-tab if needed)
- `apps/mobile/test/create_talk_participant_flow_test.dart` (new)
- `apps/mobile/test/talk_ai_seat_sheet_test.dart`
- `apps/mobile/lib/src/talks/talk_ai_seat.dart` (owner flag read-only DTO)
- `apps/mobile/test/talk_ai_seat_models_test.dart` (owner flag tests)
- `services/gateway/src/talk_ai_seats/model.ts` (owner flag DTO)
- `services/gateway/src/talk_ai_seats/service.ts` (viewer-scoped ownership computation)
- `services/gateway/src/talk_ai_seat_routes.test.ts` (ownership authorization assertions)
- `docs/workstreams/r04-create-participant-intents-20261008.md` (this checkpoint)

## Requirements / dependencies
- Existing canonical `talkTransportProvider.createTalk` must issue the Talk ID before invitations or AI Seat quotes.
- Real paid AI Seat quotes/confirmations remain exclusively server-owned via `showAddAiSeatSheet`; selecting an intent during draft must not charge or publish.
- Real human speaker invitations use existing Talk share/deep link, free of charge; no fake server invitation or phantom seat.
- Keep topic/title draft intact when choosing an action. Host becomes live in the Talk before optional AI selection.
- No edits to current R10 gift `talk_screen.dart`, R11 shell/localization, R09 worker, R12 account.
- Inspect main and active PR changed paths again before touching router; other integration windows own unrelated shared edits.
- Test acceptance requires Flutter widget tests and real Android/manual provider qualification; do not falsely claim tests passed.

## Work plan
1. Replace inert participant rows with actual intent selection and clear deferred timing.
2. Carry chosen action with created Talk safely into the real Talk entry and open authoritative existing sheet/share after route settles.
3. Add guarded lifecycle, error and no-double-open tests; hand off additional persona preselection if no pre-Talk candidate endpoint exists.
4. Publish PR, run available checks and leave evidence.

## Implemented checkpoint

- The Create screen's three formerly inert rows now toggle deliberate, labelled post-create intentions without starting a paid quote, admitting a speaker, or launching a non-existent Talk.
- On successful canonical Talk creation, the chosen actions are stored in `flutter_secure_storage` under that Talk ID. A failed storage write never reports the Talk creation itself as failed; the Host is told to use live Talk actions.
- The real `/talk/:id` route loads pending actions only for the Host; a persistent MaterialBanner lets the Host continue or skip, including after a return/restart. No new screen or alternate payment flow.
- Human Invite opens the existing OS share flow for the canonical `https://masanawa.com/talk/:id` link; a recipient then uses the existing public Talk/raise-hand/Host-approved free Speaker flow. Sharing is not misrepresented as seat admission.
- Expert/Twin selection opens the existing server-authorized AI candidate, fresh quote and explicit confirm sheet in the requested tab. A pending AI intent is **consumed before** the quote sheet can authorize a payment; closing the sheet or crashing cannot silently replay a new purchase. The Host can deliberately reopen Add AI within Talk.
- An empty Twin list offers a live `/my-twin` creation route; an empty Expert list has refresh and search results can be cleared.
- Dedicated Flutter widget tests cover Create persistence, Host-only restart, human share, initial Twin tab, missing Twin create navigation, invalid/repeated storage values, and fail-closed paid action on secure-store errors.
- No R10 `talk_screen.dart`, R09 runtime, R11 root shell, R12 identity, shared Gateway composition, database or financial contracts touched.

## Verification and remaining acceptance

- All code and tests are **committed, not Flutter-tested**: this tool environment has Node.js but no `flutter` or `dart` binary; no checked-out private repo. GitHub Actions may also fail before runner allocation. Required on an equipped runner: `cd apps/mobile && flutter test test/create_talk_participant_flow_test.dart test/talk_ai_seat_sheet_test.dart` and `flutter analyze`.
- Must verify handset creation -> Host LiveKit audio -> invited human request/Host admit and Expert/Twin quote/confirm/actual audible AI. Provider/network/second-device integration is NOT verified.
- No authoritative pre-Talk persona catalog endpoint exists in the inspected `/talks/:talkId/ai-seats` contract. This lane preserves **action intents** across creation/restart, not a specific Expert/Twin identity selected before a Talk exists. True pre-Talk persona ID selection plus a targeted human invitation registry are R04 integration follow-ups; do not mark the whole readiness item DONE.
- Release evidence: no production deployment, money movement, device acceptance, or passing test run from this window.

## Ownership-correctness expansion
Canonical catalog contains **all public Twins**; do not call them the Host's property. Extend the authenticated candidate DTO with a server-computed `isOwnedByViewer` (matching canonical twin owner to authenticated user), default false on malformed/legacy responses. Only the Create `Add My Twin` handoff filters to owned Twins; standard Add/Sponsor AI catalog remains unchanged. Do not infer ownership from name, presence or client-supplied IDs. Current open PRs R09/R10/R11/R12 own none of these added exact paths; recheck before modifying.

## Verified-owner Twin correction

The existing public `GET /talks/:talkId/ai-seats` catalog contains public Twins (not necessarily owned by the viewer). Previously calling its Twin tab `Add My Twin` would mislead Hosts and could cause them to hire somebody else's Twin unintentionally.

- The authenticated service projects `isOwnedByViewer` from canonical `twinOwnerUserId === authorized viewer.userId` for Twin rows. Experts are always false; the owner's user ID itself is not serialized.
- Flutter parses only literal `true`; omitted/malformed ownership on an older Gateway is treated as **unverified**, not owned.
- The normal public Add/Sponsor Twin catalog remains unchanged, but the Create action's `onlyOwnedTwin` sheet shows only the verified owner Twin and a real creator route if none qualifies.
- Added Gateway route regression for owner and nonowner responses, model tests for strict flag parsing, and picker widget test that a foreign public Twin is not selectable from `Add My Twin`.
- These backend + mobile changes require compatible Gateway and APK deployment; old Gateway does **not** prove an owned Twin. Still untested due absent enabled CI runners/Flutter runtime.

## Host authenticity and account isolation

- Canonical `toTalkDiscoveryItem` does **not** currently serialize `viewerIsHost`; client route hint `?host=1` is not authorization. Queued Create actions are now offered only after an authenticated `GET /talks/:id` detail read confirms that the canonical human Host participant ID exactly matches the current session's user ID. A forged `?host=1` cannot restore a prior Host's queued actions.
- Secure-store keys include the signed-in user ID **and** Talk ID, so changing accounts on the same device cannot cross-contaminate pending actions. The provider watches authenticated session identity; unsigned sessions fail closed.
- Tests cover forged Host route hints and server-side identity comparison. The broader existing `TalkScreen` uses separate UI hints; full Host role reconciliation belongs to R02/integration, not the R04 queued-intent overlay.
- Recheck actual Gateway/API projection, device restart and auth switch in the acceptance suite; these tests remain authored but not executed.

## Final handoff and CI evidence

- [PR #433](https://github.com/Baatiku/masanawa/pull/433) is mergeable per GitHub's diff check, but remains DRAFT and unmerged.
- The latest Mobile Build [run 37733778844](https://github.com/Baatiku/masanawa/actions/runs/37733778844) and Foundation CI [run 37733778849](https://github.com/Baatiku/masanawa/actions/runs/37733778849) both ended **before runner assignment** (runner_id=0; no steps). No application build/test result exists from those runs.
- Source tests are authored, not executed. Required smoke checks: `pnpm exec vitest run services/gateway/src/talk_ai_seat_routes.test.ts`, `pnpm --filter @masanawa/gateway-service typecheck`, `cd apps/mobile && flutter test test/create_talk_participant_flow_test.dart test/talk_ai_seat_models_test.dart test/talk_ai_seat_sheet_test.dart`, then `flutter analyze` and an Android device.
- Exact remaining R04 acceptance: precreate selectable persona IDs backed by an authorized preview service; targeted human recipient invitations if required beyond link sharing; reconciled live Host audio, AI admission, paid confirmation, voice playback, restart and two-device proof; locale coverage. The current implemented path is safe, functional at code level, but **not release-qualified**.
- Ownership is released for another window to run/refine/integrate after respecting current main/open PRs; no other PR files were overwritten. Do not merge solely because GitHub reports mergeable.

## R04 authenticated account-transition recovery claim — 2026-10-08

- Window: GPT-6 R04; older #433 claim released/stale, reuse existing draft branch and preserve all prior R04 code.
- At claim: main `226d0c58632b243661ab24904cca75700ed474d4`, existing draft PR #433 head `ca89231483da996014ebc5261141c139dc731c40`; five-minute rule checked against last PR update `2026-10-08T05:43:41Z`.
- **Exact fresh edit paths only:** `apps/mobile/lib/src/screens/talks/create_talk_participant_handoff.dart`, `apps/mobile/test/create_talk_participant_flow_test.dart`, this R04 handoff. Do not touch #493 root/router, R10 gifting, R06/R08 financial ledger, Gateway composer or migrations.
- Auth/privacy problem: server-verified Host intent banner is not invalidated if a long-lived Talk widget remains mounted through account change/logout; async secure-store and share/sheet callbacks can complete after ownership changes. Revalidate signed-in active viewer, cancel stale UI state, fence async operations across account/route transitions and test account A→B/sign-out/restart races. Ensure no automatic repeat of paid Seat intent.
- R04/T01/P03/N09/J01/J11; existing canonical Talk/Host API and per-account secure store are reused. No new SQL/financial API needed for this narrowly scoped auth boundary.
- **Status:** CLAIMED, source and tests not yet verified; full R04 is PARTIAL. Shared Actions #457 currently unresolved.

- **Coordinated R04 safety path extension:** `apps/mobile/lib/src/screens/talks/add_ai_seat_sheet.dart` and `apps/mobile/test/talk_ai_seat_sheet_test.dart` are additionally claimed only to fence existing quote/confirm and dismiss in-flight **modal** on authenticated account transition. Prior #433 owns these paths; no new financial service, price or authority. Existing payment request may already have reached server; never claim it was cancelled or refunded. Head before extension: `361dfe24fd2df5d41999b3e4d8148abb25d9e50e`. Do not edit shared router or R17-owned paths.

## GPT-6 continuation checkpoint — R04 authenticated account switch / pending quote recovery

- **Status:** **PARTIAL_IMPLEMENTATION** of global R04, existing draft PR [#433](https://github.com/Baatiku/masanawa/pull/433), **NOT DONE / NOT MERGED**. This bounded account-boundary source/recovery enhancement is written with new tests but remains **UNVERIFIED** pending executable runtime checks. Feature branch `work/r04-create-participant-intents-20261008`; canonical main at reclaim `226d0c58632b243661ab24904cca75700ed474d4` (main advanced during this window from `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`). Pre-claim R04 head `ca89231483da996014ebc5261141c139dc731c40`; fresh lease commit `2d89fab6eea549621aa1d99b02f88ed8fbe7db7a`.
- **Exact changed layers and source commits:** Flutter post-create authorization `apps/mobile/lib/src/screens/talks/create_talk_participant_handoff.dart` at `9d62f1302463359b99e4c7b12a8929c5df9f9464`; three identity/race widget tests `apps/mobile/test/create_talk_participant_flow_test.dart` at `361dfe24fd2df5d41999b3e4d8148abb25d9e50e`; modal scope claim `469fac25f26f52eda3f677acd3d2870e9b400412`; original authorized AI Seat modal `apps/mobile/lib/src/screens/talks/add_ai_seat_sheet.dart` account fences at `61797e7cdff7f2ba238c24197372f479f871e94f`, strict unauthenticated guard `c8dcba77f944f990cb47b567a3e7e6070a425a48`, immediate re-render `a50bd6924608e7fe812b61a0a8958facc19edfbe`; four modal tests at `0bc4517f3810165f40d70e6b36a8000259db0dde` plus signed-out denial test `c6fcb603a319ca5103a61bbae74f431c24514d51`. No other production paths changed in this continuation.
- **Behavior:** Host handoff now loads only under an active signed-in viewer after canonical server Host detail check; async guard/storage results must still match exact account, route/Talk ID and generation. Logout, A→B switch or Talk identity change immediately invalidates pending banner/account authority and prevents old write completion from opening a share or payment-capable quote UI. In-progress old-context store write is not replayed under B. The shared canonical AI Seat picker records opening account, refuses payment quotes without active sign-in, clears and hides stale quote/payment confirmation on identity change, fences late quote/confirm responses and closes the actual modal route (not the Talk root route). A pre-logout HTTP confirmation may already have reached the authoritative server; code never claims cancellation/refund, never sends a second payment to compensate. Existing verified-owner Twin semantics/Host prices/provider/ledger and free human share remain unchanged.
- **Auth/API/database/secrets:** Existing `sessionProvider`, server-backed `talkTransport.loadTalk` Host readback, per-account encrypted action store and authenticated AI Seat server quote/confirm are reused. **No new migration or backend route is required for this bounded UI identity recovery**, and none was edited. Provider/provider-priced financial confirmation remains server authoritative. Caller identity is never reconstructed from `?host=1` or a local cached flag.
- **Coverage authored, not run:** Three host-widget tests cover signed-in account switch and resume, logout, and a delayed storage save vs account B preventing paid picker. Five picker tests cover wrong-user quote clearing, stale quote response, stale confirmation response (one prior request possible), actual modal dismissal, and signed-out quote denial. Existing R04 tests preserved. No mocks in production; test controllers and transports are fixtures only.
- **Static GitHub readback:** Twelve of twelve specifically inspected source/test predicates passed against latest PR head before handoff `a50bd6924608e7fe812b61a0a8958facc19edfbe` (source blob SHAs `93c09f4b03172c93fc99ea4b778392f07d268def`, `ab74405f7dac2f62188bc3cacc41d4cb318acbd5`; test blobs `6aa6ac157f3248294f1a38a5e7ae9e3b1b5440e9`, `42117c02d99355d4c5ccb4f0c590d130301d4ade`). These are **static source assertions, NOT executed Dart/Flutter widget, Postgres, API integration or Android tests**.
- **Exact deferred commands for ChatGPT Work final integrator (#497):** `cd apps/mobile && flutter pub get && dart format --output=none --set-exit-if-changed lib/src/screens/talks/create_talk_participant_handoff.dart lib/src/screens/talks/add_ai_seat_sheet.dart test/create_talk_participant_flow_test.dart test/talk_ai_seat_sheet_test.dart && flutter analyze && flutter test test/create_talk_participant_flow_test.dart test/talk_ai_seat_sheet_test.dart test/talk_ai_seat_models_test.dart && flutter test && flutter build apk --debug`. Also `pnpm exec vitest run services/gateway/src/talk_ai_seat_routes.test.ts` and `pnpm --filter @masanawa/gateway-service typecheck`, disposable Postgres/auth tests of Host membership after account A→B, two-account live Android open/restored banner and payment quote, actual API/ledger once-only readback, cold restart/OS lifecycle/mic and human invitation/Host admission. Verify a real quote before A→B, during quote fetch, and during unknown outcome; always inspect ledger/request status instead of retrying money.
- **Blockers and mitigation:** shared Actions [#457](https://github.com/Baatiku/masanawa/issues/457) has documented zero-step/quota failures; this isolated GitHub editing environment has no Flutter/Dart SDK, real Android/LiveKit, Postgres or provider credentials. No repeated failed verification was attempted. Stop before provider charge or production deploy. Additional R04 scope remains missing/unverified: pre-Talk persona ID selection, targeted human invitation registry if required, two-device Host/AI audio and provider-confirmed Seat billing, full localization/accessibility, screenshot/performance and integrated product shell. No claims of acceptance for these.
- **Dependencies/collisions:** #493 R17/C08 owns `app_router.dart`; this continuation **did not** modify it. #433 had already changed that router and Work must reconcile it, not overwrite the five-tab shell. #449 R02 Host audio, #459 R09 AI stage, #443/#450 R15 safety, #435 profile, #468 C01 and #497 integration remain independent. No financial schema/ledger changes; no duplicated C02/C05/C06 implementation. Shared CI owner remains Work.
- **Release gates:** SOURCE_WRITTEN for this bounded recovery=YES; LOCAL_TESTED=NO; CI_EXECUTED=NO; DB_INTEGRATED=NO (actual cross-user proof); APP_INTEGRATED=UNVERIFIED; DEVICE_VERIFIED=NO; PROVIDER_QUALIFIED=NO; DEPLOYED=NO; MERGED=NO. No R04 milestone marked DONE.
- **Rollback/follow-up:** Use PR #433 source commits above, execute tests at a single combined merge SHA and reconcile #493. If account-watch causes an undesired pop or focus regression, revert only modal account-fencing commits, preserving prior Host/Twin authorization fixes, investigate with actual device/WidgetTester and submit forward fix. Do not merge unexecuted code.
