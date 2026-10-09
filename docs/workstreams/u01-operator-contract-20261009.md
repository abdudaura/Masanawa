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
