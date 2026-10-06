# Production security / abuse / isolation acceptance — Task 145

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/production-security-acceptance-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`

## Task references
- `docs/PRODUCTION-MASTER-TASKS.md` — **145** Complete production security review, abuse cases, tenant isolation and secret-leak testing.
- Existing `packages/security` remains canonical; this lane adds cross-cutting acceptance only.

## Owned paths
- `tests/security/production-security-acceptance.test.ts` (new)
- `docs/workstreams/production-security-acceptance-20261006.md`

## Excluded/shared paths
- No Security implementation changes, domain/Gateway code, credentials/secrets, migrations, package manifests/lockfile or production configuration.
- This branch cannot claim deployed-production security pass until the suite executes in production-like composition.

## Current state
CLAIMED. Add abuse-focused acceptance for capability non-escalation, stale/revoked authority, cross-tenant/cross-audience signed service credentials, credential-generation revocation, authentication header/metadata injection bounds and secret-canary non-disclosure.