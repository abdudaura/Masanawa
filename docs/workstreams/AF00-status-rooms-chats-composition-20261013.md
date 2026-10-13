# AF00 Rooms/C10 runtime composition — 2026-10-13

## Source identity and customer effect

Starting exact main: `c64994837d3a1a19bd065f94c241178aa512e53d` (includes #699 approved Videos, #701 startup and #702 J06 Status/video backend).
Reconciled older AF00 #700 source head `99624b46a27448801f649a321fac15f5f31f2496` instead of wholesale merging divergent Status or Calls modules. Narrow exact-path claim `af00-rooms-c10-runtime-20261013-gpt6-continue` on `factory/claims`. Source merge/verification receipts must be appended by the integrator.

- One existing PostgreSQL pool and platform bearer session fence compose persistent Rooms discovery, join, questions, lessons, discussion, bookmarks and the C10 list/pin/read API; no parallel messages store, auth, billing or second server.
- Shared `app.ts` registrar preserves current J06 Status and official video app setup, current five tabs, native/group/incoming Calls and financial source. Staff Room writes have no inferred staff privileges. Paid subscription/membership invite endpoints stay disabled.
- `MASANAWA_ROOMS_BACKEND_ENABLED` and `MASANAWA_CHATS_INBOX_ENABLED` must be explicitly true; default false. C10 disabled calls respond 503 before any actor resolution/PG call. Canonical C10 remote Chats Dio search was subsequently merged in PR #706 (server remains default-OFF); full MUI-03 real two-account/PG/device qualification remains open.
- PostgreSQL migration runner uses registered owner-root dependency order rather than alphabetical owner sorting. Do not modify existing numbered SQL or migrate production without PostgreSQL18 fresh/upgrade/checksum qualification.

## Evidence and remaining

Source implementation and route/schema test tree verified at `37ff01b8c3612a3002faad2966f37bef3ede754c` in PR #704 after repairing a proven missing Postgres workspace importer and restoring explicit cross-root order `masana → external-videos → feed → rooms`. No numbered SQL changed. The final handoff-only commit leaves these tested code blobs unchanged.

**Executed hosted evidence at the source SHA:** [Status Video Integration run #38359483451](https://github.com/weavewellindustrieslimited/masanawa/actions/runs/38359483451) used Node 24, pnpm 12.8.2, real PostgreSQL 18.6 service, frozen workspace install and `pnpm exec vitest run` on 14 selected Status, Videos, Rooms, C10 and real PG18 migration suites. **14 suites PASS, 62 tests PASS (including fresh/upgrade, schema readiness and second-run idempotence)**. The first two iterations failed for a missing `@masanawa/rooms` workspace dependency and cross-root `feed.saved_videos → external_videos.items` FK ordering respectively; both fixed and rerun. Do not claim running those tests locally.

**Whole-project TypeScript remains FAILED:** same hosted run strict Gateway typecheck reports existing third-party declaration, legacy Talk, call history and test fixture errors (75 diagnostics, none in touched source). [Foundation run #38359483373](https://github.com/weavewellindustrieslimited/masanawa/actions/runs/38359483373) stops at existing `packages/agents/src/talk-replay.test.ts` TS2459. These are not a green build or suppression of failures. Flutter/Dart, device, real tenant/provider and production DB restore checks NOT_RUN. Feature activation flags remain OFF; code merge does not qualify production migrations or customer release.

Remaining: MUI-03 real two-account/PG/device search and full authorized pagination/title matching, AF08 auth-transport refresh fencing, MUI-04 Status/audio/Video device and rights qualification, MUI-06 Rooms real PG and moderated/invite paid gates, AF01 MSN funding/quotedAt, MUI-09 combined regression, MUI-10 signed installed identity, AF11 device/provider proof. No paid/provider activation.

The old #700 draft must not be merged wholesale. Its canonical backend, migration-order, source tests and route registration are covered by #702/#704; the final declared worker dependency and worker regression coverage are recovered below. The two unique #700 artifacts (duplicate CI and unused per-feed PG test helper) are superseded by the current Status Video Integration workflow and reusable `commerce/isolated-test-database.ts` utility, respectively.

## Abandoned PR #700 worker/CI closure — 2026-10-13

- Recovery PR: [#707](https://github.com/weavewellindustrieslimited/masanawa/pull/707), reviewed source checkpoint `2399f3d6366f66bf8bf81b41576c6b214faa850f`, from current main `9b246649077fc77cd9135f4b8c6a79bcd9e440fa`.
- Original #700 head `99624b46a27448801f649a321fac15f5f31f2496` is **divergent** from newer main. Recover unique behavior, never merge that 147-file draft over newer Calls/Chats/Status/Video source. Status/Rooms/C10 backend and PG roots already integrated through #702 and #704; remote C10 client through #706; recorder through #705.
- Missing `@masanawa/rooms` workspace declaration for `services/worker/src/jobs/rooms/*` restored to `services/worker/package.json` and its precise `pnpm-lock.yaml` importer, without altering any dependency versions.
- Extended the existing read-only PostgreSQL 18.6 Status Video Integration workflow to run Rooms/Feed worker job tests and trigger for affected worker paths. Kept job/process/provider execution disabled. No duplicate #700 CI workflow or duplicate isolated PostgreSQL helper transplanted.
- **Executed on exact code SHA**: [hosted workflow 38370100279](https://github.com/weavewellindustrieslimited/masanawa/actions/runs/38370100279), Node 24, pnpm 12.8.2, `pnpm install --frozen-lockfile` **PASS**, 20 Vitest suites **PASS**, 82 tests **PASS**, including real PostgreSQL 18 fresh and forward-upgrade migration suites and worker room/feed negatives.
- First candidate SHA `450f0313849fee8abd707f7c1b6ce332590ba02f` had frozen-lockfile **FAIL** before tests; source was repaired and rerun at `2399f3d6` (do not cite the initial run as passing).
- **Gateway strict TypeScript remains FAIL**: 75 error diagnostics, *byte-for-byte identical* to earlier #704 hosted baseline run 38359483451. The change introduces **0** new Gateway diagnostics. Global Foundation errors remain; no passing whole-project build or production proof claimed.
- Source integration is distinct from release: Room/subscription/teacher worker scheduler wiring, real live two-account authorization, signed-media origins, external providers, moderated publishing rights, Android/device/backup/production migration qualification all remain separately gated. Feature flags OFF; never enable paid operations based on source tests alone.
