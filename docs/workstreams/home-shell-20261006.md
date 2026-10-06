# Home shell lane claim — 2026-10-06

- **Lane:** H — Home shell components
- **Owner/window:** ChatGPT Home shell implementation window
- **Branch:** `work/home-shell-20261006`
- **Base:** `f3aea97a1cf74736c567950ca3091eef91806406` (PR #198 docs overlay)
- **PR:** #201 — `Build isolated Home shell components`
- **Status:** HANDOFF READY — isolated lane complete; only shared integration/production dependencies remain.
- **Task scope:** Home presentation/state/components only; no shared router, Gateway composition, production environment, Commerce/Event migrations, or chat transport.
- **Owned paths:**
  - `apps/mobile/lib/src/home/**`
  - `apps/mobile/test/home/**`
  - `docs/workstreams/home-shell-20261006.md`
- **Explicitly not owned:** `services/gateway/src/app.ts`, `services/gateway/src/main.ts`, `apps/mobile/lib/src/router/app_router.dart`, `apps/mobile/lib/src/screens/chat/ai_chat_screen.dart`, `apps/mobile/lib/src/agents/masanawa_transport.dart`, production configuration, provider code, migrations.
- **Last updated:** 2026-10-06

## Implemented

- Added transport-agnostic Home projection models for:
  - server-resolved Gwana/Gwani Character presentation;
  - quick-service intents (Data/Airtime/Electricity/TV);
  - server-resolved Room cards;
  - My Twin entry;
  - recent/continuation entries;
  - loading/ready/error state.
- Added isolated `HomeScreen`:
  - Gwana is always rendered in the left Home role and Gwani in the right role;
  - actual Character IDs/names/availability/voice labels come from the supplied server projection;
  - Chat, Voice note and Live voice actions emit typed callbacks only;
  - quick-service buttons emit intent only and perform no billing/provider work;
  - My Twin, Continue and Room cards emit supplied models/IDs to the integration owner;
  - explicit loading, network/error and empty projections;
  - narrow-phone layout keeps peer assistant cards side by side while their action controls wrap safely.
- Added focused model/widget tests covering role ordering independent of list order, exact server Character identity preservation, quick-service intent isolation, Room identity forwarding, state projections and narrow-phone layout.

## Verification evidence

- Diff against base: 5 owned files before this handoff update; no shared integration files touched and branch was 0 commits behind the PR #198 base at review time.
- GitHub Mobile Build run `37444015674`: **infrastructure failure before checkout**; job `112204339744` completed failure with `steps: null`.
- GitHub Foundation CI run `37444015589`: **infrastructure failure before checkout**; job `112204337449` completed failure with `steps: null`.
- Because neither workflow executed a step, this lane does **not** claim Flutter analyzer/test/build verification. Focused tests are committed and ready to run when runner allocation is available or during #136 integration qualification.

## Shared-owner integration instructions

PR #136 should:
1. build `HomeViewState` from the production Home projection/transport;
2. wire `HomeScreen` into the primary Home route/bottom navigation;
3. map `onAssistantAction` to the existing universal chat/voice-note/live-voice entry using the exact supplied `characterId`;
4. map `onQuickService` to Internet Cafe with a preselected service intent, reusing canonical billing/Commerce truth;
5. map `onOpenRoom`, `onOpenMyTwin`, `onCreateMyTwin` and continuation callbacks into existing routes/contracts;
6. perform the real APK/device acceptance in Lane P.

## Remaining dependencies

- Real server Home projection/transport and canonical assistant/Room resolution: shared integration owner.
- Router/bottom-navigation wiring: PR #136.
- Internet Cafe deep links and billing execution: Lane I/B + PR #136.
- Story Radio/News/Study cards can populate through the same Room model as those lanes land.
- Exact Flutter analyzer/test/APK evidence remains blocked here only by hosted runner allocation and belongs to final shared integration qualification as well.

## Deployment

Not owned and not claimed. No production environment, Gateway composition, provider, migration or APK files were changed.


## Shared production integration outcome — 2026-10-06

The isolated Lane H handoff has now been consumed by the shared production owner.

- Production integration PR #206 final head: `764d179543fd629245e8ad0f98d7fbfc6b11506c`.
- PR #206 merged into PR #136 branch as `effe6d213a8283b0925cbeac7e37db0b84c32376`.
- The integrated branch preserves utility-first **Home · Explore · Activity · Wallet**, server-resolved Gwana/Gwani identity/voice/availability, Home `/home` transport, My Twin, Rooms, quick billing intents, chat/voice-note/live-voice entry, pull-to-refresh, continuation cards and deep-link handling.
- Full workspace qualification on the immediately preceding production-derived Home snapshot passed 156 test files / 831 tests, including both Gateway Home projection tests; production builds completed and Flutter analysis had no compile errors. Focused Home widget/model/continuation/root-shell tests passed.
- The only reproduced focused Flutter failure was missing test binding initialization in `twin_production_integration_test.dart`; final #206 head fixes it with `TestWidgetsFlutterBinding.ensureInitialized()` and changes no production source.
- Exact final APK qualification branch `5b90222f60fd19e957dd64c19f9775ac56c52046` was prepared from the final Home head. Render deployment `dep-db2d4orncjis73e9klf0` resolved that exact commit but was canceled before checkout because the workspace exhausted build-pipeline minutes.
- Railway deployment `e7bf7f7f-652d-49bc-8121-94444c92ab94` targets integrated #136 commit `effe6d213a8283b0925cbeac7e37db0b84c32376` and is held at `NEEDS_APPROVAL` before build/deploy.

Lane H is now **INTEGRATED**. It is not **DEVICE VERIFIED** because current external build/deployment account limits prevent producing and installing the exact integrated release APK. No further Home implementation remains outside those release gates.
