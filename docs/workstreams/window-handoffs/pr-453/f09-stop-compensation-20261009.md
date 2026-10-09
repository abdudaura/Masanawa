# F09 / R13 — fail-closed replay Egress compensation after failed PostgreSQL claim

**2026-10-09 · PARTIAL_IMPLEMENTATION for F09, draft/unmerged, NOT deployed, NOT provider/device/SQL qualified.**

## Canonical scope, owner, source
- Latest `main` at claim: `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Existing continuation: **PR #453**, `work/r13-replay-finalize-recovery-20261008`; preserved all earlier F09 changes. **No new feature PR, migration or database authority.**
- Exclusive claim **#560** before edits; previous #453 recovery claim was older than five minutes. No edits to other workstreams.
- Parent branch/head before this continuation: `721c80100d0fc540723772c0d8770c94776a2332`.
- Changed exact paths:
  - `services/gateway/src/talk_replay/egress/coordinator.ts` (blob `5d52fe040a735d1819f382d1cfacadc7ab60899d`)
  - `services/gateway/src/talk_replay/egress/coordinator.test.ts` (blob `a9b4dd3de7c8f2ada549fbcfee478d59552bb6e9`)
  - `services/gateway/src/talk_replay/egress/verify_compensation_stop.mjs` (new blob `51580bd716c988f525acdf01815cb8f45377a92f`)
  - This handoff `docs/workstreams/f09-stop-compensation-20261009.md`.
- Pre-handoff HEAD `db4a34013643f88ae83962a644ac4c8ab8a1e89b`: code `9b3fb213c9cafc55beea32bfad91ae36feb72126`, Vitest regressions `91e70a201a2ccc0624dc546a8d8c0e2c1edd8da4`, runner `db4a34013643f88ae83962a644ac4c8ab8a1e89b`. The final handoff SHA is the Git commit for this document and must be read from the PR head.

## Production bug fixed, including negative paths
`coordinator.start()` has to call external LiveKit StartEgress before the PostgreSQL media-identity claim; another concurrent Gateway may own the identity. It already assigns a distinct random S3 key to each attempt. Previously, on any failed SQL `createStarted()`, a failed `egress.stop()` was swallowed **and S3 DELETE still ran** against an object potentially being written. This could race a live writer and produce an untracked replay object even after apparent cleanup.

- On DB claim failure, stop exactly the losing attempt's LiveKit Egress first.
- If stop fails/uncertain: throw `AggregateError` with code/message `talks.replay.egress_compensation_stop_uncertain` and both original DB + LiveKit errors. **Do not issue S3 DELETE**.
- Only if stop resolves: attempt delete on the losing attempt's uniquely generated S3 key; if S3 delete fails, return `talks.replay.egress_compensation_delete_failed` including both errors.
- If both cleanup operations resolve, rethrow the original database error to preserve historical caller behavior.
- No changes to successful claim, existing idempotent current-recording behavior, finalization, replay authorization, storage contracts, schema, Flutter, or five-tab router.
- **Important residual:** a StopEgress error can leave an active Egress without durable media-row identity, so manual/provider audit is still required. This change prevents an additional unsafe delete; it is NOT complete orphan reconciliation. Likewise an Egress start network-unknown response may have started recording and needs separate provider-side reconciliation. Do not automatically retry financial or third-party actions.

## Verification — actually run
Available Node v22.16.0 used on a temporary local materialization of the exact GitHub coordinator file. Verified local `git hash-object coordinator.ts` = `5d52fe040a735d1819f382d1cfacadc7ab60899d`, matching the committed GitHub blob. Also verified both Node runners are byte-for-byte identical to their remote Git blobs: `verify_attempt_identity.mjs` `5fb13eaecff0c206d09cba1cd9dd1c366d92c109`, new runner `51580bd716c988f525acdf01815cb8f45377a92f`. GitHub readback of the Vitest test blob is `a9b4dd3de7c8f2ada549fbcfee478d59552bb6e9` (authored, NOT run).

Command with production-path files:
```sh
node --experimental-strip-types --test \
  services/gateway/src/talk_replay/egress/verify_attempt_identity.mjs \
  services/gateway/src/talk_replay/egress/verify_compensation_stop.mjs
```
**Actual result: 8 tests PASS / 0 FAIL / 0 SKIP**, 133 ms, no real providers. Four legacy tests cover concurrent loser key isolation, new key on retry, preexisting identity and invalid IDs. Four new tests cover failed stop without S3 deletion, failed S3 delete with error chain, normal cleanup retaining SQL error, and successful/preexisting path. `node --experimental-strip-types --check coordinator.ts` and `node --check verify_compensation_stop.mjs` also passed. This is real source execution using stubbed providers, **not** Postgres/LiveKit/S3 or release acceptance.

## Blocked/unverified, next integration-owner commands
- Full workspace checkout/pnpm dependencies unavailable locally (container DNS cannot resolve GitHub and no `pnpm`). Thus **NOT RUN**: `pnpm exec vitest run services/gateway/src/talk_replay/egress/coordinator.test.ts services/gateway/src/talk_replay/egress/livekit_egress.test.ts services/gateway/src/talk_replay/egress/postgres_media_repository.test.ts`; Gateway strict TypeScript checks; full backend suite.
- **NOT RUN**: disposable PostgreSQL real concurrent claim and rollback; LiveKit Egress start/stop & unknown-stop provider failure; real S3 object storage/delete; end-to-end gateway authorization; Flutter analyzer/Android physical phones, playback/consent/revocation, CI and release signing. CI quota issue #457 remains outstanding; no statement that CI passed.
- Final integrator must reconcile existing draft #453 with playback #503, U16 #543, Work #497 and F09 auth/consent, preserve ordered migrations and Firebase #461. No production migration, credential mutation, deploy or release performed.
- **Ops gap:** durable orphan detection/reconciliation for unknown stop/start, cost leak alerts, safe operator retry and provider truth checking still required. Original end-to-end F09/R13 remains **PARTIAL**.
- Revalidate latest `main` and PR heads, run real gates, review lease collision before merging. **Keep this PR DRAFT and UNMERGED.**
