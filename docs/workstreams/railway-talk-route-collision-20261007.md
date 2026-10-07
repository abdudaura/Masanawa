# Railway gateway startup repair — 2026-10-07

Owner: current ChatGPT Railway/APK repair window
Branch: `fix/railway-talk-route-collision-20261007`
Base SHA: `f14e6d55f05449aefa93b214bd270fb1e4da5c4c`
Last update: 2026-10-07T16:21:00Z
Status: active, diagnosing and repairing startup failure.

## Owned paths

- services/gateway/src/app.ts: bounded replay/library route composition only
- services/gateway/src/talk_replay_routes.ts
- services/gateway/src/talk_library_composition.test.ts
- this claim file

## Evidence and scope

Railway deployment a6db2add-c203-4aa7-9434-883bfc398b66 crashes with `Method 'GET' already declared for route '/me/talks'`. Replay and library modules both register that route. Preserve replay-only compatibility and use the canonical library when both modules are composed. Add regression coverage for both configurations. No credential, migration, consumer direction or unrelated feature changes.

User explicitly requested Railway log inspection, fixes, and a compiled APK. Mobile Build CI currently fails before runner allocation (runner_id 0, steps empty); local SDK/build availability is being checked.
