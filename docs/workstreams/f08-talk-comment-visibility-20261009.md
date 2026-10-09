# F08/R15 — Authorized Talk comment visibility and count parity

**Updated:** 2026-10-09 UTC. **Window:** autonomous F08 safety-recovery.  
**Status:** IMPLEMENTED_UNVERIFIED **only for this bounded Talk-comment read slice**; overall F08/R15 remains PARTIAL_IMPLEMENTATION. **DRAFT / UNMERGED / NOT DEPLOYED.**

## Exact claim, lineage and lease
- Original latest `main` at claim: `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Branch: `work/f08-talk-comment-visibility-20261009-gpt6`; PR: https://github.com/Baatiku/masanawa/pull/548 (draft).
- Claim commit `398b9eb41a5d59c7f703a85aea4b1c6c5de56aea`; latest **source+tests** commit before this handoff: `1b3b7bdc3c95681400459b4b6eeb34e2b5bb4514`. PR head after this handoff commit is the canonical final branch SHA (also linked in PR body).
- Exact owned paths:
  - `services/gateway/src/talks/model.ts`
  - `services/gateway/src/talks/service.ts`
  - `services/gateway/src/talks/postgres_repository.ts`
  - `services/gateway/src/talks/postgres_repository.test.ts`
  - `services/gateway/src/talks/comment_visibility.test.ts`
  - `docs/workstreams/f08-talk-comment-visibility-20261009.md`
- Five-minute lease acquired via this repository-visible branch claim / draft PR before source changes. All activity limited to those paths. The lease expires after five minutes without repository-visible activity; no permanent reservation asserted.
- Requirement/acceptance: **F08, R15, safety/moderation/privacy across Talks, J05/J11**, parent Talk access and member privacy. This is not a replacement for full release acceptance.

## Existing source audited and defect
Main's authenticated Talk detail performed `getTalk` with viewer authority, then `listComments` filtered **only by tenant and Talk**. This exposed platform-restricted or blocked public comments, including from a viewer-blocked/muted author. Feed/detail `comment_count` read all comments, so moderation-restricted activity still influenced public counts/Explore rank.

## Committed behavior
1. The repository's `listComments` contract requires a viewer ID, sourced **only from** `TalkAuthorizer.authorize(...)`; no client-supplied ID and no new public endpoint.
2. A single canonical SQL predicate filters (a) restricted/blocked `target_kind='comment'` `talks.safety_enforcement` rows by tenant + exact comment ID; (b) any author the authenticated viewer has blocked **or muted**; (c) an author who blocked the viewer. Absence of a restrictive row preserves allowed comments.
3. The **same** predicate constrains public Explore/Live feed comment counts and Talk detail count, avoiding exposed restricted-comment totals and skewed comment-based ranking. Explicit tenant/Talk binds remain, with deterministic 200-comment ordered limit.
4. Existing Fastify `/talks/:talkId` route, account-session authority, live/replay policy, mobile Talk detail UI, and historical comment writes continue to use their canonical service. No change to public content policy, global routing, finance, Firebase, migration, actor roles, provider credentials, or production.
5. Parent Talk access must still be checked by `getTalk`; `listComments` is deliberately an internal repository method, not another externally callable route.

## Regression source committed
- New `talks/comment_visibility.test.ts` with 3 service regressions: authenticated tenant/user binding to parent and comments, parent inaccessible => no comment query, auth failure => no DB read.
- Added 2 `talks/postgres_repository.test.ts` cases verifying SQL uses tenant/exact comment enforcement and both directions of user preference, verified `$3` bind, consistent feed/detail filtered counts, deterministic ordering/pagination.
- **Executed here:** GitHub branch readback and **11/11** independent static invariants passed (verified viewer binding; required contract; both count sites; shared body filter; moderation target/tenant; mute+block; reciprocal block; positional binds; test presence; no untrusted viewer source). These are source inspections, **not TypeScript/Vitest or PostgreSQL test passes**.
- **Not executed:** `pnpm install --frozen-lockfile`, `pnpm exec vitest run services/gateway/src/talks/comment_visibility.test.ts services/gateway/src/talks/postgres_repository.test.ts services/gateway/src/talk_routes.test.ts`, `pnpm --filter @masanawa/gateway-service typecheck`, complete Gateway test/build, disposable PostgreSQL integration, Flutter analyze/test, two-device Android. Container has neither an authenticated repo clone (GitHub DNS fails) nor project-installed dependencies, and no real disposable PG database/handsets/providers were provided.
- GitHub **Foundation CI** run https://github.com/Baatiku/masanawa/actions/runs/37868498278 reported failure for source/tests SHA `1b3b7bd...`, **zero job steps** in job `113620834996` (no runtime test verdict). Combined status also reports Vercel failure with `upgradeToPro=build-rate-limit`. Shared CI #457 remains a separate capacity/runners issue, not evidence the code failed or passed.

## Collisions and integration requirements
- **Existing R15 PR #450** touches `talks/postgres_repository.ts` for reciprocal Host-level block and safety-restricted replay visibility and comment writes. Its exact patch was reviewed; this F08 change is **different** (per-comment read and counts). At Work integration preserve #450's additional SQL clauses while adding this predicate, then rerun both suites at the integrated SHA. Do not merge #548 independently without that semantic review.
- R09 #452 controls **AI stage** approved comment projection, separate from this user-visible REST response. Do not mistakenly adopt all comments into the AI prompt.
- Related #497 Work, #493 five-tab shell, #461 Firebase, C01/C02 contact/DM, and financial branches remain unchanged and unmerged. Parent safety policy can still change between the preliminary Talk detail query and comment query; a future transaction/policy recheck or single read is needed for strict atomic authorization. An already fetched response cannot be retroactively revoked.
- Reviewer should verify that platform enforcement `comment` target uses the canonical comment ID and that all customers have the same tenant-scoped `safety_preferences` semantics (blocked/muted). A real PostgreSQL test of privileged user, tenant mismatch, hidden comment, viewer block/mute, author block, concurrent moderation and unpublish is required.

## Next exact steps (before merge)
1. Fetch this PR and #450 against a fresh main. Semantically preserve both sets of SQL filters; preserve #450 replay enforcement with this viewer-specific comment predicate. Re-evaluate SQL query plans/indexes for active Talks with many comments.
2. Run focused Vitest + full Gateway typecheck/build and real disposable PostgreSQL tests. Test genuine two-account block/unblock, platform-restricted comments, tenant cross-read denial, feed/comment count parity, and concurrent policy change.
3. Run existing Flutter Talk detail and feed tests against composed authenticated Gateway API; Android A/B account switches and replay publication revocation. Confirm no cached restricted comments remain visible after server/feature refresh; client cache invalidation may require an independently owned follow-on if a stale snapshot can persist.
4. Resolve CI #457 and Vercel rate-limit build separately; require actual step logs. Run R15 safety acceptance + J05/J11 before release, never assume this slice qualifies whole F08.
5. Keep **draft/unmerged** until evidence; do not modify production or enable financial/provider activity.

## Release evidence
| Gate | State |
| --- | --- |
| Source written / regression cases committed | YES |
| Static source readback | YES (11/11 narrowly checked) |
| Local Vitest / TypeScript | NOT EXECUTED |
| CI executed application steps | NO (zero steps) |
| Real PostgreSQL auth/moderation | NOT EXECUTED |
| Flutter UI composed to released Gateway | NOT VERIFIED |
| Android physical devices / replay | NOT VERIFIED |
| Provider / production deploy | NOT APPLICABLE / NOT DONE |
| Merged | NO |

**Rollback:** independent code-only PR; no migration/data operation. Revert only after preserving the privacy regression and #450 semantics. Unknown real SQL performance and existing mobile caching require qualification before shipping.
