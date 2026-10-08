# U30 — Unified public discovery, SHA-specific Work handoff

**Updated (UTC): 2026-10-08T17:51Z–ongoing session. Window label: U30 isolated public discovery.**
**STATUS: PARTIAL_IMPLEMENTATION / UNVERIFIED — DRAFT / UNMERGED — NOT DONE, NOT DEPLOYED.**
The source exists only on this branch until a qualified integrator safely composes it.

## Ownership, immutable source and lease

- **Repository:** `Baatiku/masanawa`. **Base main SHA:** `5e758673ae91082520b21b3153da53791ae2cbf3`; main last re-audit.
- **Branch:** `work/u30-public-discovery-20261008-isolated` (created from above exact main).
- **Last substantive feature-source checkpoint SHA:** `0cc6ca35d027fcd48db0c345db7c4f29b623c483`. This handoff update is a subsequent metadata-only commit; resolve actual PR head and compare to this checkpoint before testing.
- **Initial 5-minute repository-visible claim:** `docs/workstreams/u30-unified-public-discovery-20261008.md`, committed at `0ad66122d9d63903f3f98f7a16e3a1cff8261f09`. Same branch refreshed by successive source commits. Exact owned roots: `services/gateway/src/unified_discovery/**`, `apps/mobile/lib/src/unified_discovery/**`, `apps/mobile/test/unified_discovery_*.dart`, this handoff. **No changes** to shared `services/gateway/src/app.ts`, `main.ts`, existing `talk_search/**`, SQL/migration registry, financial ledger, Flutter router/five tabs, `pubspec.yaml`, native Firebase, CI or credentials.
- **Ownership check:** 62 open PRs on snapshot. U21 #508 / U22 #509 already draft; U23 `work/u23-safe-invite-share-20261008-gpt6` and U24 `work/u24-message-requests-privacy-20261008-gpt6` already claimed and avoided. No U30 branch/PR existed at claim. U01–U20 retained. Do not reuse this exact path until claim/HEAD refreshed. R/C/F work belongs to original owners.
- **Requirement:** U30 public Talks, People, Experts, published Twins, safe visibility and route; five-tab architecture Talks · Chats · Assistant · Wallet · Agents. No private DM search. Related old `talk_search`, R15 safety, R17/C08/F12 routing, R18 public profiles, U21 contacts. Public discovery must not create a DM/send, AI-only public Talk, automatic Seat payment or cross-account profile disclosure.

## Code written and how it reuses canonical authority

| Layer | Committed source | Actual responsibility |
| --- | --- | --- |
| Postgres/identity | **No new migration/table**; reuses main's `services/gateway/src/talk_search/postgres_repository.ts` and `TalkSearchService` | Existing tenant-scoped indexed public profiles, approved Experts, published Twins, Talk state and `talks.safety_enforcement`; no second directory, new contacts table or wallet authority |
| Backend service | `services/gateway/src/unified_discovery/service.ts` | Calls canonical `TalkSearchService.search` with the bearer token for auth; validates query/filter/offset/limit, projects typed Talk/Person/Expert/Twin results and safe AI labels; live-only projection; deterministic section order; bounded 50-record canonical source window, ≤20 per page, saturation marker |
| API | `services/gateway/src/unified_discovery/routes.ts` | Typed Fastify `GET /discovery/public` schema, required query and strictly permitted filters; **route is intentionally not registered in current shared app.ts** |
| Flutter DTO/transport | `apps/mobile/lib/src/unified_discovery/public_discovery_models.dart`, `public_discovery_transport.dart` | Refuses invalid types/unsafe ID paths, strict parsing, HTTPS avatar guard, signed-in API client, no 404-as-empty fallback, auth-backed paginated read |
| Flutter state | `apps/mobile/lib/src/unified_discovery/public_discovery_controller.dart` | Per-account owner fencing, latest-query wins, logout/dispose stale-response discard, search/page retry without erasing displayed rows on uncertain pagination failure; memory-only records |
| Flutter UX | `apps/mobile/lib/src/unified_discovery/public_discovery_screen.dart` | Nested screen, name/keyword search, five kinds with filters, Live now only, accessible text/tap, avatar and AI disclosure, no sixth root/paid Seat, typed callback to host router, empty/error/refresh/load-more states |
| Tests (auth/security/API) | `services/gateway/src/unified_discovery/routes.test.ts` | Injected Fastify and canonical search adapter auth 401, typed results/ranking, live-only truthfulness, bounded/invalid inputs, saturated group behavior |
| Tests (device-facing source) | `apps/mobile/test/unified_discovery_screen_test.dart`, `unified_discovery_transport_test.dart` | DTO path injection/unknown kinds, request token/filters, no signed-out network, 404 not false-empty, query/account race, pagination uncertain failure, signed-in typed route navigation and account-switch purging |

