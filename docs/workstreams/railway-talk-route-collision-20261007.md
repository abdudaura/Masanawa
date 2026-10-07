# Railway gateway startup repair — 2026-10-07

Owner: current ChatGPT Railway/APK repair window
Branch: `fix/railway-talk-route-collision-20261007`
Base SHA: `f14e6d55f05449aefa93b214bd270fb1e4da5c4c`
Last update: 2026-10-07T16:30:00Z
Status: implementation complete and deployed; gateway route ownership released. APK compilation in progress.

## Owned paths

- services/gateway/src/app.ts: bounded replay/library route composition only
- services/gateway/src/talk_replay_routes.ts
- services/gateway/src/talk_library_composition.test.ts
- this claim file

## Evidence and scope

Railway deployment a6db2add-c203-4aa7-9434-883bfc398b66 crashes with `Method 'GET' already declared for route '/me/talks'`. Replay and library modules both register that route. Preserve replay-only compatibility and use the canonical library when both modules are composed. Add regression coverage for both configurations. No credential, migration, consumer direction or unrelated feature changes.

User explicitly requested Railway log inspection, fixes, and a compiled APK. Mobile Build CI currently fails before runner allocation (runner_id 0, steps empty); local SDK/build availability is being checked.

## Verified repair

PR #399 merged to main commit `bb3f6d204c2e53f21eaf2574311c7c0ef4cbf315`.
Four Fastify/Vitest 5.0.3 regressions passed locally. Re-enabling the duplicate route reproduced the exact Railway failure; restoring the fix passed all four.
Railway deployment `72a32ba2-0ed8-45d2-b001-c8f8eb8fdc9e` succeeded. Runtime log contains `service.started`; `/healthz` returns ok and `/readyz` returns ready with database-schema true. Unauthenticated `/talks` and `/me/talks` return 401 as expected.
Live Talk Presence remains disabled because LIVEKIT_URL/API_KEY/API_SECRET are absent. No credentials invented or auth bypassed.

Mobile source for the APK was materialized from the exact repaired main commit. Flutter 3.47.6 / Dart 3.13.5 and Android SDK 37.0 tooling are available. CI mode is required locally to skip Flutter's automatic Azure metadata probe. Local dependencies/build validation remains in progress; no APK or successful mobile tests claimed yet.
