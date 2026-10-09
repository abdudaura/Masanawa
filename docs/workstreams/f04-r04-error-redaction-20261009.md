# F04 / R04 — Talk AI Seat public-error boundary recovery

**Date:** 2026-10-09. **Status:** PARTIAL_IMPLEMENTATION of F04/R04; draft/unmerged; NOT E2E verified or deployed.

## Scope and live ownership
- Latest main inspected: `5e758673ae91082520b21b3153da53791ae2cbf3`. The **existing** canonical R04 [draft PR #433](https://github.com/Baatiku/masanawa/pull/433) was resumed; no competing Talk AI Seat branch/PR was opened.
- Branch: `work/r04-create-participant-intents-20261008`. Original PR base: `453045fe30f6a0c32f46bf8562b237bdb595fb62`; at check, branch was 20 main commits behind, with 43 ahead. Must reconcile before integration; **do not rebase or merge without owner coordination**.
- Original R04 head before recovery: `7a2778c82b789d515e63307d7459964b47e0f4b7`. Latest **source** commit in this continuation: `5547fc2c375670e14aff9bab3a98cbd4d4108ce8`.
- Exact-path five-minute claim on `factory/claims:.factory/leases.json`, acquired before edits: `gpt6-f04-r04-error-redaction-20261009`, claim commit `2a1c0de2169bce5ee56e6802dc645172c2fa96ee`, refreshed `be3ee4fc072b84ad3f783585488e0bf8699896ac`.
- Changed files exclusively: `services/gateway/src/talk_ai_seats/service.ts`, new `services/gateway/src/talk_ai_seats/error_mapping.test.ts`, and this handoff. Existing R04 Host, persona ownership and Flutter flow remain intact.
- No Gateway root composer, router, database/migration, commerce ledger, Firebase/native, backend deployment or production edits.

## Concrete security issue and change
Previously `mapRepositoryError` turned arbitrary `error.code` or `error.message` into a public `TalkAiSeatError`. It also guessed 409 from substrings such as `expired`, `capacity`, or `revision`. Database driver, SQL, webhook, payment-provider or adapter errors could therefore echo sensitive exception text or incorrect 400 customer errors through GET candidates, POST quote/confirm, Host decision and expiry sweep.

The service now translates only **explicit, reviewed public error identifiers** to stable public code/HTTP status, preserving actual not-found (404), Host/payer denial (403), insufficient balance and state conflicts (409), missing commerce readiness (503), Talk terminal/revision/expiry semantics. It recognizes the canonical commerce Talk AI Seat transition messages by **exact match**, not arbitrary text or substrings. All unrecognized repository/provider exceptions—including SQLSTATE codes—become the opaque `talks.ai_seat_failed` with HTTP 503; raw exception text does not cross the service boundary. Service-owned `TalkAiSeatError` instances remain unchanged. This does not modify financial authorization, charge/reconciliation or dispatch lifecycle.

## Executable evidence — precisely scoped
- Live GitHub readback `service.ts` blob: **`cd57d0c142c3de52cc79daf1d1a782c3568f1e3c`**.
- Live GitHub readback `error_mapping.test.ts` blob: **`f5ff7ebdc0bb722ff4f44cfe4b23aeb548820165`**.
- Eleven new Vitest cases **authored but not executed**. Existing R04 tests remain in place.
- **21/21 PASS — isolated function-level V8 tests** executed against the GitHub-readback current source function, with TypeScript annotations removed for local execution. Cases included SQLSTATE+password, provider free text, guessed `expired` code, null/non-Error throw, canonical 404/403/409/503, quote/authorization expiries, Host/payer authorization, revisions and preservation of existing service-originated errors. This is **not** a production build, full service test, TypeScript compiler pass, Fastify route test or real provider verification.
- Static contract readback confirmed the Gateway extends `tsconfig.base.json` with strict `noUncheckedIndexedAccess`; the new registry lookup includes an explicit undefined guard. Full TypeScript compilation remains NOT_RUN.
- Checkout unavailable in this environment: local `git ls-remote https://github.com/Baatiku/masanawa.git HEAD` failed with DNS `Could not resolve host: github.com`; `vitest` and repo `pnpm` dependencies are not installed in this shell. GitHub connector permitted readback and pushed commits. CI #457 historically reported zero-step runner failures: **do not count those as test runs**.

## Tests and integration REQUIRED before merge
```sh
pnpm install --frozen-lockfile
pnpm exec vitest run services/gateway/src/talk_ai_seats/error_mapping.test.ts services/gateway/src/talk_ai_seats/runtime_dispatch.test.ts services/gateway/src/talk_ai_seat_routes.test.ts
pnpm --filter @masanawa/gateway-service typecheck
pnpm --filter @masanawa/gateway-service build
cd apps/mobile
flutter test test/create_talk_participant_flow_test.dart test/talk_ai_seat_models_test.dart test/talk_ai_seat_sheet_test.dart
flutter analyze
```
Execute in an authenticated **disposable** Postgres/Gateway test environment: induce known quote expiry, wrong Host/payer, insufficient balance, SQLSTATE and provider failures, assert HTTP status and completely redacted body, then verify state/ledger and repeat request idempotency. Confirm failed dispatch after committed admission has authoritative readback and does not invite duplicate charge. Run real Talk Host + invited second device + LiveKit/Gemini audio + fresh AI Seat quote/confirm/receipt when authorized; no live money or production change in this recovery. Qualify historical #433 Flutter account-switch/Host lifecycle tests and existing #452/#459 stage/#471/#484 gift work with relevant owners.

## Risks, dependencies, handoff
- The **F04/R04 feature remains incomplete**: precreate exact persona selection, targeted human invitation, live device audio, permitted admission and financial receipt/readback require coordinated composition. This fix improves error safety only.
- New unknown domain exceptions deliberately return 503 instead of displaying internal text. A new public business exception must be explicitly reviewed and added to the stable whitelist plus a negative test; never restore `message` passthrough or broad substring classification.
- Work integrator: preserve R04 PR #433's prior code, reconcile its behind-main branch, preserve R09 stage #452 and R10 gift #471/#484; rerun actual Vitest/typecheck/device/provider checks at the merge SHA. DO NOT mark `VERIFIED_E2E` or merge on this document.
- No migrations, approvals, feature flags, Firebase or production rollback actions were needed for this scoped fix. Rollback for the redaction slice: revert only its exact service/test commits under review, without resetting #433's preexisting R04 work.

**Disposition:** draft PR #433, no merge, no deployment, no production system mutation. Claim released after branch SHA-specific handoff is pushed.
