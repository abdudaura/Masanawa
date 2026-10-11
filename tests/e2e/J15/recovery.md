# J15 / A14 — recovery acceptance on the canonical external_videos review path

On a disposable PostgreSQL 18 database run existing migration 0001 plus migration 0004, **after** any 0002/0003 migration required by the registry. Do not mutate live migration history.

1. Admin submits official URL: pending is staff-only; public GET /v1/videos is empty.
2. Staff verifies official player/rights and enters a fresh evidence reference: approved appears publicly.
3. Staff hides or marks unavailable: removed immediately from public list. Fan never gains staff permissions.
4. Staff selects **Return to review** and confirms: hidden/unavailable -> pending; remains nonpublic. Stale expectedState returns 409; conflicting second request cannot resurrect.
5. Staff independently checks provider/embed eligibility and explicitly approves with new evidence: public again; review_audit preserves every transition.
6. Official withdrawal worker **disabled by default**. Only documented provider-authorized, verified 'officially_removed' status for exact video may CAS approved -> unavailable with source evidence. Duplicate event is a no-op; no automatic reapproval.
7. Repeat as another tenant and a fan: 403 or zero rows and no cross-tenant mutation. Test offline/error/retry and account switch in Admin and public video client.
8. AF00 owns migration root registration, route/worker composition, mobile navigation, real provider capability authorization, staging restore and release. Never merge to Railway-linked main without release gate.

Scoped commands once full checkout exists:
`pnpm exec vitest run services/gateway/src/modules/external_videos/service.test.ts services/gateway/src/modules/external_videos/routes.test.ts services/worker/src/jobs/external_videos/recovery.test.ts adapters/storage/postgres/src/external_videos/repository.integration.test.ts`
`pnpm -r typecheck`
`cd apps/admin_mobile && flutter analyze && flutter test test/features/external_videos/video_recovery_test.dart && flutter build apk --debug`
`cd apps/mobile && flutter analyze && flutter test && flutter build apk --debug`

State at authoring: source only until those exact-head commands and PostgreSQL fresh/upgrade execute. No provider withdrawal transport/auto-job is registered.
