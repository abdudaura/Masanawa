# R14 — private lock-screen-safe Talk push previews (claim + handoff)

Updated: 2026-10-08 UTC; window: GPT-6 R14 privacy
Status: PARTIAL_IMPLEMENTATION (claim only; source pending)
Claim/lease: this branch and this file; follow exact push-preview paths only. Five-minute activity rule applies.
Base main SHA: `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`
Branch: `work/r14-talk-push-privacy-20261008-gpt6`
Target PR: new **draft** PR into main.
Requirement IDs: R14, N06, M08, T05, J04/J11.

## Exact owned files
- `services/gateway/src/talk_notifications/policy.ts`
- `services/gateway/src/talk_notifications/policy.test.ts`
- `services/gateway/src/talk_notifications/delivery.test.ts`
- `apps/mobile/lib/src/core/mobile_push.dart`
- `apps/mobile/lib/src/core/private_push_preview.dart` (new)
- `apps/mobile/test/private_push_preview_test.dart` (new)
- this unique handoff file.

## Integration constraints
Existing Talk notification domain events and dedupe in PostgreSQL, authenticated device registration and Firebase FCM sender are authoritative and unchanged. Do not modify shared Gateway composer, schema/migrations, localization ARB files, R17/C08 shell, C03 realtime or R14 FCM transport (#436). `#436` owns `services/gateway/src/mobile_push.ts`. `#497` touches large shared integration paths; this branch avoids them. Historical `docs/workstreams/talks-notification-policy-20261007.md` lease released; preserve existing design. Do not expose actor-provided display names or server-supplied arbitrary text on lock screens.

## Progress
Claim committed before source implementation. Complete handoff with exact HEAD SHA, tests/evidence, blocked device/provider gates and remaining source risks before ending.
