# R15 — public persona report flow (live claim / handoff)

Claim date: 2026-10-08 (Africa/Lagos). Owner: this GPT-6 implementation window.
State: CLAIMED / PARTIAL_IMPLEMENTATION until source and tests are written. Five-minute lease: last visible branch activity, recheck before reclamation.
Base main: `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`.
Branch: `work/r15-persona-profile-report-20261008-gpt6`.
Owned exact files: `apps/mobile/lib/src/screens/profile/persona_profile_screen.dart`, new `apps/mobile/lib/src/screens/profile/persona_report_sheet.dart`, `apps/mobile/lib/src/talks/talk_safety.dart`, `apps/mobile/lib/src/talks/talk_safety_http_transport.dart`, and new `apps/mobile/test/persona_report_flow_test.dart`, plus this handoff. No shared Gateway composition, migration, root router, financial authority or CI ownership.

Integration target: existing authenticated `POST /safety/reports` with `targetKind=persona`, `targetId=publicId`; existing `talks.safety_reports` uniqueness on (tenant,reporter,clientRequestId); no duplicate reporting tables or new permissions. R15 / T05 / N05 / J06 / J11. Safe, stable request ID across retries; honest failure/recovery.

Competing R15 PRs #443, #446, #450, #451 target different server files; R18 #435 targets profile **edit** screen; C08 owns shell/navigation. CI #457/#460 owns exhausted GitHub Actions verification. Recheck all changed files before merge.

This initial claim is NOT implementation or test evidence. Final SHA/evidence/blockers to be updated at checkpoint.