**No standalone schedule/notification, OS Contacts permission or phonebook network lookup.** No production money operation or migration.

## Known missing implementable source (real release blocker)

1. **Shared Gateway composition is absent on this branch by ownership design.** The single Gateway/F12/Work composer must import `registerUnifiedDiscoveryRoutes` and `createUnifiedDiscoveryService` in `services/gateway/src/app.ts` and register only when existing canonical `options.talkSearch` is available, reusing the existing `main.ts` TalkSearchRepository + `customerSessions` authorizer. This must be done *after* reviewing shared competing PRs. Until then this API returns 404 on running Gateway.
2. **Flutter route / dependency injection is absent by protected F12 R17/C08 ownership.** F12 should mount `PublicDiscoveryScreen` as a nested existing tab action with `GatewayPublicDiscoveryTransport(ref.read(apiClientProvider))`, current signed-in ownerId / session guard and typed `openRoute` mapping, not a sixth root. Preserve old /search and /chat aliases; no new authorizer or second AI chat.
3. **True scalable DB pagination, language/topic filters, server-side Live filter and query rate/anti-enumeration protection need canonical `talk_search/**` / SQL owner review.** This isolated slice only pages the first **50** canonical ranked candidates (all mixed type budget: 17/17/16). `searchWindowSaturated` flags potential omissions and the UI asks users to refine, not falsely claims exhaustive results. No unsupported filter exposed as authoritative. Do not relax visibility SQL or run a full-table scan to satisfy pagination.
4. **C01/F14 private discoverability and R15 reciprocal block/deleted-user safety must be cross-checked against final integrated main.** Existing `TalkSearchRepository` protects tenant, safety-enforced public profiles, approved Experts/published Twins, but C01 #468 is draft and may add additional person visibility/blocks. Do not launch U30 until current-account, hidden/deleted/blocked safety verified using actual Postgres and two customer accounts.
5. **Language and locale-specific topics, relevance/ranking as user-facing exhaustive features remain unimplemented** pending source and owner review; this is one reason for PARTIAL_IMPLEMENTATION, not IMPLEMENTED_UNVERIFIED.

## Verification: actually executed vs NOT executed

- **Executed:** GitHub connector source reads, repository ownership/PR/branch inventory, committed file writes and `compare_commits` against exact base. Last comparison before handoff: branch ahead by 20 feature commits, behind 0, ten new paths including handoff, no existing source edits. This verifies pushed Git objects **only**, not build or running behavior. No production app, DB, provider, voice, release or server work performed.
- **Not executed — SDKs/dependencies/real environment unavailable to this GitHub-connector window:** 
  - `pnpm install --frozen-lockfile`
  - `pnpm --filter @masanawa/gateway-service typecheck` and `pnpm exec vitest run services/gateway/src/unified_discovery/routes.test.ts` (verify appropriate workspace command)
  - `cd apps/mobile && flutter pub get && flutter analyze lib/src/unified_discovery test/unified_discovery_screen_test.dart test/unified_discovery_transport_test.dart`
  - `cd apps/mobile && flutter test test/unified_discovery_screen_test.dart test/unified_discovery_transport_test.dart`
  - After shared route composition: run Gateway integration/negative tests with disposable PG18 and full schema (NOT demo bootstrap), authentic tenant A/B profiles, blocked/hidden/deleted person, Expert approval, Twin publication, live Talk safety enforcement, paging/rank, expired auth and burst/rate test.
  - After F12 mount: install signed Android staging build; check small-device/RTL/screen-reader/search, logout/switch/restart/low-data, open actual /talk/:id /u/:handle /persona/:publicId, forbidden private message route and correct prior tab/back/drafts.
