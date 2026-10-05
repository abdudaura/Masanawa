# Mobile startup + harness foundation — 2026-10-05

Owner/window: ChatGPT startup-performance/harness continuation, explicitly assigned by the user after APK launch-speed review.
Branch: `work/mobile-startup-harness-20261005`
Base: `16473454b0fc62c8ac37b322a56dd9746a20a3f9`

Purpose:
1. Remove avoidable startup delay after Android's native splash.
2. Reduce secure-session restore I/O so returning users reach the app shell faster.
3. Establish the Masanawa agent-harness architecture without duplicating active domain authorities.

Owned paths:
- `apps/mobile/lib/src/screens/splash/splash_screen.dart`
- `apps/mobile/lib/src/state/session_state.dart`
- `apps/mobile/test/session_state_test.dart`
- new focused mobile startup tests if needed
- `docs/AGENT-HARNESS.md`
- `packages/agents/src/harness.ts`
- `packages/agents/src/index.ts` only to export the new harness seam
- this claim file

Boundaries:
- no billing/crypto/channel/provider/domain internals;
- no Gateway deployment changes in this slice;
- no new wallet, identity, Skill registry or workflow authority;
- the harness document must reuse existing CharacterSession, AgentRun, Skill, Workflow,
  Commerce, approval and channel boundaries rather than inventing parallel systems.

Acceptance:
- no artificial minimum splash duration after Flutter is ready;
- session restore prefers one encrypted storage read with backward-compatible migration;
- legacy persisted sessions continue to restore;
- visible splash wording remains concise and correct;
- harness architecture clearly defines durable Work, skills/tools, approvals, subworkers,
  channels and progress events as composition around existing authorities;
- relevant tests are updated and executable when Flutter is available.

Implemented:
- removed the 1.2-second minimum Flutter splash delay; first-frame routing now occurs as soon as session restoration resolves;
- returning-user session restoration now prefers one encrypted `auth_session_v2` read;
- legacy four-key sessions are read in parallel and migrated asynchronously without delaying navigation;
- logout clears both new and legacy records in parallel;
- added focused tests for the one-read fast path and legacy migration;
- added `docs/AGENT-HARNESS.md` mapping user-visible Work onto existing Task/WorkflowRun authorities;
- added a provider-neutral `AgentHarness` contract around admitted AgentRuns with truthful progress callbacks and durable Task/WorkflowRun references.

Verification:
- implementation branch reached `27377e2c564b9e5b761449ea18d9d4e51b04862c`;
- PR #143 merged into `work/billing-main-integration-20261005` at `da527038304080ede9bb247e4735b0779738730f`;
- changed-path audit contains only the claimed mobile startup, harness contract/documentation and focused test paths;
- no APK rebuild was performed, per user instruction;
- executable Flutter/TypeScript checks still require an available runner.

Checkpoint reconciliation:
- `CONTINUE-HERE.md` now records the no-timed-splash rule, one-record auth restore,
  native blue Android branding sources, and canonical harness mapping;
- `docs/MULTI-WINDOW-WORK.md` now requires reading the harness architecture and updating
  governing docs at each meaningful checkpoint.

Status: implementation complete for this slice. The new harness seam is provider-neutral and does not execute or bypass domain authorities itself.
