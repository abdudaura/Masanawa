# Mobile production authentication continuation

Owner/window: ChatGPT continuation of the completed Android-shell window, explicitly transferred by the user on 2026-10-05.

Branch: `work/mobile-production-auth-20261005`
Base: `24c8ed783cc2b4797e2c915a698b69ee997f3995` (main after merged PRs #104, #125 and #127).

## Purpose
Finish the production-authentication cleanup that the prior Android-shell window stopped on: ordinary signed-in users must not enter or manage an Alpha/developer token to use the agent shell.

## Owned paths
- apps/mobile/lib/src/state/session_state.dart
- apps/mobile/lib/src/state/agent_connection_state.dart
- apps/mobile/lib/src/agents/masanawa_transport.dart (runtime-default productionization only)
- apps/mobile/lib/src/core/providers.dart
- apps/mobile/lib/src/core/network/api_client.dart (shared session-refresh singleflight only)
- apps/mobile/lib/src/router/app_router.dart
- apps/mobile/lib/src/screens/onboarding/phone_login_screen.dart
- apps/mobile/lib/src/screens/settings/settings_screen.dart
- apps/mobile/lib/src/screens/settings/developer_screen.dart (retirement/removal only)
- apps/mobile/test/session_state_test.dart
- apps/mobile/test/agent_recovery_test.dart (production-auth regression coverage only)
- apps/mobile/README.md, apps/mobile/docs/BUILDS.md and apps/mobile/tool/build_alpha.* (remove obsolete client-token instructions only)
- scripts/alpha-bootstrap.mjs (support-agent seed correctness and removal of obsolete mobile token output only)
- services/gateway/src/production_auth.ts (new)
- adapters/storage/postgres/src/identity/platform-session.ts (new narrow external-session identity bridge)
- adapters/storage/postgres/src/identity/index.ts (export only)
- services/gateway/src/main.ts (authorizer composition only)
- services/gateway/src/app.ts (Gateway PlatformError HTTP mapping only)
- services/gateway/src/alpha_dev.ts (auth error normalization only)
- services/gateway/package.json if a verification dependency is required
- focused Gateway auth tests
- services/gateway/src/production_inference.ts and production_strategy.ts (production Gemini pool strategy only)
- infra/portable/* (provider/domain/secret portability contracts)
- scripts/database/* (portable PostgreSQL export/import only)
- scripts/railway/* (rebuild/secret portability automation only)
- .github/workflows/railway-rebuild.yml
- scripts/check-provider-portability.mjs
- package.json and foundation CI (portability check wiring only)
- infra/deployment/gateway/Dockerfile (workspace-complete build fix only)
- docs/PORTABILITY.md
- this claim

No billing, crypto, provider fulfillment, migrations, deployment, teaching, channel, or unrelated UI paths are owned.

## Recovered stop point
The universal shell is already merged. The previous window stopped while tracing the login-issued access token because the Flutter app has real OTP sessions while the Gateway runtime remains Alpha-token-only. The Developer screen and secure debug connection can override the real session token.

## Current step
Replace client-side developer-token selection with the normal signed-in session as the only production credential, and add a bounded server-side bridge that validates the existing platform session identity before mapping it into canonical Masanawa authority. Preserve Alpha mode only as an explicit server-side development mode; do not expose Alpha credentials in the customer app.

Implementation: substantially complete in PR #128:
- removed client Developer/Alpha token UI and debug login;
- normal OTP session is the only mobile credential;
- hosted agent runtime defaults on;
- Gateway validates the existing platform session via /auth/me;
- external platform users map into canonical Masanawa users;
- directory/conversation access is limited to support agents plus the user's relationships;
- platform access-token refresh is shared with Gateway calls;
- canonical DELETE /auth/logout is used;
- obsolete client-token build/docs were removed.

Verification:
- PR is mergeable and based directly on main 24c8ed783cc2b4797e2c915a698b69ee997f3995.
- GitHub Actions Foundation CI and Mobile Build currently fail before executing any step (runner allocation failure; jobs contain zero steps), so no passing CI is claimed.
- Source audit found no remaining mobile Developer route, devLogin, AgentConnectionStore, connection.token, Alpha mobile token, old billing-worker Gateway URL, or stale Developer instructions in the changed runtime paths.
- Local TypeScript parser accepted the exact new production-auth and PostgreSQL identity-bridge source files with no syntax diagnostics.

Infrastructure findings:
- `nurainworker-production.up.railway.app` currently belongs to the active billing worker and starts `scripts/flutterwave-webhook-proxy.mjs`; it is NOT the agent Gateway and must not be reused by the APK.
- Railway Free-plan resource provisioning is currently exhausted, so creating a fifth dedicated service is blocked.
- `@nurain/call-gateway` is an active remote APK-builder service with recent activity and is intentionally left untouched.
- Existing DigitalOcean Droplet `masanawa-relay-bridge` (209.38.107.173, $4/mo) could host a second Gateway process, but the available DigitalOcean connector cannot execute SSH commands.
- Render can host a separate free Gateway, but its connector requires explicit user workspace selection before create/update actions.
- Mobile now targets the stable product origin `https://gateway.masanawa.com`; DNS/hosting can move later without another APK build.

Deployment: not claimed. The stable Gateway origin is code-ready but not yet backed by a deployed service.
