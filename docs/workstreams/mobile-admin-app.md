# Mobile admin app — 2026-10-05

Owner/window: ChatGPT mobile admin app implementation, explicitly assigned by the user to derive a separate admin-facing Flutter app from the existing customer mobile app.

Branch: `work/mobile-admin-app-20261005`
Base: `24c8ed783cc2b4797e2c915a698b69ee997f3995`

Owned paths:
- `apps/admin_mobile/**`
- `services/ops/**`
- `docs/ADMIN-CONTROL-PLANE.md`
- `docs/workstreams/mobile-admin-app.md`

Non-owned / read-only dependencies:
- `apps/mobile/**` is reference-only; no edits in this workstream.
- Gateway shared contracts, migrations, billing, crypto, channels and customer authentication remain owned by their active workstreams.
- Existing `apps/ops/**` remains reference-only; this workstream now owns additive `services/ops/**` admin projections because the user explicitly expanded the task to full-platform administration.

Implemented:
- separate Android-first Flutter application at `apps/admin_mobile`;
- independent application id `ng.masanawa.admin`, so it installs beside the customer app;
- approved Masanawa Agent Blue logo/theme reused without customer chat/media/commerce/creator code;
- minimal Android permissions only: Internet and network state;
- operator credential persisted with `flutter_secure_storage`; no credential committed;
- configurable `ADMIN_BASE_URL`;
- Ops health/readiness dashboard;
- real Agent list from `GET /v1/agents`;
- real Skill catalog from `GET /v1/skills`;
- Agent editor for display name, role label, about, greeting, visibility and sort order via the existing revision-checked presentation write contract;
- Agent Skill assignment editor using the existing read/write assignment contracts;
- Users and Transactions sections are intentionally explicit contract-pending states rather than fake data or direct database access.

Current server dependencies:
- `GET /healthz`
- `GET /readyz`
- `GET /v1/agents`
- `PUT /v1/agents/:characterId/presentation`
- `GET /v1/skills`
- `GET /v1/agents/:characterId/skills`
- `PUT /v1/agents/:characterId/skills`

Verification:
- branch diff is isolated to `apps/admin_mobile/**` plus this claim;
- customer `apps/mobile/**` is untouched;
- no secret/token is committed;
- source/API shapes were checked against current `services/ops/src/app.ts`;
- Flutter/Dart SDK is not installed in this execution environment, so a real `flutter analyze`/APK compile is not claimed.

Next:
- expose scoped Ops projections for users, billing/crypto transactions, provider health and audit events;
- replace bootstrap bearer entry with the production admin identity/sign-in flow once that contract is available;
- run Flutter analyze/build on a machine with the SDK and fix any toolchain-specific issues.

Implementation status: first functional slice complete.
Verification status: source/contract verified; physical compile pending.
Deployment status: not deployed.
