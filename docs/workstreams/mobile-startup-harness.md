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

Status: active. The new harness seam is provider-neutral and must not execute or bypass domain authorities itself.
