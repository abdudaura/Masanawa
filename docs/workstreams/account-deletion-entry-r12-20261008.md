# R12 Account deletion entry — 2026-10-08

- Owner/window: ChatGPT R12 account deletion entry
- Branch: `work/r12-account-deletion-entry-20261008`
- Base SHA: `265f2c5f6db81d076f57ca32dd47db3ff7fb0ad6`
- Task: R12 Settings deletion entry and pure request lifecycle; Gateway endpoints, persistence, migrations and cleanup worker are not claimed.
- Exact owned paths: `apps/mobile/lib/src/screens/settings/settings_screen.dart`, `packages/identity/src/account-deletion.ts`, `packages/identity/src/account-deletion.test.ts`, `docs/workstreams/account-deletion-entry-r12-20261008.md`
- Dependencies: identity/privacy server deletion API, authenticated reauthorization and durable job, external request URL require separate integration ownership.
- Current step: Settings now exposes an explicit Delete account entry and truthful unavailable state, without a fake deletion confirmation or logout side effect.
- Implementation: Settings entry 8158bcd; guarded identity deletion lifecycle 3709cdac; four Vitest cases 2d642a43. Source committed; no executable tests run in this connector session. Deployment: not attempted; device: not tested.
- Last update: 2026-10-08 01:59 Africa/Lagos.
- Handoff: R12 remains OPEN. Next integrate a real authenticated durable deletion-request API, secure reauthentication, asynchronous revocation/cleanup/reconciliation, external request page and tests. Replace informational modal only when backend and support mechanism are genuinely available. Do not classify this UI as successful account deletion.
