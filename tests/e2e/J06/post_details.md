# J06 / C22 — Masana post detail, comments and replies

**Source lane:** L-FEED, based on non-deploying `integration/rebuild@557a56a015f43ca16486a4b703ce47a18167cdda`.
This file is an executable acceptance recipe, **not evidence it has run**.

## Precondition
Run PG18 migrations (including additive `packages/feed/migrations/0002_comment_threads.sql`) on disposable fresh and upgraded databases, then register the existing canonical Feed feature behind its flag via AF00. Use at least two tenants, approved/unapproved Masana profiles, fan and guest identities, existing `events.outbox` comment review.

## Journey
1. Staff publishes an approved Masana-only text post. A fan opens it from Home Feed via **Open post**, reads the authoritative `GET /v1/posts/:id`, and sees public comments.
2. Fan switches **Newest / Oldest**, verifying server ordering and stable IDs, then replies to a visible top-level comment. POST has an account-derived fan principal, an idempotency key and `parentId`. Retry uses the same key; readback returns one row with that parent. No human profile/DM navigation.
3. A brand-new fan replies; the row is pending, visible to its author but not other fans. Its existing `events.outbox` event submits to the leased moderation handler, which never auto-approves.
4. Try a cross-tenant, cross-post, pending, hidden or nested parent and a forged `fanId`: no public row or unauthorized data. Invalid sort `422`, guest write `401`, expired identity and feature disabled are denied.
5. Switch accounts while a GET is in flight; no previous account post/comment or pending reply is displayed. Test offline, retry, 404/taken-down post, long text, Hausa labels, keyboard/200% text and low-end Android back navigation.
6. Verify old comments survive the forward-only migration, and the `(tenant_id,post_id,parent_comment_id)` FK rejects cross-post direct writes. Leave financial schemas and legacy media unchanged.

## Evidence to execute / record
- `pnpm typecheck && pnpm test:ci && pnpm build`
- PG18 fresh + restored-upgrade + immutable checksum, and feature integration against a disposable DB
- `cd apps/mobile && flutter pub get && flutter analyze && flutter test`
- `cd apps/admin_mobile && flutter pub get && flutter analyze && flutter test` (reused moderation console)
- Consumer Android APK build + device interaction and release gate only after AF00 composed source

All the above: **NOT_RUN** until an executable pinned-SHA result is linked. No provider calls, production migrations or mobile release are authorized by this recipe.
