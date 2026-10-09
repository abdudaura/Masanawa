# U11 — Authenticated human message search

**2026-10-09 five-minute U11 ownership claim / refreshed with source and tests.** Branch: `work/u11-permissioned-dm-search-20261009-gpt6`. Base latest `main` `5e758673ae91082520b21b3153da53791ae2cbf3`; no source backport or merge authorized. **Status: PARTIAL_IMPLEMENTATION / DRAFT / UNMERGED / NOT END-TO-END VERIFIED.** Existing C01/C02 source is not on `main` and no search route is registered in the production Gateway.

## 1. Live claim, upstream conflicts and exact paths

- No U11 PR, issue or branch was found in the repository searches before claim; branch created and claim committed **before source changes**, first claim commit `1b376520a80719acf358321e24138e2c2400406e`.
- All code is within `services/gateway/src/human_dm_search/**`, `apps/mobile/lib/src/human_chat_search/**`, `apps/mobile/test/human_chat_search/**`, and this handoff. Current branch compare to `main`: **ahead 22, behind 0, 13 files, 0 foreign-owned paths** (at latest pre-handoff source-check checkpoint).
- F14/C01 #468 owns canonical contact requests and privacy, C02 #472 vs #475 (also #477 mentioned by #475) are **mutually incompatible** source/schema authorities. U11 does NOT decide their migration 0017, compose Gateway main/app, touch financial ledger, Firebase, Flutter five-tab shell or production.
- Read only `docs/HUMAN-CHAT-AND-CONTEXTUAL-AI-CONTRACT-20261008.md`, current reconciliation documents, C01 model and both C02 SQL/model/repository/routes before implementing this isolated adapter.

## 2. Code and behavior written

- `search.ts`: current tenant/user/device session authentication **injected from canonical gateway owner**, required persistent shared quota admission (no in-memory fallback), strict 2–128-codepoint normalized search, UUID conversation filter, 1–30 bounded pages, account/user/query/conversation-bound HMAC SHA-256 five-minute cursor and microsecond keyset ordering. SQL/errors sanitized. Session identifiers are never accepted from client-supplied parameters.
- `postgres.ts`: **actual read-only parameterized PostgreSQL adapter**, with explicit F15-selected `conversations-472` or `threads-475` schema dialect; 750ms transaction-local statement timeout and rollback/release on failure, literal `strpos(lower(body),lower($4))` (no wildcard injection), deleted-message omission, both currently active people, current C01 *accepted* contact edge, reciprocal block and restricted-profile guard, tenant isolation, optional conversation restriction, stable created-at microseconds + message-ID keyset cursor. No shadow private search DB/index or migration chosen.
- `routes.ts`: isolated typed authenticated `GET /v1/human/messages/search` Fastify adapter, standardized errors and no-store headers; intentionally unmounted while canonical F15 Gateway service/composition is unmerged.
- Flutter DTO, canonical ApiClient/Dio transport, account/session-epoch-fenced ChangeNotifier, pagination dedupe and visible retry failure, explicit clearing of private search text on session switch, disabled keyboard suggestions, opt-in nested search screen, callback to **currently reauthorized** C02 message jump. No private persistent search cache, Agent impersonation or sixth bottom tab.
- Search currently **requires accepted contacts even if a future C02 policy permits other private threads**. This is intentionally conservative; F15 must reconcile the final membership/read policy before allowing such results.
- **Pins/bookmarks/archive cross-device state was not created:** it would require approved single C02 preference storage/migration and conflict semantics. Do not display as implemented.

## 3. Test evidence (distinguish authored and actually run)

**Authored only, NOT executed under Vitest/Flutter:** `search.test.ts` has 8 cases (unauthorized, input bounds, rate limiting, HMAC query/account isolation and tamper, response bounds, sanitized provider failure, secret sizing). `postgres.test.ts` has 4 executions over two dialect fixtures, rollback/release and rejected dialect. `routes.test.ts` has 3 Fastify injection cases; Flutter controller suite has 4 cases, plus 2 Flutter widget cases (logout race, out-of-order request, pagination dedupe and switch, strict JSON/Unicode). No real Postgres integration/test database, provider, Flutter widget/device or actual two-user search test run.

