# U01 — Canonical operator protocol: development handoff

**Updated:** 2026-10-09 (Africa/Lagos). **Owner:** GPT-6 autonomous U01 window. **State: PARTIAL_IMPLEMENTATION / ISOLATED / NOT RELEASE-QUALIFIED.**

## Ownership and exact SHAs
- Base `main`: `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Branch: `work/u01-operator-contract-20261009-gpt6`; claim commit `640428edf51683a02baa99b3234d8cf2247649b7`.
- Implementation commit: `69029d6dbef9eeb60e0f07cb1588969e733faf4e`.
- Security follow-up commit: `4bc62de417f4265429350f3b6c6a87f61f5a5036`.
- Draft PR: https://github.com/Baatiku/masanawa/pull/519 (unmerged).
- Owned files only: `packages/operator-contract/package.json`, `tsconfig.json`, `src/index.js`, `src/index.d.ts`, `test/index.test.mjs`, `README.md` and this handoff. Never overwrite U02, U03, U04, C07, Firebase, five-tab shell, Gateway composer, migration registry or wallets.
- Requirement coverage: U01 contract sections 1–7; AI-first operator capability boundary; affected C07, J02/J09/J11. No J/K integrated journey is claimed passed.
- Claims were checked against open PRs (70 at selection; U21–U30 and R/C already claimed), repository branches and existing `docs/workstreams`; no existing U01 branch/PR discovered when selected. The five-minute claim must be refreshed before future edits.

## Actual owned source delivered
- Strict parser for V1 model proposals: canonical UUIDv7 request IDs, exact field sets/capability version and key, bounded deep JSON, immutable sanitized copies, prototype/cyclic object rejection, privileged actor/approval/receipt field rejection (including snake_case).
- A capabilities gate with **exact** ID and integer version, enabled flag, classification, allowed region/scope and argument key allowlist. Denies when current server-authenticated authorizer or resource/DM consent callback refuses. Re-parses proposals at admission; there is no guessed alias/fallback or model-issued authority.
- Typed v1 declarations for identity-scoped protocol and four operation classifications; `VerifiedPrincipal` binds canonical tenant/user/device/character-session and server account ID.
- Approval verifier checks a **trusted DB-issued ticket record** (not model-generated) against exact user, tenant, account, session, device, operation, capability version, revision, canonical terms and 15-minute maximum lifetime. Expired, revoked, mismatched amounts or switched accounts fail.
- Separate task execution classification check, legal task phase transitions and receipt-proven success; timeout does not become success. Contiguous task event page and inert unsupported app-card fallback.
- Standalone package documentation specifies exact U02/U03/U04/C07/Work integration seams. `pnpm-workspace.yaml` already includes `packages/*`; no shared file changed.

## Tests and reproducibility
- **EXECUTED:** 24 focused in-process JavaScript assertions on the functions serialized into `src/index.js` before implementation commit `69029d6`: parse/capability/admission, forged privileged data and prototype keys, scope/version/authorizer rejection, context denial, exact approval/time/user/terms, approval-required finance, verified receipt, monotonic cursor and unsupported card. Exit success. This is **not** execution of the repository's Node test file, typecheck, full suite or end-to-end; follow-up security changes have only source/readback assertions, not rerun Node regression evidence.
- **EXECUTED ON CURRENT SOURCE AND TEST BLOBS:** Re-fetched `src/index.js` (`22b98ecfda699d265e1523f6b9d0d270d878ad4a`) and `test/index.test.mjs` (`b280d49daf318d243a2b475a6951c12b586e65ed`) from branch head `dae94d1c98dfff4d63e84207cebff55de5d913a3`. Executed the *actual six authored test callback bodies* against the *actual committed runtime function bodies* inside a V8 isolate after replacing the Node `test`/`assert` harness; **6/6 groups passed, zero failed**. This is focused portable behavioral evidence, **not a Node module-loader run, pnpm typecheck, repository suite or end-to-end test**.
- **AUTHORED AND V8-EXERCISED, NOT EXECUTED IN NODE:** six Node `node:test` suites at `packages/operator-contract/test/index.test.mjs`; post-commit additions cover snake_case privileged values, raw unvalidated admission and account-switch invalidation.
- **NOT EXECUTED** (private repository accessible only through GitHub connector; no authenticated checkout/package install in local container; repo requires Node >=24 whereas available isolated local Node is 22.16): `node --test packages/operator-contract/test/index.test.mjs`; `pnpm install --frozen-lockfile && pnpm --filter @masanawa/operator-contract typecheck`; `pnpm test:ci`; `pnpm build`. Actions issue #457 remains account quota/zero-step blocked as documented.
- **UNVERIFIED:** authenticated Gateway/C07 integration, U02 DB migrations/atomic ticket use and idempotency, U03 Flutter UI/voice/taps, consented human DM/Talk resource access, financial quote/ledger receipts, multi-account/device concurrency, provider and Android qualification.

## Data, privacy, migration and release
- **Migrations / DB:** none written in U01; approval ticket store, task state/events/operation idempotency belong to U02 and must be atomically persisted before execution. No client-supplied `issued` record may reach the verifier as trusted storage.
- **Security:** parser/phase validation is only defense in depth. Real Gateway must authenticate and reauthorize at actual read/prepare/execute boundary, issue opaque random tickets, consume approval atomically, validate per-capability complete JSON schema, and use existing provider-domain authorization and immutable receipts. A voice-generated “yes” is not approval. Never retry unknown finance/send with a new key.
- **Compatibility:** unsupported cards inert; no modification to existing old shell API, Flutter router or voice transport. Exact v1 capability keys are not a deployment guarantee.
- **Production:** no deployment/merges/money/credentials changed. Rollback is omitting this unintegrated package; no schema migration risk.

## Collisions/dependencies and final integration actions
1. Elect canonical U01 runtime API with U02 task persistence and C07 #480 / Work #497 without altering `packages/contracts` stable IDs; add workspace dependency only in the elected Gateway adapter.
2. Add domain catalog from real R/C owner capability definitions, signed-in principal binding and authorization callbacks; unit test raw model/DM/file prompt injection, forged actors, revoked contacts, tenant isolation, account switch and feature flag off at the **composed** API boundary.
3. U02 must provide durable ticket lookup, replay/idempotency journal, short-lived approval issuance/atomic consumption, task state persistence and authoritative receipt reconciliation before enabling consequential actions.
4. U03 must negotiate cards/old clients, preserve text/voice/tap parity and accessible exact-term confirmation; U04 must never bypass existing Billing/Crypto/C06 custody/quote/step-up.
5. In an authenticated local checkout with Node 24/pnpm 12 run exact focused Node suite/typecheck, then root tests/build; capture output and fix errors. Run PostgreSQL disposable acceptance, two-device cross-account approval replay, native Flutter/Gemini focus and provider sandbox only once merged dependency owner approves.
6. Final Work integrator reviews #519 at exact head with Firebase #461, R17/C08 #493 and Work #497, retains one canonical architecture; no automatic merge before checks.

## Release gate matrix
| Gate | Evidence |
| --- | --- |
| SOURCE_WRITTEN | **YES, isolated operator protocol package** |
| LOCAL_TESTED | **FOCUSED PASS / V8 ISOLATE:** 24 pre-hardening assertions + 6/6 current-blob Node test bodies (adapted harness); actual Node/pnpm tests NOT_RUN |
| CI_EXECUTED | **NO** — #457 quota |
| DB_INTEGRATED | **NO**, U02 dependency |
| APP_INTEGRATED | **NO**, U03/C07/R17 integration |
| DEVICE_VERIFIED | **NO** |
| PROVIDER_QUALIFIED | **NO** |
| DEPLOYED | **NO** |
| MERGED | **NO**, draft #519 |

**Final handoff status remains PARTIAL_IMPLEMENTATION** because the full connected runtime and applicable integration verification are not present. The committed package is a substantive reusable protocol and a narrowly scoped continuation, not a completed Masanawa operator.

## 2026-10-09T02:53:08.795Z — fresh five-minute U01 continuation claim

- **Claimant:** GPT-6 U01 security/contract recovery window. Existing #519 activity from 2026-10-08T23:54:26Z was stale (>5 minutes); inspected existing PR diff, source, tests, original handoff and current main `5e758673ae91082520b21b3153da53791ae2cbf3`.
- **Existing branch adopted:** `work/u01-operator-contract-20261009-gpt6`, initial head `0555f9bfb4f41908860a9c6cd13923186d7f9109`. Do not replace earlier commits or create a competing U01 protocol.
- **Exclusive exact files for this continuation:** `packages/operator-contract/src/index.js`, `packages/operator-contract/src/index.d.ts`, `packages/operator-contract/test/index.test.mjs`, and this handoff. No other package, Gateway composition, U02, C07, Flutter, Firebase, migrations, signing or financial files.
- **Defect to address:** callback-based authorization currently accepts truthy values including rejected asynchronous Promise objects; strengthen fail-closed authorization and invalid/missing approval identity bindings, with regression tests. Preserve protocol V1 API and compatibility.
- **Step/status:** claim before source edit; implementation pending; tests pending. No production access or release evidence claimed. Lease requires fresh repository-visible activity every five minutes.

## 2026-10-09T02:55:50.125Z — U01 authorization/approval security recovery checkpoint (this continuation)

**Status:** source repaired with focused verification only; U01 as a whole remains **PARTIAL_IMPLEMENTATION**, draft/unmerged, not release-qualified.

### Scope, commits, exact changed files
- Continued existing stale draft #519 on `work/u01-operator-contract-20261009-gpt6`; starting branch head `0555f9bfb4f41908860a9c6cd13923186d7f9109`, from `main` `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Ownership claim commit `757ab639a64c5987df17ad5be601dbb9b81f39d8` confirmed by immediate GitHub readback.
- Source correction `ba37876468c2251dc5663fb57b7cd1ad2139e289`, regression tests `ea7c042fe785bf4950efcc8c45012101337d77e8`, preserve original not-qualified error `529b0b461ffc4375ac87e6466d4c78fd72a99327`.
- **Files changed:** only `packages/operator-contract/src/index.js`, `packages/operator-contract/test/index.test.mjs`, and this workstream record. No source in other U/C/R/F areas; existing JS/TS public exported signatures unchanged. `index.d.ts` still correctly declares synchronous `boolean` authorizer callbacks.
- Canonical contract: `docs/AI-OPERATOR-ACTION-AND-TASK-CONTRACT-V1-20261008.md`, sections 1–3 and 6. U02/03/04/C07 integration contracts unchanged; all executable domain integrations remain owner responsibilities.

### Security defects and observable behavior
1. Prior permission checks used `if(!authorizeCapability(...))` and `if(!authorizeContext(...))`. A Promise is truthy even if resolving to `false`, so passing an async callback accidentally granted unauthorized resource/capability admission. The gate now demands the exact synchronous boolean `true`, rejects all promises/truthy substitutes, catches policy exceptions and returns only sanitized `not_authorized`. Async policy evaluation must be resolved and committed by the Gateway before calling this synchronous contract; check again before domain execution.
2. Old persisted-ticket comparisons could succeed with **both issued/principal or issued/expected identity fields missing** (undefined === undefined). Approval verification now requires actual present, nonblank user/tenant/account/session/device, operation/capability/revision, ticket ID and safe temporal/contract-version records. Expired, used, malformed and hollow tickets fail closed. This does not make caller-provided tickets trusted: only U02's authenticated DB lookup/transaction can supply `issued`.
3. Duplicate same-ID/version capability registry entries now fail as `invalid_catalog` rather than silently selecting one. Missing/unknown capability still returns the existing `not_qualified` code. Blank principal strings reject at the common `str` guard.

### Actual verification (not CI/Node)
- Executed the **actual committed source and all nine authored Node test callback bodies** under a portable V8 adapter, substituting only `node:test` and `node:assert/strict` harness primitives because this connector environment cannot mount an authenticated repository checkout. **9/9 test groups PASS, 0 FAIL**, against source blob `14d2d270e1498e2ecbc46321d35ec8f1d4879cf7` and test blob `c3f59568f82c7b607164cb337b6be3e43454ffe8`.
- Ran five additional property probes where both DB approval and principal omit each one of tenantId/userId/accountId/sessionId/deviceId: **5/5 rejected with `approval_invalid`**.
- An earlier intermediate V8 run was 8/9 because unknown capability returned `invalid_catalog`; corrected in commit `529b0b4` and reran 9/9. Do not report the intermediate result as final.
- **NOT RUN:** `node --test packages/operator-contract/test/index.test.mjs`, `pnpm --filter @masanawa/operator-contract test`, `pnpm --filter @masanawa/operator-contract typecheck`, root `pnpm test:ci`, `pnpm build`, Flutter analyze/test/APK, PostgreSQL integration, authenticated Gateway E2E, two-device replay, finance/providers and signed release. Container offers Node 22.16 but has no authenticated checkout/pnpm; repo requires Node >=24. GH Actions issue #457 reports zero-step failed jobs and remains a blocker; no CI success inferred.

### Integration requirements and remaining risks
- U02: issue random DB-persisted ticket IDs; bind and transactionally consume to exact user/session/device/account/operation, revision, canonical terms, nonce/idempotency; verify approval at execution under durable lock, not just in this pure function.
- C07/Gateway/U04: resolve async authorization before contract admission or create a fully awaited adapter; **never pass a Promise**. Revalidate live tenant/DM membership/blocked/financial domain consent before execution. Domain-specific input schema, cost limits and immutable receipts are not introduced by this fix.
- U03/Flutter: show exact terms and arm explicit accessible tap/text/voice confirmation; stale approval and post-logout card must remain inert; no new UI wired here.
- No migrations, money movements, customer/provider traffic, secrets, production deployment, root router edits, Firebase changes, merges or branch deletion.
- Final integrator should run Node 24+ focused tests and typecheck, inspect upstream async policy call sites, exercise real U02 + Gateway and Android provider/voice flows, and reconcile PR head before considering merge. Rollback: omit unmerged isolated U01 package from Gateway composition (currently not composed).

| Gate | Current result |
| --- | --- |
| Source authored and committed | YES — narrow U01 fail-closed security recovery |
| Focused logic | PASS — 9/9 actual-source V8 adapted test bodies; 5/5 missing-identity probes |
| Actual Node/pnpm & CI | NOT RUN / BLOCKED |
| Authenticated API/DB/provider/device/Flutter | NOT INTEGRATED / UNVERIFIED |
| PR / release | DRAFT, UNMERGED, NOT DEPLOYED |
