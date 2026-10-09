# F03 — Canonical 17-persona catalog and conservative hidden Expert bootstrap

Updated UTC: 2026-10-09 00:52. Window: GPT-6 F03 recovery.
**Status: PARTIAL_IMPLEMENTATION** (NOT integrated, NOT tested end to end, NOT deployed, NOT merged).
Claim/lease: [#541](https://github.com/Baatiku/masanawa/issues/541), renewed 00:51 UTC. Only `services/gateway/src/platform_personas/**` and this handoff were modified.
Base `main`: `5e758673ae91082520b21b3153da53791ae2cbf3`.
Branch: `work/f03-approved-persona-provisioning-20261009-gpt6`.
Source checkpoint (prior to handoff): `e00aab26c6fb64a466dc4a775105ad21c7a6cece`. See draft PR metadata for final handoff/branch HEAD.
Requirements: F03, R03/R19; assisted J06/J10/J11 only after integrated, not accepted now.

## Collision-safe ownership and reusable predecessors

- [#441](https://github.com/Baatiku/masanawa/pull/441): atomic Gwani/Gwana bootstrap + interrupted recovery. Preserve completely; do not seed those two in F03.
- [#495](https://github.com/Baatiku/masanawa/pull/495): user default support-agent preference and Flutter selection.
- [#499](https://github.com/Baatiku/masanawa/pull/499): protected offline directory cache.
- [#498](https://github.com/Baatiku/masanawa/pull/498): R19 persona/session safety, disclosure, streaming recovery.
- Work #497 / R17/C08 #493 / F11 #518 and concurrent U17/U09 remain distinct. No shared `main.ts`, `app.ts`, migration registry, existing R03 bootstrap, Flutter shell/cache, Firebase, finance, mobile native or paid admission was modified.

## Implemented SOURCE (not deployed)

1. `services/gateway/src/platform_personas/catalog.ts`: canonical 17 names/seed keys, full and short profile descriptions, greeting, role, gender presentation, topics, personality, humor default and boundaries derived from `docs/DEFAULT-AI-PERSONAS.md`. Exactly 9 male/8 female. Only Gwani=Bodi and Gwana=Sulafat have named voice candidates; other 15 are `null`, never fabricated. Immutable typed metadata. A catalog does not grant execution, safety readiness or voice.
2. `services/gateway/src/platform_personas/bootstrap.ts`: real repository-port-backed creation for **15 additional, non-support Experts only**; stable tenant+seed reservations; provision canonical Character/Version, platform ownership through existing identity port, create hidden AgentPresentation with explicit AI label; **never** create skills, public visibility, voice profile, Seat price or automatic authority. Read back a previously published version+ownership before retrying interrupted writes. Preserve existing admin-edited presentations, IDs, revisions and visibility; refuse same-name conflicting characters, mismatched reserved versions, foreign owners and orphaned/partial identities. Return typed per-persona outcomes, not an overall claim of availability.
3. `services/gateway/src/platform_personas/0001_seed_bindings.sql`: additive immutable tenant-scoped ID reservation table with uniqueness and seed-key constraints; **not registered or migrated**.
4. `services/gateway/src/platform_personas/postgres.ts`: prepared, parameter-bound tenant-safe SQL adapter using session advisory try-lock across pods; durable reservation before mutation; refusal on busy lock/invalid keys, bounded no-wait policy, unlock in finally and poison failed connections. Requires F11 schema sequencing and an authorized DB before use.
5. `services/gateway/src/platform_personas/bootstrap.test.ts`: 7 authored Vitest cases covering roster, private unqualified creation, idempotency, admin edits, name collision, post-identity restart, partial/foreign ownership, tenant isolation.
6. `services/gateway/src/platform_personas/postgres.test.ts`: 5 authored Vitest cases covering durable ID reuse, tenant+parameter isolation, lease release on failure, injection guards, unavailable reservation and failed unlock.

## Verification EVIDENCE

- **Executed** GitHub connector main/PR/claim inventory; verified base `main` SHA and distinct F03 branch; source readback of six new paths, JSON parse of all 17 catalog entries (17 unique; male 9, female 8; voices only Gwani/Gwana; continuous ordering), source assertions for session advisory try-lock, hidden-only Expert path, additive/unregistered migration and no voice-profile writes.
- **NOT EXECUTED:** `pnpm --filter @masanawa/gateway-service typecheck`; `pnpm exec vitest run services/gateway/src/platform_personas/bootstrap.test.ts services/gateway/src/platform_personas/postgres.test.ts`; normal Gateway/full repository Vitest; PostgreSQL transaction/advisory contention tests; app unit and Flutter analyzer; Android/device/provider/LiveKit/Gemini checks.
- Reason: connector-only private GitHub checkout; local `git ls-remote https://github.com/Baatiku/masanawa.git` fails with `Could not resolve host: github.com`, and no checked-out repository/workspace packages or disposable PG/Flutter/Android runtime in this window. GitHub Actions issue #457 previously documents quota/exhaustion/zero-step jobs; do not interpret absent CI as pass or code failure. Static source readback is NOT TypeScript compilation and authored tests are NOT executed tests.
- The SQL file has **not** been applied to any database, and no provider, real user data or production system was changed.

## Missing implementable source / integration

- **F11/DB** elect an unused canonical migration version and register/add the additive SQL through `platformProductMigrationRoots()`, with backup/restore and disposable PG18 tests. Never run this unregistered SQL directly in production.
- **F03/Gateway composer** bind `createPostgresPersonaSeedReservations(database.pool)` and real exact-version/ownership readers to `ensureUnqualifiedExpertDrafts`, in a transaction-safe startup path *after* #441 Gwani/Gwana bootstrap. Coordinate the one shared `main.ts` composer owner, don't concurrently edit it. Ensure identity provisioner and published/current activated version are both confirmed in real PG, including restart after crash between identity and presentation.
- **F03/API + Flutter** admin-review promotion with authorization, voice certification, safety and paid Seat eligibility; authenticated public Agent directory readback; preserve #495 support preference and #499 cache, account switching/locale; real UI and route integration by F12. Currently no new 15 Experts are visible, intentionally.
- **R19/R02** role-sensitive inference prompts/runtime authoritative persona versions, disclosed AI style/admitted stage identity, distinct **qualified** provider voices for other 15, spoken pronunciation/behavior, real LiveKit and two-device audio checks; present source does not certify a voice or permit paid Talk AI Seats.
- **Security/recovery gap:** exact current Character activation, admin-edit protection under cross-process concurrent admin update, schema preflight/tenant lifecycle guard, lock contention retry policy and transactional PostgreSQL verification. Current conservative writer is an adapter-bound partial slice; do not enable outside reviewed integration. Verify safe behavior for corrupted registry, collisions and every seeded character.
- **Tests:** execute authored Vitest; resolve actual compilation or test failures (none assumed); add real PostgreSQL migration/concurrency, auth+API readback, Flutter/service and two-device tests before any release claim.

## Safe final Work sequence

1. Fetch all the listed PR HEADs and read their handoffs; preserve R03 support, preferences and cache. Review F03 source against canonical 17-persona document.
2. Run TypeScript+Vitest using a local repo with `pnpm install --frozen-lockfile`; fix actual errors in owned modules first.
3. Review/sequence F03 reservation migration with F11, execute it only on a disposable PG database, and test cross-process locks, abort/restart, tenant isolation, admin collision and transaction/readback.
4. Integrate F03 after atomic R03 support bootstrap and before Agent directory projection; gate admin promotion on voice/safety/Seat readiness. Do NOT make the 15 hidden drafts public merely to fill a count.
5. Reconcile #495/#499/#498 and #497/#493 before Flutter five-tab integration; prove auth, avatar, voice and persona switch no approval transfer. Execute J06/J10/J11 real-device journeys.
6. Keep draft PR; require source review, CI and actual PG/device verification before merging.

## Data/security/rollback/release gates

- New immutable table has no financial side effects. Tenant/seed uniqueness + serial per-key lease; no user address book, session data or provider tokens. Qualified provider voices for the 15 missing, not invented.
- Rollback: branch unmerged = no effect; on reviewed deployment, disabling opt-in F03 bootstrap leaves bindings/presentations intact, never automatically delete admin-managed Characters. Do not drop table or delete identity rows without reconciled migration/backup plan.
- `SOURCE_WRITTEN=PARTIAL`, `LOCAL_TESTED=NO`, `CI_EXECUTED=NO`, `DB_INTEGRATED=NO`, `APP_INTEGRATED=NO`, `DEVICE_VERIFIED=NO`, `PROVIDER_QUALIFIED=NO`, `DEPLOYED=NO`, `MERGED=NO`.
