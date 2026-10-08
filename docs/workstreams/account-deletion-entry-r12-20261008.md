# R12 Account deletion entry — 2026-10-08

- Owner/window: ChatGPT R12 account deletion entry
- Branch: `work/r12-account-deletion-entry-20261008`
- Base SHA: `265f2c5f6db81d076f57ca32dd47db3ff7fb0ad6`
- Task: R12 Settings deletion entry and pure request lifecycle; Gateway endpoints, persistence, migrations and cleanup worker are not claimed.
- Exact owned paths: `apps/mobile/lib/src/screens/settings/settings_screen.dart`, `packages/identity/src/account-deletion.ts`, `packages/identity/src/account-deletion.test.ts`, `docs/workstreams/account-deletion-entry-r12-20261008.md`
- Dependencies: identity/privacy server deletion API, authenticated reauthorization and durable job, external request URL require separate integration ownership.
- Current step: Implemented truthful Settings entry and defensive pure lifecycle. Explicitly blocked self transitions and settlement resume without new evidence; no API or runtime wiring is claimed.
- Implementation: Settings 8158bcd; lifecycle 3709cdac, failure re-verification 8ae6b173, settlement/self-transition defenses ceafa2cf; tests e79f52c2 (seven Vitest test cases). No executable tests run in connector; build/deployment/device: NOT VERIFIED.
- Last update: 2026-10-08 after e79f52c2.
- Handoff: R12 remains OPEN. Next integrate a real authenticated durable deletion-request API, secure reauthentication, asynchronous revocation/cleanup/reconciliation, external request page and tests. Replace informational modal only when backend and support mechanism are genuinely available. Do not classify this UI as successful account deletion.

## Integration blocker and next bounded steps

This is intentionally **not an account deletion endpoint**. The booleans `identityReauthenticated` and `cleanupComplete` are trusted-only inputs; untrusted clients must never supply or control them. Persist requests with uniqueness by tenant/user and revisions (compare-and-swap), implement server-confirmed recent authentication and reconciled financial hold checks, enqueue idempotent revocation/erasure jobs, audit processor responses and reconcile outstanding obligations. Only after durable completion should Settings show success. Additional independent task: external authenticated/unauthenticated request intake and privacy disclosures. The source currently has no release-wired export or Gateway handler; these need coordinated integration ownership.
