# R04 — Create Talk participant actions and post-create handoff

- **Owner/window:** ChatGPT R04 create-intent integration, 2026-10-08T05:30:48.177Z
- **Branch:** `work/r04-create-participant-intents-20261008`
- **Base main SHA:** `88e67cc6c79de1ca09e02f11e929065dcfb2ea82`
- **Lane:** R04 / talks-live mobile Create/Host participant intent flow
- **Status:** ACTIVE; 5-minute repository-visible lease
- **Last repository-visible update:** 2026-10-08T05:30:48.182Z

## Exact owned paths
- `apps/mobile/lib/src/screens/talks/create_talk_screen.dart`
- `apps/mobile/lib/src/screens/talks/create_talk_participant_handoff.dart` (new)
- `apps/mobile/lib/src/router/app_router.dart` (shared navigation; collision-check before changes)
- `apps/mobile/lib/src/screens/talks/add_ai_seat_sheet.dart` (only focused optional initial-tab if needed)
- `apps/mobile/test/create_talk_participant_flow_test.dart` (new)
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
