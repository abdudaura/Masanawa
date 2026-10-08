# R12 Disabled Account Write Guards — 2026-10-08

- Owner: ChatGPT identity-privacy continuation.
- Branch: `work/r12-disabled-account-write-guards-20261008`, stacked on R12 atomicity PR #416 at `e8fb1408a3d937dbdde3bc6243ab0e79fc5c5371`.
- Scope: prevent new platform sessions, private channel links, and push registrations after the R12 revocation step disables canonical user identity, including concurrent races.
- Claimed exact paths: `adapters/storage/postgres/src/security/platform-session.ts`, `services/gateway/src/customer_auth.ts`, `services/gateway/src/customer_auth.test.ts`, `adapters/storage/postgres/src/security/customer-channel.ts`, `adapters/storage/postgres/src/agents/mobile-shell.ts`, `adapters/storage/postgres/src/security/disabled-account-writes.integration.test.ts`, `docs/workstreams/r12-disabled-account-write-guards-20261008.md`.
- Dependencies: R12 #409 and #416; preserve all work on those branches. No finance/provider/migration changes.
- Tests authored: `disabled-account-writes.integration.test.ts` (active, disabled and held-row concurrent writes) and `customer_auth.test.ts` (403 inactive account). No local PostgreSQL/Vitest execution evidence; #416 CI jobs failed pre-runner (zero steps).
- Production: not deployed; R12 remains incomplete (cleanup/retention/financial reconciliation still absent).
- Last update: 2026-10-08 06:22 Africa/Lagos; implementation published on draft PR #423.

## Implementation and remaining issues

- `createPostgresPlatformSessionRepository.issueSession` now checks canonical `identity.users.state` under `FOR SHARE` within the session insertion transaction. Customer auth maps disabled-state failure to `ACCOUNT_INACTIVE` (HTTP 403) rather than falsely returning successful sign-in.
- `createPostgresCustomerChannelRepository.putLink` and `createPostgresMobilePushRepository.register` use the same guarded transaction. Their shared user-row lock serializes against the deletion revoker's `identity.users` disable write. Avoid manually bypassing these repository methods.
- Real PostgreSQL acceptance test covers all three writes while active, concurrent attempts held by `FOR UPDATE` then disabled, and later denial. Test results remain **unverified**, including simulated concurrency scheduling.
- The contract does not yet stop all provider-triggered external callbacks, previously admitted AI Seats, third-party processors or legacy workers using alternate code paths. Inspect those before production deletion and keep R12 release status PARTIAL.
- Stacked integration order: #409 -> #416 -> #423. These are draft PRs; main is canonical after properly verified merges. Never deploy or pull a stacked work branch as production truth.