**Executed read-only source validation via GitHub connection:** compared `main...branch` and found 11 owned changed files, no foreign paths, branch behind `main` by zero at checkpoint. Verified 14/15 initial static invariants (one check searched incorrect test-comment wording, not a source defect), then **8/8** test-source contract assertions. After the privacy/UI and test fixes, read back exact published source and verified **26/26** scoped security/source invariants. All remain static checks, not executed Vitest/Flutter suites. **These are static assertions, not executable source tests, a typecheck or build.**

**Environment blocker:** repository working tree not mounted; local `git ls-remote https://github.com/Baatiku/masanawa.git HEAD` failed with `Could not resolve host: github.com`. Node/tsc executable exists in container, but it cannot typecheck these GitHub-only source files without checkout/package dependencies; Flutter/Dart absent. Historical Actions quota #457 cannot be interpreted as a passing CI. We have NOT run Vitest, TypeScript typecheck, PostgreSQL, Flutter analyzer/widgets, an APK or device tests.

## 4. Required F14/F15/F12 composition and real QA

1. F15 must elect one canonical C02 schema/API, run C01 0016 + exactly one C02 0017 migration on **disposable** PG, and inject a real customer-session authenticator that validates active tenant/user/device and provider-backed distributed search admission/quota. Explicitly select dialect; default-disabled is safer than auto-detecting competing tables.
2. Gateway integration owner mounts **one** U11 route after mandatory authorization; F15 reconciles accepted-only conservative search to actual current C02 read policy; prove revoke/block/delete close already-open search and hit-jump authorization, no peeking by guessed UUID, timeout is privacy-safe. Review Postgres query plan/pg_trgm/index at 100k+ messages and low-end budget before enabling cross-chat search globally. Do not add an unreviewed migration ID.
3. F12/C08 mounts the nested search in **Chats** and wires `switchAccount` to a session-unique key on *every* auth change and `openAuthorizedMessage` to actual authorized current C02 history/jump navigation. Current screen is not a deployed route. Preserve current five tabs exactly.
4. Execute `pnpm --filter @masanawa/gateway-service exec vitest run src/human_dm_search/` and `pnpm --filter @masanawa/gateway-service typecheck`; then `cd apps/mobile && flutter analyze lib/src/human_chat_search test/human_chat_search && flutter test test/human_chat_search`. Rehearse on disposable Postgres and two A/B/C authenticated devices including logout/account swap, contact revoke/block, UTF-8/Arabic/emoji, 100k rows, cursor interruption/retry and stale deep link, then build signed Android APK via release owner only.
5. No financial write, Firebase/native permission edits, production DB migration, branch merge/deletion or provider credentials were performed. Remains draft until successful executable tests and integration/UX evidence.

## 5. Draft PR and further source QA

Draft PR **[#531](https://github.com/Baatiku/masanawa/pull/531)**. Added route auth/429 injection tests, small-screen nested UI hit-jump test, logout query-text purging regression, signed cursor expiry regression and visible load-more failure. Current branch remains unmerged. Source validation is not a passing compilation or live acceptance test. Vercel combined status on source checkpoint reports `failure` due build-rate-limit upgrade URL, not U11 test execution.

## 6. Short API integration contract

Authenticated, rate-limited `GET /v1/human/messages/search?text=...&limit=20&conversationId=<optional-uuid>&after=<optional-opaque-cursor>` returns `{ hits: [{ messageId, conversationId, senderUserId, sequence, body, createdAtUs, editedAt }], next }`. HTTP 400 invalid input/cursor, 401 missing/revoked session, 429 quota, 503 unavailable, 200 legitimate empty. In the absence of a mounted authenticated route, the Flutter client reports search unavailable; it never synthesizes hits. Media body/URLs, human contact numbers and AI conversations never appear in results.
