# F09 / R13 — S3 replay object-store request boundary

**2026-10-09 claim: IN_PROGRESS; existing draft PR #453, branch `work/r13-replay-finalize-recovery-20261008`.** Five-minute ownership lease starts with this repository-visible claim commit; refresh on code writes. No other R13 change, deployment, merger, or production action is authorized.

## Fresh-repository provenance and no-overwrite check

- Inspected current `main` SHA `5e758673ae91082520b21b3153da53791ae2cbf3`, latest #453 head before claim `857565dfea9134b477f52eaf11a4b01a27cd157a`, #503 signed-URL client work, #543 U16 host consent, Work #497, F09 existing post-sign check, latest 48-lane reconciliation and F09/R13 contract.
- Last #453 commit 2026-10-09T01:07:50Z, older than the five-minute lease when inspected. #453 source and older handoffs stay intact. No competing edits observed on the two S3 paths below; preserve all other PR work.
- **Exact exclusive file lease:** `services/gateway/src/talk_replay/playback/s3_object_store.ts`, `services/gateway/src/talk_replay/playback/s3_object_store.test.ts`, `docs/workstreams/f09-s3-boundary-hardening-20261009.md`. No `main.ts`, `app.ts`, database/migrations, mobile roots, secrets, Firebase, provider settings or signing native files.
- Prior #453 F09 claim covered the coordinator and its tests, not the S3 object-store files. This is continuation of one existing R13 draft, NOT a second competing implementation.

## Security fault and proposed recovery

All authenticated private S3 GET (checksum/finalization) and DELETE (aborted media cleanup) calls currently use fetch's implicit redirect policy. Prevent redirects from causing a request to leave the signed S3 authority or invalidating the signature: set `redirect: "manual"` on both requests and reject 3xx statuses as errors instead of following them. Reject S3 endpoint URLs carrying userinfo, query or fragment; require a clean HTTPS origin so SigV4 signs exactly the intended origin and path. Add regression tests for both hostile redirects, strict origin config, successful original-origin requests and bounded failures.

Status is **PARTIAL_IMPLEMENTATION / UNVERIFIED** until code, focused regression tests and handoff are committed. Reconcile with #503, Work #497, and U16 before eventual verified merge. Existing S3/LiveKit/PG/Android credentials and Actions #457 are not validated here.
