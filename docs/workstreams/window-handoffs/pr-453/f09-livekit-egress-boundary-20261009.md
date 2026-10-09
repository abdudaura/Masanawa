# F09/R13 — LiveKit Egress outbound credential boundary

**Claim:** 2026-10-09 UTC; ChatGPT autonomous F09 recovery; **IN_PROGRESS, PARTIAL_IMPLEMENTATION, DRAFT / UNMERGED**.

- Current main at discovery: `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Continuing existing draft [PR #453](https://github.com/Baatiku/masanawa/pull/453), branch `work/r13-replay-finalize-recovery-20261008`, prior head `a7d53301702b1a702d384a14ec0a42794596a060`; last repository-visible PR activity **2026-10-09T01:40:31Z**, more than five minutes before reclaim. Existing F09 coordinator/Postgres/S3 work is preserved; #503 covers playback token renewal, #543 U16 consent, #497 Work integration.
- **Exact owned paths:** `services/gateway/src/talk_replay/egress/livekit_egress.ts`, `services/gateway/src/talk_replay/egress/livekit_egress.test.ts`, `services/gateway/src/talk_replay/egress/verify_livekit_boundary.mjs` (independent Node 22 executable regression), and this handoff `docs/workstreams/f09-livekit-egress-boundary-20261009.md`. No shared app/main, migration registry, Flutter router, financial, Firebase, production, CI/workflow file.
- **Observed vulnerability / planned fix:** Existing recording StartEgress request contains S3 access and secret credentials but accepts `http://` / `ws://` LiveKit endpoints, follows HTTP redirects implicitly, and uses a syntactic regex rather than a strict URL authority check. Fail closed on insecure/malformed URLs, username/password, query/fragment and unapproved path; enforce `redirect: "manual"` and bounded JSON responses; preserve canonical StartEgress/StopEgress payload and existing auth grant. Add deterministic failure and happy-path Vitest regressions.
- **Required after integration:** run `pnpm exec vitest run services/gateway/src/talk_replay/egress/livekit_egress.test.ts` and Gateway typecheck, verify actual TLS LiveKit/S3 recordings, test retry/revocation/provider/Android. CI #457 and real provider credentials remain unverified; no external egress calls made from this window.
- **Ownership:** Existing #453 is not force-pushed or rebased; future Work integrator must reconcile with #503/#497 after executable gates. This commit records claim before source edits.

## Source checkpoint and implementation evidence — 2026-10-09 UTC

**Classification: PARTIAL_IMPLEMENTATION** for full F09/R13. This credential-boundary sub-slice has source, committed tests and local negative-path execution but no live provider/DB/Flutter integration qualification. **DRAFT / UNMERGED / NOT DEPLOYED**. No financial, Firebase, root-shell, migration or production files changed.

**Exact previous work retained:** #453's aborted-media CAS, ready-first replay finalization, post-sign authority recheck and S3-origin/redirect hardening remain in the same branch; #503 covers client URL caching/seek and #497 contains separate shared integration. The F09 claim was published at commit `3af7554074316701a23524bc0c100854b9f3fe60` before production changes. Claim path extension: `c974271c81fd4b5985a88f6f90eb177baa806f5c`. Existing branch head when reclaimed: `a7d53301702b1a702d384a14ec0a42794596a060`. All prior commits preserved, no rebase/merge/force push.

