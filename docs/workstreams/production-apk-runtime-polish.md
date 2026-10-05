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
- `apps/mobile/lib/src/ui/components/onboarding_scaffold.dart` and `apps/mobile/test/onboarding_scaffold_test.dart`;
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

## Implemented

- production startup can idempotently seed server-owned Gwani and Gwana support Characters
  only when the platform tenant has no support-agent roster;
- the bootstrap reuses visible partially-created presentations after interruption, assigns
  current platform-support Skills, creates profiles last, and never overwrites an
  admin-managed support roster;
- Gwani is the default support Character with Gemini Bodi; Gwana uses Gemini Sulafat;
- the shared onboarding/auth scaffold vertically balances content on normal phones while
  remaining scrollable for compact screens and keyboard insets;
- focused mobile layout regressions cover the former top-heavy layout and compact keyboard
  behavior;
- Resend email OTP delivery renders a branded Masanawa HTML + text transactional message
  with the approved Agent Blue palette, security note and six-digit code;
- failed OTP delivery removes the challenge so an unseen code cannot be accepted;
- the production workspace dependency/lock reconciliation needed by Gateway startup is
  carried on the production integration branch.

## Remaining acceptance

- run the focused Gateway/auth/bootstrap and Flutter layout tests on a working runner;
- build and install an exact-current-head release APK;
- verify the production tenant actually projects Gwani/Gwana after startup without
  replacing any admin-managed roster;
- send a real Resend OTP and visually inspect delivery in a real mailbox;
- verify phone/email auth layout on the physical test device with and without the keyboard.

Status: implementation complete; external build/deployment/device qualification remains open.
