# U28 — Governed source-backed research: exact Work handoff

Updated UTC: 2026-10-08T17:06:41.526Z; owner: U28 GPT-6 research lane
**Status: PARTIAL_IMPLEMENTATION / DRAFT / UNMERGED / NOT VERIFIED E2E / NOT DEPLOYED.**

## Ownership / SHAs / lease
- Reconciliation main base: `5e758673ae91082520b21b3153da53791ae2cbf3` (rechecked unchanged before this checkpoint).
- Exclusive branch: `work/u28-source-backed-research-20261008-gpt6`.
- Original claim SHA `fa12e2f7db7be858030d57733602af86c9ad19ab`; source commit `469ff0996b2a306862eb663234e37bd1e4f56b48`; hardening HEAD before this handoff: `8676ff2f9c2c33e3980b6c0258f2938fba5f1c6c`. The handoff commit after this record is this branch's final HEAD; consult PR body for the immutable final SHA.
- Claims only `services/gateway/src/research_u28/**`, `apps/mobile/lib/src/research/**`, `apps/mobile/test/research_u28_flow_test.dart`, and this handoff. Five-minute claim rule applies; next window must re-check live PRs.
- Scope U28/P1 and Operator U01, U02, U07 and Assistant C07/F18. Acceptance: authenticated read/search, minimum evidence/independence, rate, provenance, denial, stale/current awareness, mobile accessible source cards. No financial/operator write powers.
- No U28 PR found during last precommit search; no duplicate U28 implementation discovered. Nearby work: U21 #508, U22 #509, U24 #510, unmerged C07 #480, Work #497 and existing C01/C02/CI #457. They must not be overwritten.

## Substantive source written
**Backend / API / security:**
- `services/gateway/src/research_u28/model.ts`: independent typed evidence-only API, strict query/mode/limit validation, bounded snippets, allowlisted HTTPS URLs, hostile IP/localhost/userinfo/fragment rejection, no arbitrary AI HTTP fetch.
- `google_provider.ts`: real fixed-origin Google Programmable Search JSON API adapter, env-supplied credentials (never bundled), safe search, no HTTP redirects, deadline and cancellation, 256 KiB response limit, safe provider exception mapping; source URL, title, index snippet and optional provenance date. **Indexed excerpts only**, not downloaded/verified article bodies; no fabricated full-site fetch or unstated citations.
- `service.ts`: verifies authenticated server actor and permitted-region/policy, atomic quota reservation before provider call, dedupes canonical sources, SHA-256 derived source refs, 2 distinct domains and recent dated source threshold for current coverage, strict no-sources/insufficient states, untrusted-source caveat, sanitized provider errors, quota settlement.
- `routes.ts`: isolated `POST /agent/research` Fastify route ready for elected composer, rejects extra actor/provider/body fields, no-store cache, client abort handling, safe typed failures. It is **NOT mounted in main app** and returns no live production endpoint until F18 integration.
- `postgres_budget.ts` and `001_budget.sql`: additive, tenant/user-scoped Postgres daily request quota + reservations; atomic row quota CAS, rollback/refund-once settlement and schema constraints. **Central migration owner must register once before route mount; no DB touched.** This is a request budget, NEVER a wallet balance or financial debit.
- Auth source of truth is the existing `createPlatformCustomerSessionAuthorizer`; F18 must inject this, not client actor IDs. `permittedActor` must check real region/feature eligibility; default disabled until explicit approved configuration.

**Flutter / UI / state:**
- `apps/mobile/lib/src/research/research.dart`: strict typed result/source parsing and authenticated `ApiClient` Dio POST; no fabricated 404-empty behavior, in-memory per-account results, signout/account-switch cache purge and cancellation generation fence. No new package/plugin/token.
- `apps/mobile/lib/src/research/research_panel.dart`: nested Assistant presentation with typed General/Current choices, text/tap accessible search, loading/error/no results/insufficient evidence, multiple source cards, publication labels and user-initiated external URL open. No sixth tab, router, Firebase or wallet code altered.
- Agent voice/plan continuation: **NOT integrated**; source module has no authority to reinterpret a live Gwani/Gwana request as already researched.

**Written tests (NOT executed):**
- `research.test.ts`: auth before quota, fixed user/tenant, no-credit/region denied, provider failure sanitization, cancelled calls, dedupe, malicious URLs, prompt injection-as-data, current/stale/no-result logic, exact references.
- `google_provider.test.ts`: API endpoint, date extraction, body bound, timeout/network/provider 429 and cancellation.
- `routes.test.ts`: strict body, auth denial and no-store response.
- `postgres_budget.test.ts`: SQL-contract mock for CAS and transactional write/refund paths (not a real DB race test).
- `apps/mobile/test/research_u28_flow_test.dart`: malicious DTO rejection, insufficient current evidence, quota count consistency, stale request/account fencing, cancellation/error redaction, card tap and empty result.

