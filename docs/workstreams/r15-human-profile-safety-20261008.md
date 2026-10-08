# R15 — Public human profile safety controls
Updated (UTC): 2026-10-08T11:54:54.839Z; owner/window: GPT-6, human-profile-safety
Status: PARTIAL_IMPLEMENTATION (claim only; no feature complete)
Base main SHA: 1d6a67ea3c182455b55a7d1d07eacdb4311682e3
Branch: work/r15-human-profile-safety-20261008-gpt6; PR: pending draft
Five-minute lease: this commit / its subsequent source commits; recheck activity before reclaim.
Owned planned paths: apps/mobile/lib/src/screens/profile/person_profile_screen.dart; apps/mobile/lib/src/screens/profile/human_profile_safety_sheet.dart; apps/mobile/lib/src/screens/profile/human_profile_safety_transport.dart; apps/mobile/test/human_profile_safety_test.dart; services/gateway/src/talk_safety/service.ts; services/gateway/src/talk_safety/human_profile_report.test.ts; this handoff. No edits to shared root router/app.ts/main.ts/migrations.
Scope: verified-session human public profile block/mute with authoritative server readback and safe report (existing safety tables + registered API). R15, T05/N05, J03/J10/J11, app shell five-tab constraint.
Known conflicts reviewed: PR #489/#491 target AI persona profile and shared talk_safety.dart/transport; this branch avoids those paths. PR #443 touches talk_safety/repository.ts; avoid. R18 #435 profile edit, C01 #468 gateway composer untouched.
Database: reuse packages/talks/migrations/0009_talk_safety.sql, existing safety_preferences/safety_reports. No new migration where none required.
CI/test environment: #457 exhausted Actions quota; local checkout git clone DNS unavailable; commands not executed. Never claim PASS. Next: finish owned source/test, update this checkpoint, open DRAFT PR and verify branch HEAD.
