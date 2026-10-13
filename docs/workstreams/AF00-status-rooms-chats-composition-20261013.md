# AF00 Rooms/C10 runtime composition — 2026-10-13

## Source identity and customer effect

Starting exact main: `c64994837d3a1a19bd065f94c241178aa512e53d` (includes #699 approved Videos, #701 startup and #702 J06 Status/video backend).
Reconciled older AF00 #700 source head `99624b46a27448801f649a321fac15f5f31f2496` instead of wholesale merging divergent Status or Calls modules. Narrow exact-path claim `af00-rooms-c10-runtime-20261013-gpt6-continue` on `factory/claims`. Source merge/verification receipts must be appended by the integrator.

- One existing PostgreSQL pool and platform bearer session fence compose persistent Rooms discovery, join, questions, lessons, discussion, bookmarks and the C10 list/pin/read API; no parallel messages store, auth, billing or second server.
- Shared `app.ts` registrar preserves current J06 Status and official video app setup, current five tabs, native/group/incoming Calls and financial source. Staff Room writes have no inferred staff privileges. Paid subscription/membership invite endpoints stay disabled.
- `MASANAWA_ROOMS_BACKEND_ENABLED` and `MASANAWA_CHATS_INBOX_ENABLED` must be explicitly true; default false. C10 disabled calls respond 503 before any actor resolution/PG call. The local Chats UI still lacks canonical C10 Dio search; do not claim full MUI-03.
- PostgreSQL migration runner uses registered owner-root dependency order rather than alphabetical owner sorting. Do not modify existing numbered SQL or migrate production without PostgreSQL18 fresh/upgrade/checksum qualification.

## Evidence and remaining

Source implementation and route/schema test tree verified at `37ff01b8c3612a3002faad2966f37bef3ede754c` in PR #704 after repairing a proven missing Postgres workspace importer and restoring explicit cross-root order `masana → external-videos → feed → rooms`. No numbered SQL changed. The final handoff-only commit leaves these tested code blobs unchanged.

**Executed hosted evidence at the source SHA:** [Status Video Integration run #38359483451](https://github.com/weavewellindustrieslimited/masanawa/actions/runs/38359483451) used Node 24, pnpm 12.8.2, real PostgreSQL 18.6 service, frozen workspace install and `pnpm exec vitest run` on 14 selected Status, Videos, Rooms, C10 and real PG18 migration suites. **14 suites PASS, 62 tests PASS (including fresh/upgrade, schema readiness and second-run idempotence)**. The first two iterations failed for a missing `@masanawa/rooms` workspace dependency and cross-root `feed.saved_videos → external_videos.items` FK ordering respectively; both fixed and rerun. Do not claim running those tests locally.

**Whole-project TypeScript remains FAILED:** same hosted run strict Gateway typecheck reports existing third-party declaration, legacy Talk, call history and test fixture errors (75 diagnostics, none in touched source). [Foundation run #38359483373](https://github.com/weavewellindustrieslimited/masanawa/actions/runs/38359483373) stops at existing `packages/agents/src/talk-replay.test.ts` TS2459. These are not a green build or suppression of failures. Flutter/Dart, device, real tenant/provider and production DB restore checks NOT_RUN. Feature activation flags remain OFF; code merge does not qualify production migrations or customer release.

Remaining: MUI-03 server-wide Chats client, full authorized pagination/title matching, AF08 auth-transport refresh fencing, MUI-04 Status/audio/Video device and rights qualification, MUI-06 Rooms real PG and moderated/invite paid gates, AF01 MSN funding/quotedAt, MUI-09 combined regression, MUI-10 signed installed identity, AF11 device/provider proof. No paid/provider activation.

The old #700 draft should not be merged wholesale. Its unique migration-order check and safe composition are recovered here; reconcile any remaining unique test and worker paths before closing it.
