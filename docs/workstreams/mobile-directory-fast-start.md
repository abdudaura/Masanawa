# Mobile directory fast-start — 2026-10-05

Owner/window: ChatGPT mobile startup continuation after harness/workflow collision reconciliation.
Branch: `work/mobile-directory-fast-start-20261005`
Base: `865a9b1ddb2aff276a1ad0f81a8ec4e5492c27df`

Purpose:
1. Make the signed-in chat shell render cached agents immediately instead of waiting on a network directory request.
2. Keep cache strictly account-scoped so one user can never see another user's agent roster.
3. Prevent access-token rotation from needlessly rebuilding the directory provider.

Owned paths:
- `apps/mobile/lib/src/agents/agent_directory.dart`
- `apps/mobile/lib/src/agents/agent_directory_cache.dart`
- `apps/mobile/lib/src/state/agent_directory_state.dart`
- focused mobile tests for directory caching/startup behavior
- `docs/AGENT-HARNESS.md` only for the fast-client checkpoint
- this claim file
- top-level checkpoint docs after completion

Boundaries:
- no Gateway/provider/domain changes;
- no hard-coded Gwani/Gwana identities in the client;
- cached directory data is presentation-only and never grants Skill/capability/financial authority;
- 401/403 and account changes must clear/invalidate the relevant cached roster;
- live network refresh remains canonical and replaces cached presentation when available.

Acceptance:
- returning users can render cached chat/agent presentation before the directory HTTP response returns;
- cache is keyed by canonical signed-in user ID;
- stale cache is never reused across accounts;
- transient network failure preserves cached roster;
- auth denial clears cached roster;
- access-token refresh alone does not reset directory state;
- docs updated at checkpoint.

Implemented:
- AgentDirectoryEntry has a cache-safe presentation JSON projection;
- account-scoped file cache added under application-support storage;
- signed-in startup hydrates cached agents first and refreshes live data afterward;
- provider watches canonical User identity rather than rotating access-token values;
- 401/403 clears cached + visible roster; transient failures retain it;
- focused tests cover cache-first render, token rotation, sign-out, cross-account isolation,
  auth denial and presentation serialization.

Verification:
- PR #164 merged into `work/billing-main-integration-20261005` at `e46dc62de6599d0ea5010855dc03a3aa1df285e9`;
- GitHub Mobile Build run 37293232633 and Foundation CI run 37293232571 failed before executing any steps (`steps: null`), so they are runner-allocation failures rather than code-test failures;
- changed-path audit is limited to claimed mobile presentation/cache/test/docs paths;
- no APK rebuild was performed;
- executable Flutter tests still require an available runner.

Status: merged implementation checkpoint. Executable Flutter verification remains pending an available runner.
