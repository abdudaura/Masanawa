# F09 / R13 — Isolate concurrent replay Egress object writes

**Status:** CLAIMED / IN_PROGRESS; existing draft PR #453; DO NOT MERGE or deploy.
**Claim time:** 2026-10-09, UTC; five-minute lease applies and must be checked before any continuation.
**Main at claim:** `5e758673ae91082520b21b3153da53791ae2cbf3` (read-only refreshed).
**Existing PR:** #453 branch `work/r13-replay-finalize-recovery-20261008`; preserve its existing coordinator, LiveKit, S3, abort CAS, replay authorization and earlier F09 claim work. #503 owns mobile signed playback renewal; #497 owns composition.

## Exactly owned paths
- `services/gateway/src/talk_replay/egress/coordinator.ts`
- `services/gateway/src/talk_replay/egress/coordinator.test.ts`
- `services/gateway/src/talk_replay/egress/verify_attempt_identity.mjs` (new Node 22 dependency-free production-module regression)
- `docs/workstreams/f09-unique-egress-attempt-20261009.md`

**No other file ownership:** no schema/migrations, gateway entrypoints/routes, Flutter router, Firebase, CI, payments, LiveKit/S3 adapters or production.

## Reproduced source risk and intended repair
The existing `start()` checks `media.current`, then starts external Egress, then writes a unique `(tenant,talk,recording)` row; two Gateway processes can both see no row. Both external StartEgress attempts currently target the same deterministic `talk-replays/tenant/talk/recording.ogg` object. The losing DB insert invokes stop+delete for that shared key, risking deletion/corruption of the winning job's object. Use a fresh unpredictable per-attempt object key before calling external Egress; persist that same key and clean up only that attempt's key when the DB rejects it. Preserve canonical scoping and existing API. Add concurrency and retry regressions invoking the real coordinator.

This is a bounded source safety recovery, **not** a durable cross-process start lease, media worker recovery, proof of real S3/LiveKit response, or E2E verification. Follow through with actual tests if available and a SHA-specific handoff; never merge automatically.

## Verified source checkpoint

- Claim committed at `abd75dec733ea4f59477aba3c0964d80b2d279b7` before implementation.
- Production safety change committed at `c376ca4a835660016c8f46bf2089169763bc8043`, exact coordinator blob `fcc29a749d13ae3f5c47bcccfc8aaf55b82853d8`.
- Two additional authored Vitest cases committed at `156a2753d0f27127182f0d82377bc3da6a6957c0` (corrected test syntax at `2d4953d5982626061354aea0983487febf08b53d`). Vitest not executed without dependency checkout.
- Local Node 22.16.0 strip-types test used byte-for-byte copied coordinator, with Git blob SHA-1 independently verified as `fcc29a749d13ae3f5c47bcccfc8aaf55b82853d8`. Four runtime tests **passed, 0 failed**: simultaneous losing insert, retry after failure, existing-media idempotence, and invalid storage-scope rejection. No network/provider calls; fake SQL and Egress adapters; not real DB/provider E2E.
- New exact-path deterministic runner will provide reproducible Node 22 tests even where pnpm/Vitest is unavailable.

### Remaining gates and acknowledged limits

- Full `pnpm exec vitest run services/gateway/src/talk_replay/egress/coordinator.test.ts services/gateway/src/talk_replay/egress/postgres_media_repository.test.ts services/gateway/src/talk_replay/egress/livekit_egress.test.ts` and Gateway `typecheck` on integrated dependency-installable checkout **NOT RUN** (local `pnpm` unavailable; GitHub DNS lookup failed).
- Real PG insert CAS across separate Gateway processes, simultaneous Egress requests against actual LiveKit, S3 object isolation and orphan recovery, Host revoke/recording consent, Android player, production TLS/credentials, Firebase, CI #457 and final Work #497 composition **NOT VERIFIED**.
- The new UUID-suffixed key prevents one losing Start attempt deleting the winning object's key. It does **not** serialize calls to external LiveKit, prevent brief duplicate Egress charges, guarantee stop succeeded after failed persistence, or sweep inaccessible orphan objects. Durable pre-Egress admission lease and reconciler remain F09 follow-up. No database schema, provider config, prod systems or shared-route edits were made.
- Keep **PR #453 DRAFT / UNMERGED** and reconcile with #503/#543/#497 on verified integration SHA.
