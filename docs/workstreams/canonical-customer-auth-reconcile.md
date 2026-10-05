# Canonical customer-auth reconciliation — 2026-10-05

Owner/window: continuation of the production mobile-auth cutover, explicitly assigned by the user to remove manual Developer/token setup and prepare one production app flow.

Branch: `work/canonical-customer-auth-reconcile-20261005`
Base: current `main` after PR #131 merged.

Purpose:
- reconcile PR #131 with the newer canonical customer-auth/platform-session implementation already present on the live billing branch;
- use one durable Masanawa platform session for app, Agents, creator features, billing and crypto;
- remove the duplicate Supabase-specific production-auth authority added by #131;
- keep Developer/debug-token UI and manual Gateway credentials removed;
- preserve automatic mobile access-token refresh and secret-free builds.

Owned paths:
- `packages/security/src/platform-session.ts`, focused tests and export wiring;
- `packages/security/migrations/0100_platform_sessions.sql`;
- `adapters/storage/postgres/src/security/platform-session.ts`, focused tests and export/migration wiring;
- `packages/identity/src/repository.ts` and `adapters/storage/postgres/src/identity/relationships.ts` only for a narrow get-or-create relationship provisioning port used after current session authorization;
- `services/gateway/src/customer_auth.ts`, focused tests, and narrow Gateway composition/routes/authorizer integration;
- deletion of `services/gateway/src/production_auth.ts` and its focused test;
- deletion of `adapters/storage/postgres/src/identity/production-auth.ts` and its export wiring;
- mobile auth compatibility paths: `apps/mobile/lib/src/state/session_state.dart`, `apps/mobile/lib/src/screens/onboarding/name_screen.dart`, `apps/mobile/lib/src/screens/onboarding/otp_screen.dart`, `apps/mobile/lib/src/router/app_router.dart`, `apps/mobile/lib/src/core/network/api_client.dart`, affected tests;
- this claim.

Canonical direction:
1. OTP challenges, user profiles, access/refresh tokens and revocation are owned by `@masanawa/security` PlatformSession.
2. The Gateway's `customer_auth.ts` owns OTP delivery/session HTTP behavior.
3. Agent/directory/creator/commerce admission resolves the same PlatformSession identity; no shared Alpha token and no second production auth store.
4. First signup uses the existing verified-OTP name-capture retry contract; no fake local user.
5. Billing/crypto keep using the same session authorizer already present on the live billing branch.
6. Live deployment integration will be done from the current billing source lineage, not by replacing it with main.

Status:
- implementation complete on PR #132;
- duplicate Supabase production auth removed in favor of canonical PlatformSession;
- Agent/directory/creator/commerce authorization now derives from the same durable customer session used by billing;
- mobile first-signup name capture and server-advertised OTP channels reconciled;
- automatic API/Agent access-token rotation from #131 preserved;
- GitHub runs 37250297290 (Foundation CI) and 37250297293 (Mobile Build) failed before step 1 with `steps: null` and no logs, so no compiler/test command executed;
- strict source/import audit found and fixed a billing-only `financial_service.ts` dependency that is absent from main; all new module imports now resolve inside main;
- live Railway integration must be applied from the latest active billing branch rather than replacing it with main.