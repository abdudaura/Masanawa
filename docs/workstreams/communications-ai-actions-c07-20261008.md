# C07 — private Assistant workspace and authorized persona continuity

- Window: GPT-6 connector coding window, 2026-10-08 Africa/Lagos.
- Lane: **C07 communications-ai-actions** (initial end-to-end workspace slice), based on latest main `5d19afc952b3dcabd18ee8f8d1c3ad13b72e6762`; branch `work/c07-assistant-workspace-20261008`.
- Product requirements: M08/M09, A01/A02, N08, Q05/Q08/Q09/Q10; J02/J07/J11. Five-tab navigation remains R17/C08 owner's sole domain.
- Exact initial paths: `services/gateway/src/assistant_workspace/**`, `apps/mobile/lib/src/assistant_workspace/**`, `apps/mobile/test/assistant_workspace_*.dart`, `docs/contracts/ASSISTANT-WORKSPACE-C07.md`, this claim. Shared Gateway composer and mobile router remain **unowned** here; no unauthorised overlap with #435/#468/#472.
- Reuse canonical session-authorized agents, shell history and turn idempotency; no second auth store/ledger. Never automatically transfer funds, start mic, expose AI persona threads as human DMs, or imply E2EE.
- State: CLAIMED / SOURCE_WRITTEN=no, TESTS_EXECUTED=no, CI_EXECUTED=no, DB_INTEGRATED=no, APP_INTEGRATED=no, DEVICE_VERIFIED=no, DEPLOYED=no, MERGED=no. Shared Actions #457 exhausted; current runtime lacks GitHub clone network and Dart/PostgreSQL execution.
- Five-minute repository-visible lease requires new work commits; this is not a permanent reservation. Fresh verification and integration in Work before any merge.


## Checkpoint — source branch and draft PR #480

- Published <https://github.com/Baatiku/masanawa/pull/480> (draft, unmerged), branch \`work/c07-assistant-workspace-20261008\`, base main \`5d19afc952b3dcabd18ee8f8d1c3ad13b72e6762\`.
- Current work: isolated Flutter role-switch + server history controller, secure journal/retry, screen and authored controller/widget tests. See \`docs/contracts/ASSISTANT-WORKSPACE-C07.md\` for the exact production safety constraints.
- Existing authorized Postgres \`agents.user_agent_preferences\` and \`agents.mobile_turn_commands\` plus canonical Gateway routes are reused; no new migration for this isolated adapter. No hardcoded IDs, mock production transport or fabricated completion; test fakes are test-only.
- Shared \`app.ts\`, \`main.ts\`, \`apps/mobile/lib/src/router/**\` and root tab files intentionally untouched because R18 #435/C01 #468 and the single R17/C08 integration owner must reconcile them. Existing C02 #472 and C03 #473 also remain drafts.
- **Status:** \`PARTIAL_IMPLEMENTATION\` for entire C07; SOURCE_WRITTEN=yes for adapter, LOCAL_TESTED=no, CI_EXECUTED=no, DB_INTEGRATED=no, APP_INTEGRATED=no, DEPLOYED=no, DEVICE_VERIFIED=no, MERGED=no. Native voice and single cross-persona task/consent registry remain UNIMPLEMENTED; no C07 DONE.
- **Verification blockers:** GitHub Actions #457 budget exhausted; this connector runtime lacks executable Dart/Flutter, Postgres, Android handsets and production credentials. Do not retry blocked Actions; Work follows handoff contract after resolving runner quota with explicit owner permission. No tests have been run, not even focused widget tests.
- **Work handoff commands:** \`cd apps/mobile && flutter pub get && flutter analyze lib/src/assistant_workspace test/assistant_workspace_controller_test.dart test/assistant_workspace_screen_test.dart && flutter test test/assistant_workspace_controller_test.dart && flutter test test/assistant_workspace_screen_test.dart\`. Run full app analyzer/widget tests, \`pnpm typecheck\`, \`pnpm test\`, real A/B authentication and Postgres test, device native voice/private public mic checks before integration and merge.
- **Do not merge:** server-side single assistant workspace, cross-persona task continuation/consent invalidation, R17/C08 final five-tab route, R02 native Live audio and typed authorized cross-app actions are prerequisites, not optional cleanup.


## Latest source checkpoint — Gateway and draft continuity added

- C07 now also owns concrete **isolated** Gateway composition: \`services/gateway/src/assistant_workspace/service.ts\` and \`routes.ts\`, with \`service.test.ts\` written. It reuses existing \`AgentDirectoryService\`, \`AgentConversationService\` and \`AgentShellService\`; the authorization boundary and PostgreSQL migration ownership remain canonical. The added HTTP routes are **NOT REGISTERED** in \`app.ts/main.ts\`; shared Gateway integration must reconcile #435/#468 first. Never report the endpoints as deployed or accessible.
- Flutter isolated C07 files now include \`assistant_draft_store.dart\` and protected per-user draft restoration. The screen keeps the draft through Gwani↔Gwana switching, bounds text, resists account-switched stale state, and avoids clearing an unsent draft when secure outgoing persistence fails. Additional authored widget and controller tests cover these paths.
- Exact source inventory for current draft #480: \`services/gateway/src/assistant_workspace/{service.ts,routes.ts,service.test.ts}\`, \`apps/mobile/lib/src/assistant_workspace/{assistant_workspace_controller.dart,assistant_workspace_screen.dart,secure_assistant_pending_journal.dart,assistant_draft_store.dart}\`, \`apps/mobile/test/{assistant_workspace_controller_test.dart,assistant_workspace_screen_test.dart}\`, this checkpoint and \`docs/contracts/ASSISTANT-WORKSPACE-C07.md\`.
- **No live composite API, cross-persona task/consent state or final /assistant integration**; entire feature remains **PARTIAL_IMPLEMENTATION**, despite substantive source code. Existing per-Character server histories persist separately; actual unified task state and operator workflows need further coordinated implementation.
- Exact unexecuted Gateway test: \`pnpm exec vitest run services/gateway/src/assistant_workspace/service.test.ts\` followed by \`pnpm typecheck && pnpm test\`. Existing Flutter commands and A/B real DB/device/voice checks remain in the contract. Preserve draft/unmerged status until all genuine gates pass.


## Final recorded comparison before this handoff
- Draft PR: <https://github.com/Baatiku/masanawa/pull/480>, open / DRAFT / unmerged.
- GitHub compare from main showed **28 C07 branch commits ahead, 1 new main commit behind** and 11 C07-owned changed paths; merge base \`5d19afc952b3dcabd18ee8f8d1c3ad13b72e6762\`, current main seen \`1d6a67ea3c182455b55a7d1d07eacdb4311682e3\`. ChatGPT Work must fetch fresh main and semantically reconcile after other active owners' changes (never force-push).
- Neither local Flutter nor Vitest nor CI nor migrations nor Android verification executed. No production Gateway route registration and no release qualification. Do not mark C07 DONE.

