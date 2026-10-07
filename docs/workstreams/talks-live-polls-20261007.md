# Live Talk polls — 2026-10-07

- Owner/window: current ChatGPT implementation window
- Branch: `work/talks-live-polls-20261007`
- Base SHA: `cc03bca1b8d468f31e11c25fc201ae9e445dfc22`
- Latest main checked: `cc03bca1b8d468f31e11c25fc201ae9e445dfc22`
- Task: implement the North-Star live audience poll primitive end-to-end.
- Exact owned paths:
  - `packages/talks/migrations/0012_talk_polls.sql`
  - `services/gateway/src/talk_polls/**`
  - `services/gateway/src/talk_poll_routes.ts`
  - focused Gateway composition in `services/gateway/src/app.ts` and `services/gateway/src/main.ts`
  - focused poll tests
  - `apps/mobile/lib/src/talks/talk_polls.dart`
  - `apps/mobile/lib/src/talks/talk_polls_http_transport.dart`
  - `apps/mobile/lib/src/state/talk_poll_state.dart`
  - `apps/mobile/lib/src/screens/talks/talk_poll_sheet.dart`
  - focused wiring/tests in `apps/mobile/lib/src/screens/talks/talk_screen.dart`
  - this claim file
- Shared dependencies: customer session authorization, Talk live lifecycle and human Host identity. No ranking, gifts, questions, replay, Billing/Crypto, or AI Seat commerce changes.
- Last repository-visible update: 2026-10-07T11:35Z

## Product bounds

- One open poll per Talk.
- Only the real human Host can create and close polls.
- Each poll has 2–4 unique choices.
- Each authenticated user has one current vote and may change it while the poll is open.
- Voting requires the Talk and canonical live runtime to be live.
- Public poll state exposes aggregate counts plus only the current viewer's selected option; voter identities are never exposed.
- Restricted/blocked Talks cannot expose or accept public poll voting.

## Implemented

Backend:
- Durable `talks.polls` and `talks.poll_votes` storage in `0012_talk_polls.sql`.
- Partial unique index enforces one open poll per tenant/Talk.
- Host/live authorization before poll creation.
- Current-poll aggregate query with safety enforcement.
- Vote UPSERT implements one current choice per user, validates option membership from canonical poll options, requires live runtime, and re-checks safety visibility.
- Host-only close operation.
- Authenticated GET/create/vote/close Gateway routes.
- Production database factory, customer authorizer and app route composition.

Mobile:
- Typed poll model + Gateway transport + Riverpod state.
- Host-only **Start poll** affordance appears inline when no poll is open.
- Poll creation sheet supports 2–4 choices with client-side nonempty/duplicate validation.
- Active poll renders inline above comments without adding another Talk control-row button or top-level screen.
- Listeners vote directly from the poll card and can change their selection while open.
- Aggregate percentage/count state refreshes after voting.
- Host can close the active poll inline.
- Stable `AsyncValue.asData?.value` access is used for vote/close actions.

## Verification coverage added

Gateway route tests:
- authenticated aggregate-only current poll;
- normalized Host creation;
- one-viewer vote with refreshed selection;
- Host close;
- duplicate and oversized option-set rejection.

Gateway repository tests:
- Host + live-runtime creation guard;
- non-Host rejection before insert;
- vote SQL includes live runtime, canonical option membership, safety enforcement and one-choice UPSERT;
- Host close and SQL parameter alignment.

Mobile Talk-screen tests:
- listener sees/votes an active inline poll and receives refreshed aggregate state;
- Host creates a poll from the in-Talk sheet, sees the inline card, closes it, and returns to **Start poll**.

## Integration audit

- Latest `main` is still the branch base `cc03bca1b8d468f31e11c25fc201ae9e445dfc22`; branch is 19 commits ahead / 0 behind at the pre-PR audit.
- Current Talk migration sequence ends at `0011_talk_questions.sql`; poll migration `0012_talk_polls.sql` has no collision.
- No open or recent Talk-poll PR/commit exists.
- PR #374 already owns Talk sharing/deep links and is therefore excluded from this lane.

## Status

- Implementation status: complete pending PR/CI evidence.
- Verification status: focused route/repository/mobile regression tests written; GitHub execution evidence pending.
- Deployment status: not deployed.
- Handoff: open a clean PR, require clean mergeability, inspect CI job-step evidence, then merge if safe.
