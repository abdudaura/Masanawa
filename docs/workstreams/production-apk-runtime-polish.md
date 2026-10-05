# Production APK runtime polish — 2026-10-05

Owner/window: ChatGPT production APK integration continuation, explicitly assigned from physical APK feedback.

Branch: `work/production-apk-integration-20261005`
Base SHA at claim: `427c6d6e3d82fedb887812c2d819684bb8b5b1a6`

Scope / observed acceptance failures:
- signed-in APK receives HTTP 200 from `/agent/directory` but the production platform tenant projects an empty roster;
- email/phone auth content is top-heavy and visually compressed instead of vertically balanced;
- Resend OTP messages are plain text instead of Masanawa-branded transactional email;
- the latest Railway deploy is blocked by an outdated pnpm lockfile after adding `@masanawa/identity`.

Owned paths for this continuation:
- `apps/mobile/lib/src/ui/components/onboarding_scaffold.dart` and focused onboarding layout tests;
- `services/gateway/src/customer_auth.ts` and focused auth/email tests;
- production platform-agent bootstrap implementation/tests under `services/gateway/src/`;
- `services/gateway/src/main.ts` only for safe idempotent production bootstrap composition;
- root `pnpm-lock.yaml` only to reconcile the already-added root workspace dependency;
- this claim/handoff file.

Constraints:
- keep the mobile roster server-driven; never hard-code Gwani/Gwana in the APK;
- bootstrap only when the platform tenant has no support agents, never overwrite admin-managed agents;
- preserve migration checksums and existing billing/crypto/auth integration;
- do not modify the separate APK-builder service.

Status: claimed; implementation in progress.
