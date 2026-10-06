# Channel binding and account lifecycle — Task 100

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/channel-binding-lifecycle-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
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

- `packages/identity/src/index.ts` (active export work exists)
- `packages/identity/src/model.ts`
- `packages/identity/src/repository.ts`
- all Identity/Postgres migrations and adapters
- `adapters/channels/messaging/**` (PR #92)
- Gateway app/main/channel routing
- mobile/router/chat/APK
- production environment
- Commerce, Events, billing and crypto

## Dependencies and integration boundary

The model must bind a canonical Tenant/User to one canonical ChannelAccount identity without treating transport evidence as authority. Linking/re-linking requires explicit proof evidence, stable revision custody and lifecycle transitions. Persistence, account resolution and Gateway/channel composition remain follow-on work for their current owners.

## Current state

IMPLEMENTING. Canonical ChannelAccount/UserChannelBinding lifecycle contracts and focused tests are committed. Persistence/export/Gateway composition remain excluded because their paths are actively shared/owned.

Implementation head before handoff: `9c53251e1b4405aeef1892ad8190ccea6be3c67c`.

Last update: 2026-10-06.