- **GitHub Actions issue #457** already documents runner/Actions quota issue. No CI run attempted here; zero-step workflows must never be labeled passing or failing code. No fabricated test counts or database/device evidence. Shared Work may also see unrelated main analyzer/typecheck failures; distinguish baseline from new U30 errors by SHA and path.

## Privacy, risk and rollback

- **Tenant/auth:** search delegation always invokes canonical authenticated TalkSearchService; never substitutes a local fake result, no unauthenticated background indexing. Person handle is a public profile reference, **not** C01 permission to DM. Profile/Twin/Talk availability must be reauthorized by destination API on open.
- **Data:** pure read projection of existing tenant-scoped SQL; no new tables, finance or migrations, zero production data modifications. Mobile search results are in-memory only, fenced on owner switch; never upload phonebook or private chat.
- **Uncertainty:** 404 endpoint is unavailable, not zero eligible items; paged read can be retried, preserving prior items; bounded source warns on saturation. A tab may navigate to an item gone/blocked after search; destination MUST recheck and return 403/404 safely.
- **Security unfinished:** existing public SQL must be audited for final C01 hidden/block/disabled accounts and query abuse; new route must share full existing middleware/rate policies. Endpoint cannot be released from draft in current shape.
- **Rollback:** no migration, safe to remove composed route/UI if verified staging fails. Do not modify committed five-tab router, native Firebase files, secrets, customer ledgers, financial flags or deploy.

## Dependency and final Work actions (explicit order)

1. Inventory current main and all draft claims/PR changes; recheck `talk_search/postgres_repository.ts`, C01 #468, R15 #494 and F12 #493 / Work #497. Ensure existing R18/Contacts safety policies and approved Twin discoverability are enforced. Preserve all canonical source.
2. Run TS/Flutter isolated tests above on this exact feature commit or new merge SHA; fix **new** errors without suppressing existing unrelated warnings. No green assumption without logs.
3. Under a single shared Gateway composer lease, wire optional `createUnifiedDiscoveryService(options.talkSearch)` in `app.ts` (using canonical auth already in `main.ts`); run real Fastify injection + DB user A/B/block/hidden tests. Add SQL keyset paging + search abuse protection in canonical authority if required, not duplicate SQL in `unified_discovery`.
4. Under F12 sole router lease, inject the current session and mount nested discovery UI without sixth tab, revalidate typing/tap/voice feature parity if integrated via Assistant, keep destination API reauthorization and legacy aliases.
5. Execute staging Android plus PG18 and security negative cases, date/version logs, performance with 10k real public fixtures, permission/rate and account-switch tests; verify CI #457 recovery separately.
6. Only after tests and actual integrated five-tab functionality pass may an authorized integrator merge. Keep draft/unmerged if any E2E or privacy/rate gate fails.

## Release gates at this SHA

| Gate | Status |
| --- | --- |
| SOURCE_WRITTEN | YES, isolated source/test files |
| LOCAL_TESTED | NO |
| CI_EXECUTED | NO (shared #457) |
| DB_INTEGRATED | NO (canonical SQL reviewed, real DB not tested) |
| APP_INTEGRATED | NO (shared routing intentionally deferred) |
| DEVICE_VERIFIED | NO |
| PROVIDER_QUALIFIED | N/A (read-only public discovery, no third-party provider) |
| DEPLOYED | NO |
| MERGED | NO |

**This is not E2E accepted or production-safe yet. Commit SHA in PR metadata is the latest branch HEAD; feature checkpoint SHA above remains immutable.**
