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
