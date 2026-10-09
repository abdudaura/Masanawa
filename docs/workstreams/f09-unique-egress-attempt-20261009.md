# F09 / R13 — Isolate concurrent replay Egress object writes

**Status:** CLAIMED / IN_PROGRESS; existing draft PR #453; DO NOT MERGE or deploy.
**Claim time:** 2026-10-09, UTC; five-minute lease applies and must be checked before any continuation.
**Main at claim:** `5e758673ae91082520b21b3153da53791ae2cbf3` (read-only refreshed).
**Existing PR:** #453 branch `work/r13-replay-finalize-recovery-20261008`; preserve its existing coordinator, LiveKit, S3, abort CAS, replay authorization and earlier F09 claim work. #503 owns mobile signed playback renewal; #497 owns composition.

## Exactly owned paths
- `services/gateway/src/talk_replay/egress/coordinator.ts`
- `services/gateway/src/talk_replay/egress/coordinator.test.ts`
- `docs/workstreams/f09-unique-egress-attempt-20261009.md`

**No other file ownership:** no schema/migrations, gateway entrypoints/routes, Flutter router, Firebase, CI, payments, LiveKit/S3 adapters or production.

## Reproduced source risk and intended repair
The existing `start()` checks `media.current`, then starts external Egress, then writes a unique `(tenant,talk,recording)` row; two Gateway processes can both see no row. Both external StartEgress attempts currently target the same deterministic `talk-replays/tenant/talk/recording.ogg` object. The losing DB insert invokes stop+delete for that shared key, risking deletion/corruption of the winning job's object. Use a fresh unpredictable per-attempt object key before calling external Egress; persist that same key and clean up only that attempt's key when the DB rejects it. Preserve canonical scoping and existing API. Add concurrency and retry regressions invoking the real coordinator.

This is a bounded source safety recovery, **not** a durable cross-process start lease, media worker recovery, proof of real S3/LiveKit response, or E2E verification. Follow through with actual tests if available and a SHA-specific handoff; never merge automatically.
