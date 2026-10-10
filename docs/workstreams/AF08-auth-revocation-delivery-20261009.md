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


---

## Outcome-first continuation — 2026-10-10 (existing PR #588)

**Parent customer milestone:** Phone/email account registration, secure sign-in, verified recovery, and Settings account lifecycle (UX-A02 / UI-02 / UI-03 / UI-16). **State: PARTIAL_IMPLEMENTATION**. This is a continuation of PR #588, not a new helper or competing integration branch. Previous OTP/session fixes and this document are preserved. Main at dispatch: \`c7f7280e640d3098be3e26f05149a0d66085441b\`; preceding PR source head: \`ec372e0e89ea3dcf815b2511e66bb92f548327d6\`. Source checkpoint **\`aae68d353b104438e785d977bf9ef906fd8da926\`** (this handoff commit is subsequent). Exact claim: \`masanawa01-af08-phone-password-20261010-pr588-continuation\`, published/read back on \`factory/claims\`. Only files listed below were edited.

### New customer-facing and service source (NOT yet mounted/activated)

- \`services/gateway/src/auth_audio_first/phone_password_policy.ts\`: E.164, numeric 8–16 digit password validation, secure random salt, memory-hard scrypt verification with constant-time comparison and a dummy verification for unknown accounts. Pepper must be a server secret \`MASANAWA_AUTH_PASSWORD_PEPPER\`, length ≥32; never committed/client-supplied.
- \`services/gateway/src/auth_audio_first/phone_password.ts\`: one canonical \`security.platform_sessions\` issuer and \`identity.users\` identity; register/login, typed failure results, restricted sign-in, no implicit telephone possession claim. \`AuthUser.phone\` remains reserved for independently verified contact; \`unverifiedPhone\` and \`phoneVerified:false\` are distinct presentation hints. Successful registration reports \`isNewUser:true\`.
- \`adapters/storage/postgres/src/security/phone_password.ts\`: transactionally creates the existing canonical user/profile/identity subject (distinct \`phone-password\` namespace), stores salted verifier separately, serializes registration, checks active identities, denies verified-number account takeover, and handles five failed attempts with a fifteen-minute per-credential lock. Has no new session store. Requires migration below before any use.
- \`services/gateway/src/auth_audio_first/phone_password_routes.ts\`: typed, \`no-store\` login/register HTTP route module; intentionally **not registered** in shared \`services/gateway/src/app.ts\` until migration, per-IP+per-identifier throttling and composition are reviewed. No live endpoint exists from this PR alone.
- \`services/gateway/src/auth_audio_first/phone_password.test.ts\`: authored Vitest positive/negative service tests. **NOT_RUN**.
- \`services/gateway/src/auth_audio_first/phone_password_policy.test.mjs\`: actual Node test source executed with the pushed policy module.
- \`apps/mobile/lib/src/auth_audio_first/phone_password_transport.dart\`: anonymous Dio transport for two new routes, separate from the existing signed-in bearer/refresh interceptor.
- \`apps/mobile/lib/src/auth_audio_first/phone_password_form.dart\`: self-contained sign-in/sign-up form (country-code phone input, obscured numeric password/show toggle, name on sign-up, Hausa/English copy, loading/denied/error/retry, explicit unverified-phone warning and email fallback). AF00/AF08 must mount it in existing onboarding and wire the canonical \`SessionController\` token persistence/account switch before acceptance. It is **not a reachable APK screen today**.

### Exact PostgreSQL migration contract — AF00 migration owner

AF00 must allocate an **append-only** migration against \`packages/security/migrations/0100_platform_sessions.sql\` and the authoritative migration registry, tested on disposable PostgreSQL before composition. Suggested SQL **proposal only** (not applied, unreviewed for current environment):

\`\`\`sql
ALTER TABLE security.platform_user_profiles
  ADD COLUMN unverified_phone text;
ALTER TABLE security.platform_user_profiles
  DROP CONSTRAINT platform_user_profiles_check;
ALTER TABLE security.platform_user_profiles
  ADD CONSTRAINT platform_user_profiles_contact_present_chk
  CHECK (email IS NOT NULL OR phone IS NOT NULL OR unverified_phone IS NOT NULL);
ALTER TABLE security.platform_user_profiles
  ADD CONSTRAINT platform_user_profiles_unverified_phone_fmt_chk
  CHECK (unverified_phone IS NULL OR unverified_phone ~ '^\+[1-9][0-9]{6,14}$');
CREATE UNIQUE INDEX platform_user_profiles_unverified_phone_uidx
  ON security.platform_user_profiles (tenant_id, unverified_phone)
  WHERE unverified_phone IS NOT NULL;
CREATE TABLE security.platform_phone_password_credentials (
  tenant_id text NOT NULL,
  phone text NOT NULL CHECK (phone ~ '^\+[1-9][0-9]{6,14}$'),
  user_id text NOT NULL,
  password_hash text NOT NULL CHECK (password_hash ~ '^scrypt:v1:[0-9a-f]{32}:[0-9a-f]{128}$'),
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,phone),
  UNIQUE (tenant_id,user_id),
  FOREIGN KEY (tenant_id,user_id)
    REFERENCES security.platform_user_profiles(tenant_id,user_id)
);
\`\`\`

**Review before using**: PostgreSQL-generated \`platform_user_profiles_check\` name must be confirmed on a disposable DB. Check OTP-proven number conflicts, account-delete cascading/revocation behavior, concurrent signup, profile uniqueness, migration registry order, and rollback/expand-contract. Do not edit original 0100 migration or release an unchecked SQL patch. If account lifecycle requires secure credential deletion, AF14 + AF08 coordinate with the single deletion authority. **Crucial safety rule:** self-reported phone MUST NEVER write to \`security.platform_user_profiles.phone\` nor be treated as password reset/payment step-up proof. Only \`unverified_phone\` receives the self-reported value.

### Actual executable evidence and precise unavailable checks

- **PASS_REAL focused unit only:** Linux container Node \`v22.16.0\`, exact repository policy source and native test hashes via \`git hash-object\` = \`a2a5c1c4c889bbe7b4b724f4ab2367b83825bea4\` and \`2b99b227f7b09092ba249f5dd8f3049f6763b59e\`; these match GitHub file blob IDs. In the isolated exact-source directory: \`node --disable-warning=ExperimentalWarning --experimental-strip-types --test phone_password_policy.test.mjs\` → **4 passed, 0 failed**. These are actual Node policy unit tests, not the Gateway/DB/Flutter suite.
- **BLOCKED/NOT_RUN:** \`pnpm --filter @masanawa/gateway-service exec vitest run src/customer_auth.test.ts src/auth_audio_first/phone_password.test.ts\`; \`pnpm --filter @masanawa/gateway-service typecheck\`; Postgres SQL migration + two-account cross-tenant auth tests; \`cd apps/mobile && flutter analyze lib/src/auth_audio_first && flutter test\`; Android sign-in; verified recovery/step-up; device and provider evidence. This container has no private checkout/dependencies, pnpm, PostgreSQL or Flutter. \`git ls-remote https://github.com/Baatiku/masanawa.git HEAD\` → \`Could not resolve host: github.com\`. GitHub API can read/write the existing PR, but is not an executable checkout.
- GitHub Actions Foundation run \`38017678339\` job \`114111495867\` and Mobile Build \`38017678308\` job \`114111495361\`: both **failure with zero returned executable steps** at source \`f9a37d2f58a247be52fc3955c4b40f45f0353c11\`. No passing CI or compiler evidence; not a demonstrated TypeScript/Flutter failure. Updated source SHA requires its own tests.
- **No real login/DB/HTTP session issuance or token persistence verified.** No migrations applied, provider configured, main branch push, Android APK, production deployment or financial action occurred.

### Exact integration blockers / execution ownership / next executable action

1. **AF00 shared Gateway + migration + release safety owner:** assign one add-only migration with the columns/constraints above, review the provenance of unverified vs verified phone and canonical readback, register the repository and auth service using server-managed pepper; add **distributed per-IP and per-number registration/login throttles** before enabling routes (the adapter lock is per known credential only). Keep phone login disabled by default until these are ready; fix \`/auth/logout\` using existing \`authError\` mapper and run HTTP negative tests. AF00 owns \`services/gateway/src/app.ts\`, bootstrapping/exports/migrations/deploy config; request bounded transfer if scope changes.
2. **AF08 mobile identity + AF00 root composition, AF14 Settings:** explicitly mount the isolated \`PhonePasswordForm\` behind the existing email/phone selector, call the canonical SessionController’s secure persist method on successful \`AuthTokens\`, protect against account-switch races, and mirror \`unverifiedPhone\` / \`phoneVerified\` through authorized DTOs without altering verified \`phone\`. Restore/logout/refresh must never imply unverified number ownership. Provide verified email recovery where available; do **not** allow password reset solely from an unverified phone.
3. **AF13 capable executable runner / AF08 source owner:** obtain an actual checkout with Node/pnpm lockfile, run strict TS/Vitest plus Fastify HTTP and disposable PG migrations/concurrent lockout/unknown-account tests; Flutter analyze/widget tests and two-account sign-in. Review failed zero-step actions without relabeling them test passes.
4. **AF00 one safe integration baseline:** main currently \`c7f7280e640d3098be3e26f05149a0d66085441b\`; PR continues from earlier main and remains diverged. Elect/audit one existing **nondeploying** integration target; compare latest PR #588 files with other AF08 source and #497/#597, run exact-head executable checks, merge compatible source only after necessary security and conflict review. Main can trigger Mobile/Foundation/Vercel automation. An integration merge is not release permission. Owner's local APK/source remains unreconciled.

**Acceptance still outstanding:** UX-A01/A02 and UI-02/03/16; auth request→DB credential→session token→client persistence→logout/recovery→restart remains **PARTIAL_IMPLEMENTATION**. No duplicate auth service or secondary phone-identity proof should be introduced.
