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

Status: claim published before reconciliation edits.