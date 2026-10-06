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
