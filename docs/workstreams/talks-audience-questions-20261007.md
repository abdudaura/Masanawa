# Talk audience questions — 2026-10-07

- Owner/window: current ChatGPT implementation window
- Branch: `work/talks-audience-questions-20261007`
- Base SHA: `25ef7be2cef9047c25696a30f5d918634a1e2f52`
- Latest main checked: `dbd64c530407fe3bd2b6d3c82a03d552d5c528dc`
- Task: implement durable audience questions for live Talks, including authenticated submit/list, Host visibility, and native mobile submission.
- Exact owned paths:
  - `packages/talks/migrations/0011_talk_questions.sql`
  - `services/gateway/src/talk_moderation/model.ts`
  - `services/gateway/src/talk_moderation/postgres_repository.ts`
  - `services/gateway/src/talk_moderation/service.ts`
  - `services/gateway/src/talk_moderation_routes.ts`
  - focused Talk moderation tests
  - `apps/mobile/lib/src/talks/talk_questions.dart`
  - `apps/mobile/lib/src/talks/talk_questions_http_transport.dart`
  - `apps/mobile/lib/src/state/talk_question_state.dart`
  - `apps/mobile/lib/src/screens/talks/talk_question_sheet.dart`
  - focused wiring/tests in `apps/mobile/lib/src/screens/talks/talk_screen.dart`
  - this claim file
- Shared-contract dependencies: existing Talk authentication, live/reconnecting visibility and Host moderation authority. No Billing/Crypto, ranking, gifts, replay, or AI Seat commerce changes.
- Last repository-visible update: 2026-10-07T11:20Z

## Implemented

- Durable `talks.questions` storage with pending/answered/dismissed lifecycle.
- Authenticated listener question submission for live Talks only.
- Question body normalized and bounded to 500 characters.
- Listener pending queue bounded to three questions by repository admission policy.
- Human Host cannot submit audience questions to their own Talk.
- Host-only pending question queue, ordered oldest first.
- Host can mark a question Answered or Dismissed.
- Mobile listener **Ask** action opens a compact question sheet and submits in-place.
- Mobile Host **Questions** action shows pending count and an in-Talk management sheet.
- Ended/replay Talks do not expose listener question submission.
- Existing Talk comments remain separate from Host-directed audience questions.
- Fixed adjacent pre-existing Talk moderation typing: `onTalkEnded` was used by the service and supplied by `main.ts` but missing from the service factory input type.

## Verification coverage added

Gateway:
- question submit/list/resolve HTTP contract;
- 500-character boundary rejection;
- durable repository submit path;
- Host resolution returning remaining pending queue.

Mobile:
- listener Ask flow submits the entered question and shows success;
- Host sees pending count, opens the question queue and resolves an item;
- compact action labels ellipsize rather than overflow.

## Integration check

- Migration ordering audited against current `packages/talks/migrations/`: existing files run through `0010_talk_push_dedupe.sql`; audience questions use `0011_talk_questions.sql` to avoid the existing `0006_talk_replay.sql` sequence.

- Latest main checked: `dbd64c530407fe3bd2b6d3c82a03d552d5c528dc`.
- Main advanced six commits after this branch base, all in Talk notification runtime integration.
- Those six commits touch `docs/workstreams/talks-notification-runtime-integration-20261007.md`, `services/gateway/src/main.ts`, and `services/gateway/src/talk_notifications/**`; they do not overlap this lane's changed files.
- Branch comparison at handoff: 18 commits ahead / 6 behind, with isolated file paths and no competing audience-question PR.

## Status

- Implementation status: complete pending CI/review evidence.
- Verification status: focused tests written; GitHub checks pending PR execution.
- Deployment status: not deployed.
- Handoff: safe to review/merge if checks and mergeability are clean; production migration/device qualification remains deployment work.
