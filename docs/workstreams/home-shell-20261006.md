# Home shell lane claim — 2026-10-06

- **Lane:** H — Home shell components
- **Owner/window:** ChatGPT Home shell implementation window
- **Branch:** `work/home-shell-20261006`
- **Base:** `f3aea97a1cf74736c567950ca3091eef91806406` (PR #198 docs overlay)
- **Status:** ACTIVE
- **Task scope:** Home presentation/state/components only; no shared router, Gateway composition, production environment, Commerce/Event migrations, or chat transport.
- **Owned paths:**
  - `apps/mobile/lib/src/home/**`
  - `apps/mobile/test/home/**`
  - `docs/workstreams/home-shell-20261006.md`
- **Explicitly not owned:** `services/gateway/src/app.ts`, `services/gateway/src/main.ts`, `apps/mobile/lib/src/router/app_router.dart`, `apps/mobile/lib/src/screens/chat/ai_chat_screen.dart`, `apps/mobile/lib/src/agents/masanawa_transport.dart`, production configuration, provider code, migrations.
- **Dependencies:** PR #136 must wire navigation/transport and real server-resolved Home data. This lane exposes typed presentation/state callbacks and does not hard-code Character IDs or financial behavior.
- **Current step:** inspect existing mobile patterns, implement isolated Home models/state/widgets/screen, add focused tests, then hand off exact integration points.
- **Last updated:** 2026-10-06
- **Implementation:** in progress
- **Verification:** pending
- **Deployment:** not owned / not claimed
