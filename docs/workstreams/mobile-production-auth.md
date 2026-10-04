# Mobile production authentication continuation

Owner/window: ChatGPT continuation of the completed Android-shell window, explicitly transferred by the user on 2026-10-05.

Branch: `work/mobile-production-auth-20261005`
Base: `24c8ed783cc2b4797e2c915a698b69ee997f3995` (main after merged PRs #104, #125 and #127).

## Purpose
Finish the production-authentication cleanup that the prior Android-shell window stopped on: ordinary signed-in users must not enter or manage an Alpha/developer token to use the agent shell.

## Owned paths
- apps/mobile/lib/src/state/session_state.dart
- apps/mobile/lib/src/state/agent_connection_state.dart
- apps/mobile/lib/src/core/providers.dart
- apps/mobile/lib/src/router/app_router.dart
- apps/mobile/lib/src/screens/onboarding/phone_login_screen.dart
- apps/mobile/lib/src/screens/settings/settings_screen.dart
- apps/mobile/lib/src/screens/settings/developer_screen.dart (retirement/removal only)
- apps/mobile/test/session_state_test.dart
- apps/mobile/test/agent_recovery_test.dart (production-auth regression coverage only)
- services/gateway/src/production_auth.ts (new)
- adapters/storage/postgres/src/identity/platform-session.ts (new narrow external-session identity bridge)
- adapters/storage/postgres/src/identity/index.ts and adapters/storage/postgres/src/index.ts (export only)
- services/gateway/src/main.ts (authorizer composition only)
- services/gateway/package.json if a verification dependency is required
- focused Gateway auth tests
- this claim

No billing, crypto, provider fulfillment, migrations, deployment, teaching, channel, or unrelated UI paths are owned.

## Recovered stop point
The universal shell is already merged. The previous window stopped while tracing the login-issued access token because the Flutter app has real OTP sessions while the Gateway runtime remains Alpha-token-only. The Developer screen and secure debug connection can override the real session token.

## Current step
Replace client-side developer-token selection with the normal signed-in session as the only production credential, and add a bounded server-side bridge that validates the existing platform session identity before mapping it into canonical Masanawa authority. Preserve Alpha mode only as an explicit server-side development mode; do not expose Alpha credentials in the customer app.

Implementation: in progress.
Verification: pending.
Deployment: not claimed.
