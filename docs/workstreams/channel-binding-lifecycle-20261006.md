# Channel binding and account lifecycle — Task 100

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/channel-binding-lifecycle-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
PR: #231
Task: Production Master Task 100 — implement channel binding/account lifecycle model.

## Why this lane is safe

- Task 097 authenticated WhatsApp/Telegram transport ingress is actively owned by PR #92.
- Shared Gateway/mobile/runtime composition is owned elsewhere (#89/#136).
- No canonical ChannelBinding/account-lifecycle domain exists on current `main`.
- This lane is confined to new Identity-domain files and does not modify any active adapter, Gateway, migration, repository implementation or package barrel.

## Exact owned paths

- `docs/workstreams/channel-binding-lifecycle-20261006.md`
- `packages/identity/src/channel-binding.ts`
- `packages/identity/src/channel-binding.test.ts`

## Explicitly excluded/shared paths

- `packages/identity/src/index.ts`
- `packages/identity/src/model.ts`
- `packages/identity/src/repository.ts`
- all Identity/Postgres migrations and adapters
- `adapters/channels/messaging/**` (PR #92)
- Gateway app/main/channel routing
- mobile/router/chat/APK
- production environment
- Commerce, Events, billing and crypto

## Completed implementation

- Added canonical launch ChannelAccount state for WhatsApp/Telegram with stable canonical ID, provider-account reference, revision and lifecycle timestamps.
- Added explicit account lifecycle transitions: active ↔ disabled, active/disabled → revoked, with revoked terminal.
- Added UserChannelBinding lifecycle with immutable Tenant/ChannelAccount/channel/User/external-subject identity.
- A newly observed external channel subject starts `pending-proof`; transport admission alone never makes it an authenticated User binding.
- Activation requires explicit account-link proof with a bounded evidence reference, closed proof-method set and verified-at timestamp that cannot be later than activation.
- Added stale-revision protection for account and binding transitions.
- Added stable account-scoped channel-subject uniqueness key for persistence adapters.
- Added fail-closed usability checks for tenant/account/channel/subject mismatch, disabled/revoked accounts, pending or unproven bindings.
- Added narrow repository port defining the required durable uniqueness/resolution surface without creating a second identity store.
- Added focused tests for lifecycle transitions, proof gating, revocation, mismatch rejection, subject key stability, stale revision and future-proof rejection.

## Changed-file audit

PR #231 changes exactly the three owned paths above. No channel adapter, Gateway, mobile, migration, production environment, Commerce/Event or shared Identity file changed.

## Verification

- Source/type audit completed against current strict TypeScript configuration, canonical `ChannelAccountId`/`TenantId`/`UserId`/`Instant` contracts and Identity package conventions.
- Foundation CI run `37453760335` on head `778bdbb651c8593ccaa2b82e1fbdafeb8dd8f556` failed before checkout: job `112236253245`, `runner_id=0`, `steps=[]`. No repository code executed, so this is runner non-execution rather than an application test result.
- Final branch head after this handoff update is the commit produced by this documentation update.

## Remaining dependencies

1. Identity export owner: append-only canonical export when `packages/identity/src/index.ts` ownership clears.
2. Canonical Identity/Postgres owner: persist ChannelAccount + binding lifecycle with uniqueness on Tenant + ChannelAccount + external subject and revision-checked updates.
3. PR #92 channel owner: map authenticated WhatsApp/Telegram subject evidence into pending binding lookup/provisioning without granting authority.
4. Shared routing/Gateway owner: resolve only active proof-backed bindings to canonical Users/Relationships and preserve cross-channel continuity.
5. Executable CI/PostgreSQL acceptance once runner/persistence ownership is available.

State: ISOLATED COMPLETE / INTEGRATION READY.

Last update: 2026-10-06.
