# Production mobile authentication — 2026-10-04

Owner/window: ChatGPT production mobile auth continuation, explicitly assigned by the user to remove Developer/Alpha-token setup and prepare the app for normal production use.

Branch: `work/production-mobile-auth-20261004`
Base: current `main` after merged mobile shell PRs #104, #125 and #127.

Owned paths for this workstream:
- `services/gateway/src/production_auth.ts` and `services/gateway/src/production_auth.test.ts`.
- `services/gateway/src/app.ts`, `services/gateway/src/main.ts` only for production auth/session composition and route aliases.
- `services/gateway/package.json` only if auth implementation needs a pinned dependency.
- `adapters/storage/postgres/src/identity/production-auth.ts` and export wiring only for canonical Supabase-subject -> Masanawa User mapping.
- `apps/mobile/lib/src/core/network/api_client.dart` for Masanawa Gateway auth base/default only.
- `apps/mobile/lib/src/state/session_state.dart` to remove Alpha/dev session semantics.
- `apps/mobile/lib/src/state/agent_connection_state.dart`, `apps/mobile/lib/src/core/providers.dart` to remove manual Agent connection/token state.
- `apps/mobile/lib/src/router/app_router.dart`, `apps/mobile/lib/src/screens/settings/settings_screen.dart`, `apps/mobile/lib/src/screens/onboarding/phone_login_screen.dart`, `apps/mobile/lib/src/screens/onboarding/name_screen.dart` to remove Developer/test-login UI and complete the real signed-in profile.
- `apps/mobile/lib/src/screens/settings/developer_screen.dart` deletion.
- `apps/mobile/lib/src/screens/onboarding/otp_screen.dart`, `apps/mobile/lib/src/screens/splash/splash_screen.dart`, `apps/mobile/lib/src/screens/chat/ai_chat_screen.dart`, `apps/mobile/lib/src/screens/chat/masana_list_screen.dart`, `apps/mobile/lib/src/state/creator_economy_state.dart`, `apps/mobile/lib/src/state/creator_skills_state.dart`, and `apps/mobile/lib/src/agents/agent_feedback.dart` only to remove dependencies on the retired Developer/connection state and bind recovery to the production session.
- focused mobile tests affected by the above.
- production build/documentation cleanup: `apps/mobile/README.md`, `apps/mobile/docs/BUILDS.md`, `apps/mobile/docs/AGENT-GATEWAY-CONTRACT.md`, obsolete `apps/mobile/docs/CHAT-SHELL-LOCAL-TEST.md`, and obsolete Alpha/test build helpers under `apps/mobile/tool/` that still require manual tokens/runtime-enable flags.
- this claim and production-auth handoff docs.

Production direction:
1. One normal user login/session. No Alpha access token in the app.
2. Gateway owns OTP/session endpoints backed by the existing Supabase Auth project.
3. Gateway validates each bearer session server-side and maps the Supabase subject to one canonical Masanawa User in the existing platform tenant.
4. Directory exposure is restricted to platform support agents plus Characters already related to the signed-in user; another user's clone must not be exposed.
5. Conversation admission creates/uses the signed-in user's relationship only after the Character is proven visible/admitted.
6. Mobile Agent transports automatically use the same authenticated session token.
7. Preserve existing Character/Skill/Commerce/crypto/billing/channel authorities; this work does not invent a second wallet, identity or token system.

External/runtime dependency:
- current production worker already has SUPABASE_URL and server credentials.
- add a Supabase publishable key and a non-Alpha platform tenant reference to the runtime; the existing canonical tenant/agent identities are reused.
- live Railway runtime currently uses the older /v1/agent/** namespace, so deployment integration must preserve compatibility aliases while the merged app uses /agent/**.

Status:
- implementation complete on PR #131;
- GitHub reports the PR mergeable;
- PR workflow runs 37249010653 (Mobile Build) and 37249010586 (Foundation CI) both ended with jobs whose `steps` are null and no logs, the repository's known runner-allocation failure; no executable check ran;
- source-level review found and fixed Agent-token refresh/retry, concurrent refresh sharing, profile-save session preservation, obsolete Alpha build tooling/docs, and production Gateway defaults;
- local APK compilation/device testing remains explicitly owned by the user;
- production Railway runtime integration remains the next step and must preserve the newer billing/crypto lineage rather than replacing it with main.