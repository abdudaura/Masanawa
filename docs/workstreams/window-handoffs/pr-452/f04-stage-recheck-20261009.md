# F04 — reject stale AI Talk stage context after live/safety revocation

**Date:** 2026-10-09. **Status:** PARTIAL_IMPLEMENTATION for F04/R04/R09/R10; this bounded R09 PostgreSQL authorization-race fix is SOURCE_WRITTEN / TESTS_AUTHORED, **not end-to-end verified**. Draft/unmerged original PR [#452](https://github.com/Baatiku/masanawa/pull/452). No production modification, merge, branch deletion, credentials or payment activation.

## Immutable source and claim

- Main baseline observed before claim: `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Continued existing #452 branch: `work/r09-moderated-comments-stage-20261008`, prior HEAD `7a6a5092f14f7f1fb43f954d3c855dd473182db3`.
- Code checkpoint: `9e9dca1ecbf7756d0351178195113c5146b8d4d0`; tests checkpoint: `b4bdf04928a39ad5ae655b19914ed7b667dc63fa`. The draft PR metadata is updated with the post-handoff HEAD, rather than attempting a circular self-referencing commit SHA.
- [Five-minute exact-path issue #551](https://github.com/Baatiku/masanawa/issues/551), created 2026-10-09T01:42:57Z. Previous R09 workstream claim last timestamp 2026-10-08; reviewed and continued its *same* draft branch, without creating a second R09 service/PR.
- Exact source owned:
  1. `services/gateway/src/talk_ai_worker/postgres_stage_repository.ts`
  2. `services/gateway/src/talk_ai_worker/postgres_stage_repository.test.ts`
  3. `docs/workstreams/f04-stage-recheck-20261009.md` (handoff)
- Compare original #452 HEAD to test checkpoint: two modified paths, 24/7 production lines added/deleted and 43/4 test lines added/deleted. No unrelated code moved.

## Actual behavior

**Before:** a one-time `talks.talks` state/visibility check preceded seven parallel bounded reads (Seats, departures, reactions, hands, questions, polls, explicitly moderated comments). If the Host ended/restricted the Talk while those reads were pending, the repository could still hand stale public context to the AI-worker. A Host change could also invalidate the safety block predicates used during audience reads.

**After:** the same tenant+Talk-limited live/reconnecting and safety-enforcement SQL predicate runs **again after** parallel data gathering, before returning any AI stage snapshot. The final row must exist and carry a valid, unchanged authoritative `host_user_id`; otherwise return `null` (no stage context). A PostgreSQL error on reauthorization propagates (fail closed). Topic and Host display fields come from the final authorized row. Existing explicit moderated-comment, anti-host-block, 10-minute bounded projection and nonfinancial-event restrictions remain intact. Adds one indexed Talk gate SQL read per stage context request, requiring performance measurement on real PG.

**Test source added:** normal read expects 9 calls instead of 8; missing/nonlive Talk still rejects before audience queries. New negative tests cover live Talk revoked during data reads, changed Host identity and final SQL authorization failure. Original other context/moderation tests remain.

## Evidence vs unverified

- **EXECUTED, readback/static only:** fetched committed production/test blobs from GitHub; 12/12 structural checks passed on gate predicate reuse, final recheck ordering, Host mismatch, fail-closed return, current-row metadata, negative test presence, prior moderation and no finance SQL. Compare from old #452 HEAD showed exactly two changed source/test paths. These checks **do not execute the TypeScript module or its Vitest tests.**
- **ENVIRONMENT BLOCKER:** this environment has Node 22.16 but no checked-out private repo and direct `git ls-remote` failed with `Could not resolve host: github.com`; no pnpm/Flutter and no reachable configured PostgreSQL/LiveKit/Gemini device proof. **Zero Vitest/TypeScript/Postgres/Flutter tests executed in this window.**
- **CI:** [Foundation CI run 37871176936](https://github.com/Baatiku/masanawa/actions/runs/37871176936) on `b4bdf04928a39ad5ae655b19914ed7b667dc63fa` concluded failure. Job response reports `steps: null` (no executable job steps evidenced), so this is **not** a passing or failing code-test assertion; Actions incident #457 remains owner/Work responsibility.
- **Must run on equipped, authorized integration checkout:** `pnpm exec vitest run services/gateway/src/talk_ai_worker/postgres_stage_repository.test.ts services/gateway/src/talk_ai_worker/event_context.test.ts`, `pnpm --filter @masanawa/gateway-service typecheck`, full Talk/AI Gateway tests; test with disposable PG18 that (1) a Talk flips ended/restricted mid-read, (2) Host changes, (3) a saved approved comment becomes restricted, (4) same-tenant vs cross-tenant controls, and (5) DB error, plus multi-node race under production worker paths.
- **End-to-end still BLOCKED:** no actual Gemini/LiveKit stage audio, two-device Host/Twin, real gift ledger settlement/Host commerce, response latency, Flutter interaction, account revocation/restart/replay, DB or provider acceptance proven.

## Canonical contracts, integration ownership and risks

- Requirements: F04 recovers R04 Host invite/AI Seat lifecycle, R09 bounded consented stage, R10 gift economy; owner trace Talk requirements T05/T07 and Talk/public communication journeys J05/J11. This checkpoint fixes one R09 data disclosure race; **F04 as a whole remains PARTIAL**.
- Existing original drafts stay intact: #433 Create Talk intent and owned Twin, #452 (this code), #459 authoritative Python LiveKit stage context, #471/#484 R10 mobile gift retry, #497 shared composition. No schema, Gateway app/main composer, model tooling privilege, financial wallet/ledger, Firebase, mobile root router or migration changed.
- **Not an immutable authorization lease:** an ended Talk reactivated before final recheck, a changed moderation/actor-block decision after an individual parallel query, or a revocation after the final read may still race. A transactional snapshot/epoch/Host session token, per-event authorization, producer-level final admission and real worker downstream cancellation remain necessary. The final query only narrows the existing exploitable async window.
- F04 integration owner must verify canonical Talk lifecycle, settlement and python worker reads, schedule true R09/R10 public-event publication, and combine with C02/F12/Work only after ownership review.
- Preserve exact five tabs Talks · Chats · Assistant · Wallet · Agents; this backend read change does not add a screen. For a Host ending/restricting the Talk mid-turn, no stale audience context should be supplied; the worker must handle `null` without fabricating fresh events or charging for authorization-denied actions. UI warning/retry paths and real two-device behavior remain to be tested.
- **NO-GO:** merge, deploy, production migration, enabling gifts, claiming R04/R09/R10/F04 complete, or calling this VERIFIED_E2E based on source readback/zero-step CI.

**Last handoff written:** 2026-10-09T01:45:12.756Z.
