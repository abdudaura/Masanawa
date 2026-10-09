# F10 / R14 — Firebase OAuth endpoint trust-boundary recovery

- **Owner/window:** GPT-6 F10 continuation, 2026-10-09, new isolated branch `work/f10-fcm-oauth-trust-boundary-20261009-gpt6`.
- **Scope:** F10 existing Firebase/FCM sender continuation; preserve existing draft PR #436 code and #502 notification privacy policy. This branch **starts from #436 head `0098f4d05d72ea1dc2ad3a3b683111a0f68499cd`**, while latest observed main SHA was `5e758673ae91082520b21b3153da53791ae2cbf3`. The inherited code is not on main.
- **Five-minute lease:** previous #436 update at 2026-10-09T01:33:43Z; older than five minutes at inspection (2026-10-09T03:08+01:00 / 02:08Z), therefore stale/reclaimable. Fresh repository-visible claim is this commit. Recheck this branch before any implementation changes.
- **Owned files:** `services/gateway/src/mobile_push.ts`, `services/gateway/src/mobile_push.test.ts`, this handoff. No Android/Firebase configuration, native files, database/mobile token repository, notification policy/worker, Gateway app/main, migrations, finance code, Flutter root tabs, production system edits.
- **Intended security correction:** service-account JSON currently accepts arbitrary `token_uri` and sends signed OAuth JWT assertion to that URI. Require the documented Google HTTPS OAuth token endpoint, disallow cross-origin/embedded credentials, params and redirects where feasible; keep standard generated Google service account accepted. Sanitize exceptions, fail closed on misconfiguration, add regression tests. Preserve R14 401 refresh, idempotency/uncertain-send behavior.
- **Current status:** CLAIMED / IMPLEMENTATION PENDING / EXECUTABLE TESTS PENDING / DEPLOYMENT UNVERIFIED. Existing PR #436 and all corresponding code/handoffs preserved.
- **Coordination:** F10 #436/#502/#461, final Work #497, R12-owned device token storage, C03-owned notification triggers. No authority to merge. Subsequent section records changed source, test evidence and head SHA.


## Implementation evidence — 2026-10-09

**Changes made on this claim branch, preserving #436:**

1. `services/gateway/src/mobile_push.ts`: reject arbitrary Google service-account `token_uri` values before signing or fetching OAuth assertions. Only canonical `https://oauth2.googleapis.com/token` is allowed. Absence of the optional field defaults to the same supported Google endpoint. Invalid JSON, null and arrays produce sanitized configuration errors instead of an uncaught null dereference.
2. OAuth HTTP exchange uses `redirect: "error"` so a 30x response cannot forward a signed JWT assertion to another origin. A rejected redirect fails closed as `Firebase OAuth failed`; no token logging.
3. `services/gateway/src/mobile_push.test.ts`: add regressions for 12 malicious/malformed token-URI values, malformed JSON/null, default and explicit Google endpoint, assertion audience, and fail-closed 307 redirect. The previous 12 R14/F10 tests remain intact (**15 declared cases total**). No change to R14 per-device send, 401 refresh, ambiguous-result retry policy, token ownership, copy/Deep Links or FCM payload.

**Source and test commit SHAs:**
- OAuth boundary source commit: `82b3d42d55a68b73d73c445bc400631e4f4a81e3`; source blob `d1eb2b2432f8d5a3c84b21df8236ecc4d64adc0b`.
- Vitest regression test commit: `68d163d2af4328f373ca705b5e644cffcc0fffbd`; test blob `f2b3cceb8fe21c23773d3ab495557e02ad25e6e0`.
- Inherited R14 branch head at start: `0098f4d05d72ea1dc2ad3a3b683111a0f68499cd`; observed `main` at claim: `5e758673ae91082520b21b3153da53791ae2cbf3`. The actual handoff commit and PR head may advance after this paragraph; use the PR head as the final immutable handoff SHA.

**Checks actually executed using the GitHub-connected exact source blobs, not a repository checkout:**
- Extracted and ran the actual TypeScript `serviceAccount` function with type-only annotations removed. **PASS:** all 12 hostile URI cases rejected, missing/explicit canonical URI accepted, malformed JSON/null/array safely rejected. Red/green: inherited R14 function **accepted** `https://oauth2.googleapis.com.evil.example/token`; patched function denied it.
- Compiled and executed the source-derived `createFcmPushSender` function as JavaScript after removing TypeScript-only annotations, with RSA signer/HTTP/network/clock mocked. **PASS:** normal one-device send (1 OAuth and 1 FCM mock request, attempted 1 / delivered 1), and definite 307 OAuth redirect failure (1 request, no FCM request, sanitized error). Checked `redirect: "error"` on the actual outbound request. This is *not* a real provider delivery or npm/Vitest run.
- GitHub readback confirmed source/test blob SHAs and 15 declared `it(...)` cases. There is no Git clone/network connectivity in the available sandbox: `git ls-remote` returned `Could not resolve host: github.com`. Node and global TypeScript exist but repository packages and test deps are absent.
- **NOT EXECUTED:** `pnpm exec vitest run services/gateway/src/mobile_push.test.ts`, `pnpm --filter @masanawa/gateway-service typecheck`, full `pnpm check`, Flutter/Android builds, test Postgres/device-token registration, live Firebase OAuth/FCM, two-device notifications, end-to-end/deeplinks and shared GitHub CI. #457 documents prior zero-step Actions quota failures; no new CI run was requested. Assertions must not be converted to E2E status.

## Integration and next-owner handoff

- This is an **isolated F10/R14 security recovery slice, CODE_WRITTEN / SOURCE_DERIVED_TESTED / IMPLEMENTED_UNVERIFIED at slice level**. Whole **F10 remains PARTIAL_IMPLEMENTATION**, because live Firebase/FCM provider and device paths, token lifecycle/privacy, native Firebase #461, producer wiring and notification delivery acknowledgement/recovery have **not** been integrated or verified. PR must remain **DRAFT / UNMERGED**.
- Integrator should semantically incorporate this branch atop draft #436, reconcile notification policy #502, Firebase #461 and Work #497. Recheck main and any new active claim before changing shared files. Confirm real generated Firebase service-account JSON has standard canonical `token_uri` before integrating (nonstandard endpoints fail closed by design).
- In a dependency-ready checkout: `pnpm install --frozen-lockfile`; `pnpm exec vitest run services/gateway/src/mobile_push.test.ts services/gateway/src/talk_notifications/policy.test.ts services/gateway/src/talk_notifications/delivery.test.ts`; `pnpm --filter @masanawa/gateway-service typecheck`; `pnpm check`. Reconcile test/typing errors with minimal owned-file edits.
- With authorized nonproduction Firebase credentials and test devices, exercise real signed JWT OAuth, 307 refusal, bearer rotation, token register/revoke after logout and account switch, quiet-hours/consent, lock-screen-safe private previews, foreground/background/terminated notifications, and platform deep links; do not use actual customer tokens until qualified.
- No customer data, production credentials, payments, deployments, merges, native files, DB schema or Flutter five-tab shell were changed. Rollback is the source/test commits on this branch, retaining the original R14 behavior; no destructive action required.
