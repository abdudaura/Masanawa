# R12 Account deletion entry — 2026-10-08

- Owner/window: ChatGPT R12 account deletion entry
- Branch: `work/r12-account-deletion-entry-20261008`
- Base SHA: `265f2c5f6db81d076f57ca32dd47db3ff7fb0ad6`
- Task: R12 client-facing Settings request discovery and honest deletion status; server-side deletion workflow is **not** claimed.
- Exact owned paths: `apps/mobile/lib/src/screens/settings/settings_screen.dart`, `docs/workstreams/account-deletion-entry-r12-20261008.md`
- Dependencies: identity/privacy server deletion API, authenticated reauthorization and durable job, external request URL require separate integration ownership.
- Current step: claim published; inspect existing client/backend deletion capabilities before adding client affordance.
- Implementation: not yet verified; deployment: not attempted; device: not tested.
- Last update: 2026-10-08 01:55 Africa/Lagos.
- Handoff: do not classify an informational route, logout, or local data clearing as account deletion.