**Substantive commits (on existing PR #453):**
- `fd5bf6004f08fdb0a051daa699d81ac2d6414252`: fail-closed TLS/origin/HTTP redirect and bounded response protections.
- `ed8825d071f49f5e5272e28eac1c1a6b9a6c65be`: extend Vitest with insecure endpoint, userinfo/path/query/hash, 307/308, oversized/malformed replies, secure success cases.
- `b4e5dca86495ba57f86420c659c847a03bfdd612`: validation formatting only; production blob **`53ffe199fc4052af152635d89c5ed205910d2900`**.
- `6e96112b0c443b232285ff02681ff353e12d7e79`: commit reproducible Node 22 test runner; runner blob **`1c470479fad66aae0d4b9c4b779745cd29bb98ec`**.
- This handoff's commit is later; see PR #453 HEAD and its handoff link for the current SHA.

**Exact code paths changed by layer:**
1. `services/gateway/src/talk_replay/egress/livekit_egress.ts`: same existing LiveKit Egress Start/Stop API, canonical JWT and S3 payload; normalize **WSS → HTTPS only**, reject insecure HTTP/WS and URL userinfo/path/query/hash, enforce clean HTTPS S3 origin, set `redirect:"manual"`, reject non-2xx statuses without following, read at most 64 KiB from successful response streams, refuse non-object/malformed JSON. Credential error strings are generic. No separate service or mock production pathway.
2. `services/gateway/src/talk_replay/egress/livekit_egress.test.ts`: existing production-unit Vitest cases retained plus negative and success regression cases, not yet Vitest-executed.
3. `services/gateway/src/talk_replay/egress/verify_livekit_boundary.mjs`: dependency-free 22-case Node 22 regression script invoking the real imported TypeScript production module; useful where pnpm dependencies are unavailable.
4. This handoff. **DB/migrations, auth, Gateway routes, Flutter UI/state, storage/FCM, voice/tap controls, CI and deployment: no changes.** They remain integration/release dependencies, not accomplished by this isolated security fix.

**Verification EXECUTED — narrow but genuine local runtime:**
- Recreated the exact committed production and runner blobs locally (git SHA-1 blob readbacks equal **`53ffe199fc4052af152635d89c5ed205910d2900`** and **`1c470479fad66aae0d4b9c4b779745cd29bb98ec`**, matching GitHub's `fetch_file` content SHAs).
- **Node v22.16.0**, command: `node --experimental-strip-types --test /mnt/data/f09-livekit/verify_livekit_boundary.mjs`; **exit 0, 22 tests passed, 0 failed** (local materialization, no external LiveKit or S3 service). Tests include downgrade/origin injection, redirects for Start and Stop, response size and malformed response, retained JWT/storage payload and successful Start/Stop.
- Earlier independent local 22-case harness on the exact production blob also passed 22/22, but is not a separate E2E claim.
- `tsc --noEmit --target es2022 --module nodenext --moduleResolution nodenext livekit_egress.ts`: **FAILED due to missing local `@types/node`** (`node:crypto` module and `Buffer` types unresolved), not established as a code type error. Full repository typecheck NOT RUN.
- Local `pnpm --version` unavailable, `git ls-remote` failed with DNS `Could not resolve host: github.com`; no complete repo dependency install. Flutter/Dart, actual provider credentials, Postgres and device qualifications **NOT EXECUTED**.
- New GitHub Actions run **37872085223** at source+runner commit `6e96112b0c443b232285ff02681ff353e12d7e79` failed **before any steps**: job `check`, `runner_id=0`, **`steps=0`**. This is not evidence of failing/passing tests; shared incident #457 remains open.

**Security/data & release caveats:**
- This hardening prevents accidental/plaintext credential transport and default redirects to unintended endpoints, but only if the configured TLS origin and DNS/certificate are trustworthy. It does not prevent a maliciously configured *legitimate* endpoint, external secret retention, signed URL leakage after earlier issuance, or races in distributed recording jobs.
- Operators must configure direct final regional `https://` S3 and `wss://`/ `https://` LiveKit origins. Legitimate regional redirects now cause an explicit failed recording request instead of a credential-bearing follow; correct configuration and retry/user feedback must be verified with provider before rollout.
- The 64 KiB limit is appropriate to expected tiny Twirp JSON but must be qualified against actual LiveKit provider responses. Any oversized/malformed successful response fails closed; no full retry/backoff or telemetry was added. No sensitive test credentials are real.
- No migration, auth-policy, financial ledger or customer data changes. Full recording consent, Host/human permissions, media revocation, GDPR/data deletion and Android playback remain outside this sub-slice.

**Cross-branch dependencies/conflicts:** Existing #453 (this draft) requires semantic integration with R13 #503 (signed-URL Flutter recovery), U16 #543 (consent-based replay insights) and Work #497 (Firebase, five-tab app and shared Gateway composition). R13 #453 is behind/diverged from latest main `5e758673ae91082520b21b3153da53791ae2cbf3`; **DO NOT blindly merge/rebase**, drop unique files, or claim release readiness. No known competing active claim for these three exact Egress files at time of claim.

**Needed next, final integrator (unexecuted):**
1. Run `pnpm install --frozen-lockfile`, `pnpm exec vitest run services/gateway/src/talk_replay/egress/livekit_egress.test.ts services/gateway/src/talk_replay/egress/coordinator.test.ts services/gateway/src/talk_replay/egress/postgres_media_repository.test.ts services/gateway/src/talk_replay/playback/s3_object_store.test.ts services/gateway/src/talk_replay_routes.test.ts`, and `pnpm --filter @masanawa/gateway-service typecheck` on composed exact SHA.
2. Reconcile #453 with #503/#497 and existing safety/consent work; rerun full authenticated Gateway/replay/device tests. Before merge, test valid provider TLS and direct regional S3 config, redirect refusal, real Egress Start/Stop, signed media, 404/expiry/revocation, and managed failure reporting.
3. Recover separately incomplete F09 paths: cross-process Egress start uniqueness and stop/DB update race, orphan object durable cleanup, recording consent/revocation, real Postgres concurrency, real Android playback and multi-speaker/Host device acceptance; release after real backups/rollback and #457 CI resolution.
4. Keep PR **draft/unmerged** and do not deploy until the full R13 security/functional/release matrix qualifies.

**Release gates:** SOURCE_WRITTEN=YES (bounded boundary only); LOCAL_TESTED=YES (Node mock-transport unit, **not** E2E); CI_EXECUTED=NO (runner zero steps); DB_INTEGRATED=UNVERIFIED; APP_INTEGRATED=UNVERIFIED; DEVICE_VERIFIED=NO; PROVIDER_QUALIFIED=NO; DEPLOYED=NO; MERGED=NO. Acceptance refs: **R13/F09, P01, T08, Q06, Q12; J05/J11**. Full F09 remains **PARTIAL_IMPLEMENTATION**, not VERIFIED_E2E.
