# AF00 J06/J07/J08/C38/C10 backend composition — 2026-10-13

## SHA-pinned source transfer
- Starting verified `main`: `875654e90a192b82dcdaab05f1fb2b4e07e93202`.
- Status: source from #674 merge `523b1511ebff58ce10d5e90cb2478680970e0d2b` and #676 merge `007e5df53ab2bbc9c82df30fc18e61f9e141e5aa`.
- Rooms: source from #625, #655 head `9336d66d3a783922cef8d862ea784cff5c7b8c7a` including bookmarks, discussions and membership. Recovered only feature-owned trees; **no stale Flutter shell**.
- C10: inbox and signed fan preferences from #641, latest patches retained through the recovered Status tree. J03 journal remains authoritative.
- Exclusive ownership registry `factory/claims` claim `af00-j06-j07-c10-20261013`; authorized bounded transfer per PR #616 comment 6139065553. Prior AF05 Android/audio and financial owners retained.
- Source recovery: `1481305f3f8963b33ef462188361ba67c9666d01`.
- Workspace and migration registration: `b6e009feab11032ab0cd276be7beef983d8adad4`.
- Gateway integration: `298ce543650343a83a090a08db32cb434059ce2f`, media compatibility `84534e3cc9ed6934f23b80203ea64d374a5da7e1`.

## Single authority & feature state
- Existing `createGatewayApp` and `startGatewayService` preserved. Incoming/group/Calls, audio, current tabs and financial registrations are unchanged; no old root copied.
- One existing `PlatformSessionRepository` resolves tenant/fan. Reject foreign tenant, do not trust tenant/role headers. Rooms carry no staff grants by default. Rooms paid validation remains anchored to the one Room PG membership and verified entitlement repository.
- One existing shared PG pool backs Status, Rooms and C10. No second session, transcript, events, publisher, entitlement or payment authority.
- `MASANAWA_STATUS_BACKEND_ENABLED`, `MASANAWA_ROOMS_BACKEND_ENABLED`, `MASANAWA_CHATS_INBOX_ENABLED` require the exact literal `true`. Default off. Media signing cannot be enabled without an explicitly configured canonical origin and object store.
- Moderator/editor, Room membership invites and Play purchase/RTDN paths remain gated. Do not activate providers or paid operations.
- PostgreSQL schema roots: existing foundation and agent/identity/commerce/talks plus `masana`, `feed`, `rooms`; independent numbered SQL. Apply in dependency order, retain checksums; no existing financial table replacement.

## Verification truth & next gates
- **Source:** committed and pushed. Auth/session, schema and workspace manifests composed.
- **Unit/negative tests:** original feature tests and `services/gateway/src/modules/masana_chat/af00_composition.test.ts` authored, **NOT RUN** before GitHub-hosted CI.
- **TypeScript, Vitest, PG18 fresh + forward upgrade, Flutter/UI, Android APK, providers:** **NOT RUN/UNVERIFIED** until genuine runner output. Historical broad TS2459 and Dart diagnostics are not newly introduced proof.
- Before a safe merge: run relevant gateway/worker/postgres/package TypeScript and Vitest, migration on disposable PG18 from fresh and upgrade, compare lockfile frozen installation; review current diff for runtime correctness and duplicate routes.
- Before production: inspect all auto-deployment triggers, signed-media S3, staff roles, worker outbox lease/dedupe, Android/physical device, migrations, rollback, backup restoration, real read/like/pin/member journeys. Keep automatic migrations away from production until qualified.
- Remaining separate workstreams: AF01 MSN/crypto funding and quotes; AF08 transport credential fencing; MUI09 combined regression; MUI10 signed installed identity; AF11 real-device/voice qualification.
