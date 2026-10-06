# Durable channel binding repository — Production Task 100 follow-on

Owner/window: ChatGPT continuation window / 2026-10-06
Lease acquired under the merged five-minute stale-claim rule.
Branch: `work/channel-binding-postgres-20261006`
Base: reclaimed stale PR #307 head `a19d999f43023720b9fee60da511546707209f4e`
Task: durable PostgreSQL persistence for canonical WhatsApp/Telegram ChannelAccount + UserChannelBinding lifecycle.

## Reclaimed stale prerequisites

- PR #231 canonical channel binding lifecycle
- PR #307 replay-safe possession-link challenge

Both were inactive for more than five minutes when this lane was claimed.

## Exact owned paths

- `docs/workstreams/channel-binding-postgres-20261006.md`
- `packages/identity/migrations/0003_channel_bindings.sql`
- `adapters/storage/postgres/src/identity/channel_bindings.ts`
- `adapters/storage/postgres/src/identity/channel_bindings.test.ts`
- `adapters/storage/postgres/src/identity/index.ts`

## Explicitly excluded

- channel webhook/transport adapters
- Gateway composition/routes
- mobile/APK
- challenge persistence
- production environment/credentials
- unrelated Identity tables/migrations

## Persistence invariants

- exact Tenant + ChannelAccount scope on every read/write;
- external subject unique per Tenant+ChannelAccount for the full lifecycle;
- at most one active binding per User per ChannelAccount;
- proof columns are all-null for pending bindings and complete for active/revoked proof-backed bindings;
- account/binding revisions are positive and updated with compare-and-swap;
- revoked account/binding state cannot be overwritten back to active;
- create replays are exact and conflicting payloads fail closed;
- storage rows round-trip to canonical Identity contracts.

State: IMPLEMENTED / VERIFICATION PENDING.

## Completed

- adds `identity.channel_accounts` and `identity.channel_bindings` durable schema;
- enforces Tenant/account/channel/user foreign keys and stable subject uniqueness;
- enforces at most one active binding per User per ChannelAccount;
- enforces pending/active proof column invariants;
- adds replay-safe create semantics for ChannelAccount and pending binding;
- adds serializable compare-and-swap updates for account/binding lifecycle;
- fences immutable identity changes, revision skips, terminal revocation and timestamp rollback;
- exports the Postgres repository through the Identity storage adapter;
- transaction-backed tests cover create replay, conflicting replay, activation, active-user lookup, terminal revocation and rollback fencing.

Challenge persistence remains intentionally separate.

Implementation head before handoff: `2aaa8b2f38ffcb80997c29b88e0f4e75a928186e`.

Last update: 2026-10-06.
