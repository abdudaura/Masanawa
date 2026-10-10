# F09 / R13 — bounded LiveKit Replay Egress requests and uncertain side effects

Updated (UTC): 2026-10-09 04:02 · Owner: GPT-6 F09 replay egress bounded requests
**Status: PARTIAL_IMPLEMENTATION for F09/R13 overall; bounded adapter implementation + simulated regression tests completed. DRAFT / UNMERGED / NOT DEPLOYED.**

## Scope, claim and evidence identity
- Latest main inspected: `5e758673ae91082520b21b3153da53791ae2cbf3`; existing implementation continued rather than duplicated: [draft PR #453](https://github.com/Baatiku/masanawa/pull/453), branch `work/r13-replay-finalize-recovery-20261008`.
- Previous #453 head before this claim: `7c11a9f5c73e6aa1e1de8644b68f321f17917edc`. Production final code commit: `2610bde49615cccdd60e3dec3952b46fa386dadd`; final documentation commit and current HEAD: see SHA-specific PR comment following this file's push.
- Five-minute compare-and-swap path claim `gpt6-f09-livekit-timeout-20261009` was published before code edits in `factory/claims:.factory/leases.json` (claim commit `8bd53bc82f97f2db6a2b4378827f328f1660e6b5`).
- Owned exact paths: `services/gateway/src/talk_replay/egress/livekit_egress.ts`, `services/gateway/src/talk_replay/egress/livekit_egress.test.ts`, `services/gateway/src/talk_replay/egress/verify_livekit_timeout.mjs`, this handoff.
- Relevant requirements: R13/F09 private replay Egress and failure recovery, authenticated Talks recording/replay acceptance; K/J replay permission/device gates remain unverified. **No changes** to C01–C08, Firebase, five-tab Flutter router, payments, migrations, shared Gateway registration or production.

## Actual implementation
- LiveKit `StartEgress` and `StopEgress` now pass a dedicated `AbortController.signal` to the existing TLS-validated, no-redirect HTTPS fetch. One explicit 30-second timer covers provider connection and streamed response. Clear timer when the RPC finishes or fails, with no automatic reattempt.
- Optional `requestTimeoutMs` injection (safe integer 10–120000) enables deterministic tests or deliberate configuration from an integrator. Existing constructor callers use 30 seconds without modifications; JWT, clean origins, private S3 destination, 64-KiB response bound and request payloads are unchanged.
- On provider timeout, throw distinct `talks.replay.egress_startegress_timeout_uncertain` or `talks.replay.egress_stopegress_timeout_uncertain` rather than claiming cancellation of remote activity. Preserve original error as `cause` and preserve ordinary HTTP status errors separately. Existing F09 coordinator propagates uncertain failures and does not conflate them with confirmed cleanup.
- **Important limit:** aborting an HTTPS request does **not** confirm remote Egress was stopped or never started. An uncooperative injected `fetchImpl` may ignore AbortSignal; production Node native fetch honors it. Durable orphan detection, provider inventory, alerting and reconciliation remain missing.

## Executed verification (source-authentic unit simulation, not live provider)
- Environment: container Node `v22.16.0`, no installable monorepo checkout or pnpm. Materialized the **exact committed UTF-8 production-module bytes** and standalone test bytes into a temporary isolated directory; validated `git hash-object` against GitHub readback:
  - `livekit_egress.ts` blob `581a64ee76c9ba3ef255e3073434fdf05fe31a22`
  - `verify_livekit_timeout.mjs` blob `22519a88afcf679036c1675f9604b8c5caac7ccf`
- `node --experimental-strip-types --check livekit_egress.ts` **PASS**.
- `node --check verify_livekit_timeout.mjs` **PASS**.
- `node --experimental-strip-types --test verify_livekit_timeout.mjs` **5 PASS / 0 FAIL / 0 cancelled** (Node TAP); tests cover Start timeout, Stop timeout, invalid timeout settings, distinct HTTP 403, and successful Start identity. Provider calls were fake. Standalone tests were executed on the exact committed production module and runner.
- The first local run with `AbortSignal.timeout` had **0 pass / 5 cancelled** because Node's idle timer is unref'ed. This was diagnosed and corrected by an explicitly managed `AbortController` timer; the final rerun above passed. Do not report the first run as a success.
- The existing `livekit_egress.test.ts` Vitest suite has additional new timeout, invalid-budget and HTTP denial assertions; GitHub committed test blob `5ce9fce78777f85970c1e40a7d6f98db6ffe4920`. **This Vitest suite was authored but NOT EXECUTED**.

## Not executed / blockers
- `pnpm exec vitest run services/gateway/src/talk_replay/egress/livekit_egress.test.ts services/gateway/src/talk_replay/egress/coordinator.test.ts`, gateway TypeScript typecheck, full backend: **NOT RUN**; no pnpm/dependency checkout, private GitHub DNS unavailable in container.
- Actual LiveKit/S3 credentials and authorized disposable provider resources unavailable. Start/StopEgress timeout uncertainty, provider job list, S3-object existence, SQL CAS, media reconciliation and resumed retry with real services: **NOT RUN**.
- Flutter analyzer/Android/iOS replay permission, loss of network during stop, Host discard/consent, signed playback, Firebase/FCM, physical low-end phone and two-device privacy tests: **NOT RUN**. CI issue #457 previously reported quota/zero-step failures; no new CI check is claimed successful.

## Security, collisions, recovery and integrator tasks
- No secret files, provider operations, database mutations or migration; no finance ledger changes. Existing HTTPS-only origin/no-redirect/strict response guard remains active; tenant/Host authorization is enforced upstream by canonical R13 paths and must be E2E-verified later.
- Preserve #453's other F09 recovery commits, R13 signed private playback draft [#503](https://github.com/Baatiku/masanawa/pull/503), U16 approved replay insights draft, Firebase #461 and shared Work #497. Do not resolve collisions by dropping unmerged media or navigation code.
- Integrator: checkout exact draft HEAD; `pnpm install --frozen-lockfile`, run Vitest/TypeScript, simulate hung connect and hung response body using Node native fetch against disposable endpoints, and run real authorized LiveKit/S3/Postgres recordings including unknown Start/Stop outcome, orphan compensation and Host revoke. Confirm Android playback and owner consent with actual credentials/devices. Only merge after source/provider/device/release gates.
- Rollback if needed: revert only this adapter timeout patch and related tests; no schema/data migrations. A 30-second timeout may surface formerly slow provider operations as *uncertain*; operational reconciliation and alerting are required, not an automatic retry.
- Release gates: source written **YES**; local simulated unit test **YES**; full Vitest/typecheck **UNVERIFIED**; CI **UNVERIFIED**; real DB/API/device/provider **UNVERIFIED**; deployment **NO**; merge **NO**.
