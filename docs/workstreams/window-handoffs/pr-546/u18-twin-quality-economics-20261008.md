# U18 — Twin quality, evidence, owner economics and trust

**Status: PARTIAL_IMPLEMENTATION / ISOLATED / DRAFT / UNMERGED / NOT DEVICE- OR PROVIDER-VERIFIED.** Never merge or deploy based on this source checkpoint alone.

## Claim, base, boundaries

- Exclusive exact-path claim **#544** recorded before editing and renewed during source development; no U18 PR/issue/branch found at original claim.
- Initial main: `5e758673ae91082520b21b3153da53791ae2cbf3` on 2026-10-09.
- Branch: `work/u18-twin-quality-economics-20261009-gpt6`; draft PR **#546**.
- Initial backend commit: `f211c4054c5934f864b9b2074c6cf319e2cc037b`; Flutter commit: `04e1015b76bb4dd524b5395fef41e33991194ea9`; strict type fix: `a71c5be31f2439f3756042e4390711e7c4c135c9`. Final handoff commit and latest PR head are visible through GitHub.
- Paths exclusively under `services/gateway/src/twin_quality/`, `apps/mobile/lib/src/twin_quality/`, `apps/mobile/test/twin_quality/`, and this handoff file. Shared app/router/Firebase/ledger/migration files untouched.

## Actual implementation in the branch

**Gateway:** `createTwinQualityService` composes existing `CreatorEconomyService.read` (R06 canonical commerce balances) and `TwinActivityService.read` (bounded R10/Twin observations). Both independently authorize the **identical caller bearer**; the caller provides neither owner identity nor Twin ID. Rejects inconsistent presence/character IDs, negative, fractional or >1e12 balances, malformed activity, oversized pages and conflicting same-ID event replays. Deduplicates same-ID replay before counting sampled outcomes. Sanitizes client-facing activity rows by dropping narrative text and non-owner-request reference identifiers. Income uses **only** canonical commerce pending/available earnings; event amounts are **never added**. Separates non-withdrawable Agent Float from earnings. A failed read propagates; no fake cached balance or success response.

**Contract:** `schemaVersion=1`, `qualification=ledger-balances-with-sampled-activity`, actual pending/available/float Credits, sample-only completed/unsuccessful counts. `payoutGuaranteed=false`. Task quota and provider-token costs are **null / unknown**, not zero. `exhausted` means verified Float is zero; it does *not* assert a successful reassignment. A purchase/gift/voice activity status does not assert an earning or settlement.

**API registrar:** `registerTwinQualityRoutes` defines authorized `GET /v1/twin-quality?limit=1..100` and validates query input. **It is intentionally not mounted globally** because F18/shared Gateway is the sole composition owner.

**Flutter:** version-checked `TwinQualityReport`, canonical `ApiClient` transport (existing bearer refresh), standalone `TwinQualityOwnerDashboard` with waiting/retry/refresh, explicit non-withdrawable/pending/unverified explanations, optional real support navigation callback. Stateful widget clears prior data on `accountEpoch` or transport change and ignores late in-flight replies from an old account. Ready to mount under Agents → My Twin by F12, not a new tab.

## Executed evidence, precisely limited

- Locally built an equivalent strict standalone Gateway service/test implementation: `node --experimental-strip-types --test twin_quality/quality.test.mjs` → **7/7 passed, 0 failed** (ledger-only earnings, event replay, cancelled/refunded/failed, Float shortage, missing Twin, identity/auth rejection, invalid source/limits). Tests are also checked in on this branch, but **the exact pushed repo test suite was not executed** in a full cloned workspace.
- Local TypeScript check: `tsc --noEmit --strict --exactOptionalPropertyTypes --noUncheckedIndexedAccess --module nodenext --moduleResolution nodenext --target es2024 --skipLibCheck false twin_quality/quality.ts twin_quality/routes.ts fastify.d.ts` → **passed**, with **temporary minimal sibling interface/Fastify stubs**, not the repository's actual workspaces. Detected and repaired the implicit-any on the service read argument.
- Flutter source DTO and widget tests authored for fractional/fabricated Credits and account-switch late reply. **0 Flutter tests executed:** Dart/Flutter SDK unavailable in local container. No physical Android test.
- The private repository could be read/written via the connected GitHub integration; local git cloning failed on DNS resolution. No pnpm workspace dependency install, actual Postgres, real provider, Firebase, full CI run or migration applied. Existing GitHub Actions capacity issue **#457** remains an independent blocker. No production system touched.
- This is not full U18 acceptance; do not promote isolated source proof to release GO.

## Exact integration and missing functionality

1. **F18 Gateway owner:** instantiate from the *same* canonical `creatorEconomyService` and `twinActivityService`, `registerTwinQualityRoutes(app, createTwinQualityService({ economy: creatorEconomyService, activity: twinActivityService }))` once. Run actual gateway `pnpm typecheck`, Vitest + Node suite, authenticated 401/403, source/RBAC tenant-switch tests, API readback and schema compatibility.
2. **F12 Flutter owner:** mount `TwinQualityOwnerDashboard(transport: GatewayTwinQualityTransport(api), accountEpoch: sessionEpoch, onOpenSupport: realSupportCallback)` inside five-tab **Agents → My Twin**. Ensure epoch changes on logout/refresh/identity switch; test stale HTTP 401/late replies, small Android, RTL/Hausa semantics and offline state. Never mount a sixth tab.
3. **R06/R10/F05/F06 financial owners:** independently verify real SQL ledger vs pending/available balances, cancelled purchase, gift/transfer/refund/reversal, eligible attribution ID and immutable settlement; do not calculate commission from sampled events.
4. **U02/U17/R19 owner integration:** actual per-task outcomes, failures, owner review and durable corrections are still missing. Current R10 Twin activity is a *sample*, not a complete task-quality repository. Add an ownership-fenced durable feedback store and explicit retention/migration with the DB owner; no arbitrary report use of safety/moderation tables.
5. **Quota/cost source:** add actual provider-verified per-session cost, policy revision and per-Twin quota readers **only** when canonical authenticated settled receipts exist. Until then null/unverified must remain visible; implement signed dispute receipts through U29/R15 support, not fabricated links.
6. Run full PostgreSQL migration/readiness, Flutter analyzer/widget tests, two-user/dual-device acceptance, release/CI #457 and real provider tests. No CI bypass; PR remains draft and unmerged.

## Security and compatibility invariants

No new writable money path, no schema changes, no simulated currency conversions, no user-supplied tenant/character IDs, no raw customer names/prompts/provider IDs in activity, no proprietary Firebase changes, no change to five-tab architecture, no production or branch merges. Earnings are credits and are not automatically cash withdrawal entitlements.
