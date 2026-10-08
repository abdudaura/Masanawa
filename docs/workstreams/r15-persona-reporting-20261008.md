# R15 — Private AI persona safety reports (2026-10-08)

Owner/window: GPT-6 R15 persona-reporting window
Branch: `work/r15-persona-reporting-20261008-gpt6`
Base main SHA: `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`
Claim established: 2026-10-08T11:43:00Z (Africa/Lagos 12:43)
Last repository-visible activity: claim commit; next updates on branch.
Status: IN_PROGRESS / NOT VERIFIED / NOT MERGED.

## Exact owned paths
- `apps/mobile/lib/src/screens/profile/persona_profile_screen.dart`
- `apps/mobile/lib/src/screens/profile/persona_report_sheet.dart` (new)
- `apps/mobile/lib/src/talks/talk_safety.dart`
- `apps/mobile/lib/src/talks/talk_safety_http_transport.dart`
- `apps/mobile/test/persona_report_sheet_test.dart` (new)
- `apps/mobile/test/talk_safety_http_transport_test.dart` (new)
- `services/gateway/src/talk_safety/persona_report.test.ts` (new)
- this handoff document.

Existing live Gateway `POST /safety/reports` / `TalkSafetyService.report` / Postgres `talks.safety_reports` from merged migration `talks/0009_talk_safety.sql` are deliberately REUSED; no competing migration, new auth authority, or shared Gateway composer edit is required. Report target type `persona` and client-request-key idempotency are already accepted. User-facing scope: signed-in person reports current Expert/Twin profile using a private reason/detail sheet; actual server acknowledgement, once-only request retries, no false success after uncertain response, auth refresh, and distinguishable errors.

## Conflict and current ownership scan
Active C01 #468 / C02 #472/#475 / C03 #473/#483 / C04 #478 / C05 #474/#476 / C07 #480 / R18 #435 and R17/C08 own shared routes/UI. Prior R15 PRs #443, #446, #450, #451 (last updates ~06:00Z) touch different exact files; do not overwrite their work. Never edit shared root Flutter router, `services/gateway/src/app.ts` or `main.ts`, ledger, central CI #457. This is an R15 bounded feature, not completion of R15 or R19. Relevant gates: R15; J06/J11; P/N/M/Q safety/privacy IDs to be matched at final audit.

## Pending steps
1. Wire reusable private report UX into server-driven persona profile and secure authenticated transport; preserve quote/AI-seat authority untouched.
2. Add success/negative/error/retry/widget/route regression tests; confirm Postgres idempotence and auth requirements from canonical service.
3. Review source gaps and record complete Work handoff with exact post-commit SHA, deferred executable checks, source status and risk; leave PR draft/unmerged.
