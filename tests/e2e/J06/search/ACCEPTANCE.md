# C26 / J06 — unified public discovery source acceptance

Source under L-FEED C26, consumer and PG route read only. The four facets reuse
approved Masana character revisions, published professional Rooms, published
Masana-authored Feed posts and admin-approved verified external videos. No second
search index, human discovery, worker queue or migrations are required.

## AF00 protected composition
Register createPostgresSearchStore(pool) behind registerSearchRoutes(app, {
  store, resolveReader: canonical optional session resolver, enabled:
  default-off canonical search flag
}) at exactly one Gateway composition seam. The resolver must reject invalid
bearer tokens, resolve guest tenant from trusted configuration and never accept
tenantId from query or headers. Mount SearchScreen below Home C20 and pass
the existing Dio/auth session and precise kind→destination callbacks. Do not
edit shared router, worker main, package lock, or CI from this feature PR.

## Test steps (not proof until run)
1. pnpm --filter @masanawa/gateway-service typecheck
2. pnpm exec vitest run services/gateway/src/modules/search/routes.test.ts adapters/storage/postgres/src/search/index.test.ts
3. Disposable PostgreSQL 18 fresh+upgrade migrations. Seed two tenants with
   approved/unapproved characters, published/draft/paid Rooms, hidden/published
   posts and verified/unverified external videos. Assert no cross-tenant or
   unpublished row at all four facets. Check EXPLAIN and timeouts.
4. cd apps/mobile && flutter analyze && flutter test test/features/search
5. Android low-RAM device: guest, signed in, offline/retry, query replacement,
   cursor pagination, tenant/session switch, Hausa and 200% text scale.
6. Full route-table /v1/search, old human-search route=410, feature flag off=503;
   release remains blocked until pinned-SHA provider/device/restore evidence.

The search aggregate is a read-only projection: upstream feed moderation,
Room teaching queues and approved-video sync workers remain authoritative.
