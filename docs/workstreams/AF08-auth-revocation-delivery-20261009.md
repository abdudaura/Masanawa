# AF08 — OTP/channel admission and honest auth-session revocation

Status: **PARTIAL_IMPLEMENTATION**. Window **MASANAWA-01**, claimed in `factory/claims` at `9dc07f032bb91694b18bad919cfbc807ff3c46ed` and verified by readback. UTC 2026-10-09. Branch `work/af08-auth-revocation-delivery-20261009-masanawa01`, base `main@f381f077c485c04261459b77a42c215d3ce3a14b`.

## Ownership and dependency
Exact scoped files:
- `services/gateway/src/customer_auth.ts`
- `services/gateway/src/customer_auth.test.ts`
- `docs/workstreams/AF08-auth-revocation-delivery-20261009.md`

AF08 auth authority. Consumes existing `@masanawa/security` session/OTP repository; **no new identity/credential storage, no schema migration, no default-login/phone-password change, no new paid SMS dependency**. AF00 still owns shared `services/gateway/src/app.ts`, router/shell/migrations. Source recovery inputs #497 and #539 were inspected; both remain unmerged. Owner's locally built APK is unavailable, and local UI source has not been overwritten. Latest canonical docs at `CONTINUE-HERE.md` and AF08 prompt control.

## Connected source delivered
Source commit `bf31c5b97b0d1541ab0d8725d0a9383c791cc892`; tests commit `66ddcfe6159fb42bcacbea603b79abbaf82ba97c`.

1. Preflight OTP delivery-channel availability **before** persisting a challenge: email-only deployments reject SMS requests as `OTP_CHANNEL_UNAVAILABLE` without creating an unfulfillable OTP challenge or cooldown. Supported email delivery retains existing storage, send and cancellation paths.
2. Repository failure while rotating a refresh token is `AUTH_UNAVAILABLE` HTTP 503, not an invalid credential or leaked DB exception. Invalid/missing refresh credentials still return `SESSION_NOT_FOUND` 401.
3. If backend session revocation fails, logout **rejects** with `AUTH_UNAVAILABLE` 503 instead of returning successful server logout while the session can still authorize. Malformed access token rejects with `UNAUTHORIZED` 401. No authorization header retains existing idempotent no-op behavior.
4. Three focused regression tests exercise unsupported SMS vs working email, refresh persistence outage, and failed-then-successful logout with actual session-authorizer readback (in-memory repository fixture).

## Verification and gaps
- **PASS (static, NOT executable tests):** GitHub server accepted two source/test commits, exact branch blob readbacks `customer_auth.ts@5df215edcb21f26a3948a94e51c8aab124f53050` and `customer_auth.test.ts@fbf3bf2fa231cfa295ab0d5b6b76efff0344509f`. Eight explicit structural checks passed against pushed blobs, including ordering, removed silent catch, typed error paths and regression fixtures.
- **PASS_SIMULATED (isolated V8, not Vitest):** executed the pushed `createCustomerAuthService` function body `customer_auth.ts@5df215edcb21f26a3948a94e51c8aab124f53050` after syntax-only TypeScript erasure with explicit stubbed external dependencies and an in-memory session repository; four checks passed: unsupported SMS does not persist a challenge, refresh repository outage returns typed 503, logout repository outage returns typed 503, successful retry marks access hash revoked. This is *not* executing the full TypeScript package, Gateway Fastify routes, real repository, or production code dependencies.
- **NOT_RUN:** `pnpm --filter @masanawa/gateway exec vitest run src/customer_auth.test.ts` (exact gateway workspace/test command must be verified against current package). The connected container has Node 22 but no DNS/private GitHub checkout or repository dependency installation. No real TypeScript build, Fastify HTTP route test, PostgreSQL, provider sandbox, Flutter, physical device or signed APK executed. Static readback is not a unit/integration/E2E pass.
- **AF00 shared-route integration issue:** `app.ts` currently uses `authError()` to map OTP/refresh error status, but the `POST /auth/logout` handler directly awaits `auth.logout` without `authError()`. Generic Fastify error handler turns its typed 503 into HTTP 500, still a failure rather than false 200, but not the intended retryable HTTP 503. AF00 must wrap logout in the canonical `authError` mapper and test the actual HTTP response after transferring or claiming `app.ts`. No unowned changes were made.
- **Product-wide AF08 incomplete:** desired phone + numeric-password account flow, rate-limiting, verified recovery/step-up, secure persistence and bilingual launch UX have not been implemented/qualified by this narrow fix. No identity claim is established by an unverified phone number. UX-A01/A02, WF-A09, SA-A03: **NOT_RUN** real flow evidence.

## Integration handoff
Pull request: https://github.com/Baatiku/masanawa/pull/588 (draft). Full SHA-specific code checkpoints above; final handoff head is this document update commit. Preserve local changes and Work #497 on AF00 reconciliation. AF00 should examine current production automatic deploy/SQL triggers before integrating; source-tested non-deploying integration is allowed after real strict TS/Vitest/Fastify tests and collisions reviewed. Do not merge to a production-deploying main without safe gates. Release exact-path claim after PR and readback. Do not claim VERIFIED_E2E or a completed APK.
