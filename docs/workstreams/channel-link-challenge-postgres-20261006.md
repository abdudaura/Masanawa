# Durable channel-link challenge repository — Production Task 100 follow-on

Owner/window: ChatGPT continuation window / 2026-10-06
Lease acquired under the merged five-minute stale-claim rule.
Branch: `work/channel-link-challenge-postgres-20261006`
Base: PR #312 head `3184aa49212ca456f78e76b9656247107b1be6f2`
Task: persist replay-safe WhatsApp/Telegram account-link challenges across process restarts.

## Exact owned paths

- `docs/workstreams/channel-link-challenge-postgres-20261006.md`
- `packages/identity/migrations/0004_channel_link_challenges.sql`
- `adapters/storage/postgres/src/identity/channel_link_challenges.ts`
- `adapters/storage/postgres/src/identity/channel_link_challenges.test.ts`
- `adapters/storage/postgres/src/identity/index.ts`

## Explicitly excluded

- Gateway routes/composition
- transport/webhook adapters
- mobile/APK
- challenge secret delivery UX
- production environment/credentials

## Persistence invariants

- raw challenge secret is never persisted;
- canonical RequestId is the durable identity;
- exact create replay returns existing state;
- conflicting create under same RequestId fails closed;
- compare-and-set requires exact current revision and exactly next revision;
- Tenant/account/channel/User immutable scope cannot change;
- secretHash/maxAttempts/createdAt/expiresAt are immutable;
- verified/locked/expired lifecycle state survives restart;
- verified evidence must persist atomically with the verified transition.

State: IMPLEMENTED / VERIFICATION PENDING.

## Completed

- adds `identity.channel_link_challenges` durable schema;
- persists only scoped SHA-256 challenge hashes, never plaintext secrets;
- implements exact RequestId create replay and conflict rejection;
- implements load + serializable single-revision compare-and-set;
- freezes Tenant/account/channel/User/hash/lifetime/max-attempt scope after issue;
- only pending challenges may advance;
- invalid attempts, verification, lock and expiry survive process restart;
- verified external subject evidence persists atomically with verified state;
- restart tests cover attempt persistence, verified replay, conflicting RequestId create and terminal lock behavior.

Implementation head before handoff: `7d31d3da5166b0643b3fec97095113008569f237`.

Last update: 2026-10-06.