## Verification actually performed
- GitHub current-main and open U28 PR/branch checks (U28 unclaimed when selected); branch claim published before coding.
- GitHub create/read refs, tree/commit/ref update successful; source commit pushed `469ff0996b2a306862eb663234e37bd1e4f56b48`; follow-up route cancellation and focused test fixtures pushed on branch.
- GitHub compare from original `main` confirmed exactly 14 changed paths, all U28-exclusive, branch ahead 5 commits at prehandoff checkpoint. **This is source readback only, NOT a code-test PASS.**
- No local formatter, Node package tests, Dart analyzer, real Postgres, provider API, Android or E2E runs executed. Network in isolated container cannot resolve github.com for checkout, Flutter/Dart executables unavailable, and GitHub Actions shared quota/zero-step blockade tracked as #457. Do not claim CI test failures or successes.

## Source missing / integration blockers — MUST finish before accepted
1. F18/U01: add exactly one `registerResearchRoutes` call through shared `app.ts` and construct service in `main.ts` using existing authorized customer sessions, genuine region/feature policy and explicit server-side provider configuration. Keep route completely disabled if missing provider key, engine ID, allowlist or DB. Do not expose env values, bypass quotas or create a duplicate AI tool registry. Only then add U28 `research.sources.read` capability through U01 typed operator proposal schema, not free-text tool execution.
2. Elected central migrations owner F11/F18: register `001_budget.sql` after existing migrations; disposable PG18 migration/rollback, tenant A/B SQL auth, concurrent multi-node quota tests, failure/settlement, retention and R12 deletion cascade. No migration applied in this window.
3. U02/U07/F18: correlate request with durable task/occurrence and stable task ID, cancellation/restore/history, expiry and explicit consent; create U07 stored notes only **after actual generated content** and per-account retrieval. This U28 slice deliberately does NOT create a competing U02 durable task store or persist excerpts in unsafe local storage.
4. F18/F12: mount `ResearchPanel` as an optional Assistant read action with account-key from authenticated session and voice/typing/tap parity. No user-facing control should be shown before working route and provider; do not mount a fake enabled search.
5. Provider operator: approve/configure Google Programmable Search credentials + engine, reviewed HTTPS domain allowlist, per-region eligibility and daily limit; check provider quota/spend, upstream terms and real search data. Current implementation labels all text `indexed_excerpt` and NEVER represents snippets as verified document bodies. Contradictory page content still needs trusted reconciliation/second-source inspection; **source result count is not truth verification**.
6. Restore path and anti-abuse: bound per-account repeated query dedupe/cache TTL, durable signed task cancellation, worker recovery and current-fact contradiction handling when U02 journal is integrated. No model-initiated funds/messages/third-party requests.
7. Only after composition verify Flutter/Android source link launch, offline/reauth/signout/restart, 10k user/tenant isolation, security audit for pages containing hostile prompt instructions, accessibility and low-RAM layout.
8. Human review of `ResearchError` status mapping to canonical shared error contract; route honors actual server auth and request disconnect, not externally supplied actor identity.

## Tests to execute in ChatGPT Work (in this order)
```bash
pnpm install --frozen-lockfile
pnpm --filter @masanawa/gateway-service typecheck
pnpm exec vitest run services/gateway/src/research_u28/research.test.ts services/gateway/src/research_u28/google_provider.test.ts services/gateway/src/research_u28/routes.test.ts services/gateway/src/research_u28/postgres_budget.test.ts
cd apps/mobile
flutter pub get
dart format --output=none --set-exit-if-changed lib/src/research/research.dart lib/src/research/research_panel.dart test/research_u28_flow_test.dart
flutter analyze
flutter test test/research_u28_flow_test.dart
flutter test
```
Run SQL migration on **disposable** PostgreSQL 18 only after central order review, then physical Android/real signed-in session/provider tests. Baseline repo typecheck failures are known; record U28-specific diagnostics separately. No credentials/device verification here.

## Data/security/rollback and release gates
- No existing schema or data changed on production; only an isolated SQL migration draft. No provider calls, no file upload, no E2EE/human DM read, no fund movement, no permissions grant.
- API key must remain server-only and not be emitted in URL logs/errors; do not log provider query URL. Retrieved snippets are untrusted; model may summarize only within U01 governed context. Public URL links are explicitly user-opened, never backend-fetched arbitrary addresses.
- Revert by **not registering** the optional route/panel; once activated, disable feature config and stop provider calls before schema rollback. Retain billable provider usage records, prune quotas only after legal retention/deletion design. Work must not run destructive schema rollback against real accounts.
- Cross-branch dependencies: C07 #480, Work #497, original Firebase #461, U01–U07 draft source; all shared composer/agent/task changes belong to designated F18, auth F11, and router F12 owners.
- Gates: SOURCE_WRITTEN=yes (bounded modules); LOCAL_TESTED=no; CI_EXECUTED=no; DB_INTEGRATED=no; APP_INTEGRATED=no; DEVICE_VERIFIED=no; PROVIDER_QUALIFIED=no; DEPLOYED=no; MERGED=no. Full U28 = **PARTIAL_IMPLEMENTATION**, not DONE.

