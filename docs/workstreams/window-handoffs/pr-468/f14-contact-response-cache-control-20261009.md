# F14/C01 — Private contact response cache prevention (2026-10-09)

## Scope, ownership and status

**PARTIAL_IMPLEMENTATION · DRAFT / UNMERGED · NOT VERIFIED_E2E.** Continue canonical human-contact C01 [PR #468](https://github.com/Baatiku/masanawa/pull/468); no new C01 branch, migration, backend authority, Flutter tab or competing request model. The last visible C01 branch update was 2026-10-09T01:06:16Z, older than five minutes when inspected. Reviewed the earlier F14 mistaken-lease handoff and existing source before this change. [Fresh five-minute claim #6073341696](https://github.com/Baatiku/masanawa/pull/468#issuecomment-6073341696) preceded modifications and names the exact paths. Prior F14 changed the separate contact repository/service paths; this checkpoint touches only route cache behavior and its HTTP test.

- Main baseline inspected: `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Existing PR head before continuation: `0c6aa3ac04dd60d9bb5a59db87fded97f421d506`.
- Code commit: `3254ba82345ace752530efe4daeb9b3c84bc064c`.
- HTTP regression test commit: `8a143bacc9075b3d97a02675ea3e10af8c03c12b`.
- Branch: `work/c01-private-contact-admission-20261008`, base `main`; **pushed source/test checkpoint** `8a143bacc9075b3d97a02675ea3e10af8c03c12b`.
- Exact paths: `services/gateway/src/human_contacts/routes.ts`, `services/gateway/src/human_contacts/routes.test.ts`, and this handoff.
- Review status: no other source paths affected in a confirmed two-commit compare of previous C01 head to source/test checkpoint; no evidence this is merged or deployed.

## Real implementation and threat closed

The C01 endpoints expose exact-handle profile discovery, relationship/request status, own privacy preferences and contact lists. They are authenticated, but previously had no route-level no-store policy, potentially allowing a compliant browser cache (or incorrectly configured intermediary) to retain private responses after account switching.

Added one shared `preventContactCaching` Fastify `onRequest` guard to **all eight existing C01 routes**, including old/new paginated list, handle lookup, own preferences read/write, request, response and revoke. It sets `Cache-Control: no-store`, `Pragma: no-cache`, `Expires: 0` **before authentication, body validation or handler**. This protects validation errors, denied sessions and successful reads/writes alike. Guard is route-scoped, not globally installed on shared Gateway or financial routes. No schema, API/DTO shape, business decision, Firebase/native, voice, ledger, five-tab UI or repository SQL change.

Added a table-driven Fastify `app.inject` test that visits all eight endpoints with valid and omitted bearer token, checks status and every response cache header, and checks schema-denied queries/forged actor fields retain no-store. Existing route tests remain.

### Executed checks and evidence

- **PASS (source-structural only):** GitHub readback of both modified file blobs. Exactly 8 `onRequest: preventContactCaching` registrations; new test covers each route and invalid auth/validation. This confirms committed source exists, **not runtime correctness**.
- **PASS (Git diff scope only):** GitHub compare previous C01 head `0c6aa3ac04dd60d9bb5a59db87fded97f421d506` to source/test `8a143bacc9075b3d97a02675ea3e10af8c03c12b` is 2 commits ahead, 0 behind, exactly 2 modified paths (route implementation and HTTP test).
- **NOT RUN:** `pnpm exec vitest run services/gateway/src/human_contacts/routes.test.ts`; `pnpm -r typecheck`; full Gateway/C01/SQL suite; real PostgreSQL; Flutter tests/analyzer; Android APK/device/two-account integration; cache behavior through genuine network/proxy; CI jobs. The available container has Node v22.16.0, but no repository checkout, `pnpm`, `psql` or `flutter`, and outbound GitHub DNS cannot resolve. No generated test results or proof of a passing build.
- **BLOCKED provider CI signal:** combined commit status at source/test checkpoint shows Vercel failure linking to a build-rate-limit/upgrade URL (not a source test failure or pass). GitHub Actions capacity issue #457 continues to prevent a green workflow-based acceptance.

### Requirement trace, dependencies, next qualified steps

C01/F14 and Contacts K13–K20; R15 safety, R16 privacy/security, C02 F15 send-time admission, U21 Contacts Hub, U24 request screen. Original #468 / #435 R18 shared Gateway composer and 0015→0016→0017 migrations still need a single integration owner. Preserve F12 root five-tab router, C03/C05 messages, #497 Work consolidation, Firebase #461 and financial safeguards. No changes here resolve that shared integration debt.

1. On a clean checkout of this exact branch SHA, run the isolated C01 Fastify test and Gateway typecheck (commands above). Confirm no `onRequest` type incompatibilities or unexpected Fastify error-path behavior; correct any failures before merge.
2. Run existing C01 SQL unit and disposable PostgreSQL integration checks with an explicitly guarded **local test** database, plus two distinct authenticated accounts with accept/revoke/block/decline, loss of session, account switching, and cross-tenant rejection. Do not use production data or providers.
3. After Work semantic composition, test network/proxy caching under account switch and failed authentication, then Flutter Contacts → Chats and relevant K13–K20 journeys on real low-end Android, including privacy/offline/retry states.
4. Record exact merged, tested and deployed SHA(s); only mark F14/C01 DONE on genuine integrated proof. Keep PR draft and unmerged until integration reviewer approves. Prior F14 mistaken-claim review requirement remains independently visible; this narrowly scoped fix does not waive it.

**No merges, production changes, branch deletions, schema rewrites or live messaging side effects.**
