# F15 C02 — atomic human message edit/delete authorization

**Updated 2026-10-09 (UTC) · PARTIAL_IMPLEMENTATION · DRAFT / UNMERGED / NOT DEPLOYED**

## Ownership, source and exact history

- Claimed stale F15 lease on [#550](https://github.com/Baatiku/masanawa/issues/550#issuecomment-6072650649) before production-code edits. Claim path: this handoff.
- **Reused existing C02 [draft #472](https://github.com/Baatiku/masanawa/pull/472)** and its branch `work/c02-durable-human-dm-20261008`. Existing competing [#475](https://github.com/Baatiku/masanawa/pull/475) remains intact, **do not apply its conflicting 0017 migration**.
- Current-main source observed before claim: `5e758673ae91082520b21b3153da53791ae2cbf3`. Branch inherited prior C02 commit `c60f16ba4733eae1d8ecd28ad7677a87332383d2` (it was NOT rebased onto main).
- **Claim commit** `a3847f35faec1f50206fd73f8947353c3b286e2e`; **security code** `00b088dae54b407e475cfce6a95ab832b3a15a51`; **SQL unit test source** `971edf927b56661b82292caace9b3de10650db07`; **disposable-Postgres test source** `00f8ce3cbc04e5fb319b4479dd06ff5d0bb6c1ba`.
- This handoff is a subsequent commit. For exact final branch SHA use [#472 current HEAD](https://github.com/Baatiku/masanawa/pull/472/commits); never assume code checkpoint SHA is HEAD after handoff.

## Scope and implementation

**Evidence-backed flaw:** In the C02 branch, `edit()` and `remove()` first used a separate query to retrieve the message/thread, called `conversationAllowed()`, and then issued a new unguarded `UPDATE` under PostgreSQL READ COMMITTED. An intervening block, contact decline, identity disablement or moderated profile could leave a mutation authorized by an obsolete snapshot. The deleted-message retry lookup was also unguarded, allowing a sender to recover a tombstone after losing access.

**Changed paths — no other source ownership:**

1. `services/gateway/src/human_messages/postgres_repository.ts` — extract one shared C01/identity/safety member predicate for existing `eligibleReader` and message writes. For both edit and initial delete, authorize `tenant_id`, authenticated sender, conversation membership, two active users, contact-decline veto, reciprocal block veto and moderated-profile visibility **in the same SQL statement as the UPDATE**. Preserve 15-minute edit limit, tombstoning and canonical `HumanDmMessage` DTO. A second, equally guarded SELECT returns an existing tombstone on authorized repeat delete. Database errors still propagate; inaccessible identities return `null` for service 404.
2. `services/gateway/src/human_messages/postgres_repository.test.ts` — add query-harness regressions for authorization in both UPDATE statements, sender/tenant bind ordering, edit limit, inaccessible actor, repeat-delete gated lookup and DB error propagation.
3. `services/gateway/src/human_messages/postgres_integration.test.ts` — add **authored, not executed** disposable-Postgres flow for sender-only edit/tombstone, repeat delete and editing deleted items. Add blocked-actor and declined-contact negative mutations against an actual previously stored message, checking blocked attempts leave the original body intact.
4. `docs/workstreams/f15-message-mutation-authorization-20261009.md` — claim + this handoff.

**No** migration, gateway `app.ts`/`main.ts`, public Talks, root Flutter tabs/router, Firebase, client token, ledger, crypto, provider, production or CI workflow modifications. C02 already defines the API and isolated Flutter thread in #472, still unmerged; this patch changes repository security only and reuses the existing request-identity authority. It does **not** pretend Flutter ↔ API integration works yet.

**Important concurrency qualification:** The UPDATE and predicate are statement-atomic against authorization visible in its PostgreSQL statement snapshot. This does not establish global strict serialization against a concurrently running independent C01 authorization-change transaction; if the privacy contract requires that stronger guarantee, F14/F15 must jointly design shared row lock ordering and exercise concurrent DB transaction tests.

## Tests and verification evidence

| Test/gate | Actual status |
| --- | --- |
| Exact GitHub-branch source shape/security regression | **Executed 17/17 PASS** in connector-side V8 against fetched code + test blobs at code checkpoint `00f8ce3c...`. Verified guard in write statements, tenant/sender binds, time window, declined/blocked/account/safety eligibility, guarded retry, authored negative fixtures and prior read/send guards. This is a **static source invariant audit**, **NOT** TypeScript compilation, Vitest or real PostgreSQL execution. |
| Vitest unit tests | **NOT EXECUTED**: no mountable local private repository checkout; direct git HTTPS from test container failed `Could not resolve host: github.com`. To run when checkout exists: `pnpm install --frozen-lockfile && pnpm exec vitest run services/gateway/src/human_messages/postgres_repository.test.ts services/gateway/src/human_messages/service.test.ts services/gateway/src/human_messages/routes.test.ts`. |
| Gateway TypeScript & whole-suite | **NOT EXECUTED**: inaccessible workspace checkout/dependency graph. Deferred `cd services/gateway && pnpm typecheck`; from workspace root `pnpm test:ci && pnpm build`, after install. |
| Disposable PostgreSQL | **NOT EXECUTED**: no safe disposal database, C01 #468 migration 0016 and C02 migration 0017 are not jointly mounted on main. Only with `MASANAWA_TEST_DATABASE_URL` pointing to a fresh test instance and canonical migration registration: `pnpm exec vitest run services/gateway/src/human_messages/postgres_integration.test.ts`. Never run against customer/production database. |
| Flutter, Android, two-account J03/J10/J11 | **NOT EXECUTED**: C02 #472 remains draft/unregistered and C01 #468/F12 shell unmerged. Run `cd apps/mobile && flutter pub get && flutter analyze && flutter test`; verify two real users/device states, edit/delete after blocked/declined, repeat retries, killed-app return, multiple accounts and rejected third-party identities. |
| GitHub Actions #457 | **NOT VERIFIED**: earlier documented Actions quota / zero-step jobs block CI assertions; no CI trigger was made to consume the known exhausted quota. |

## Integration and security handoff

- **F14/C01 #468**: use the actual active/declined/blocked/profile tables and their lifecycle, then SQL-test the authorization-change race on disposable Postgres. Distinguish SQL snapshot authorization from a *committed-before-write* revocation guarantee.
- **F15 final C02:** inspect semantic differences #472 vs competing #475 without applying both `0017_human_dm_core.sql` and `0017_human_dm_text.sql`. Reconcile with current main; preserve idempotent send/history/Flutter outbox unique behavior. Confirm `SELECT/UPDATE` plans and regressions on PG18.
- **Gateway integrator:** preserve #468 contact and #435 avatar composition in shared `app.ts`/`main.ts`; add C02 routes and migration manifest in correct C01→C02 order. Verify auth and tenant fencing through real HTTP requests.
- **F12/C08 + F16/C03/C05:** mount one genuine human `/messages` route and protected per-account recovery without redirecting historical private-AI `/chats`. Keep five tabs **Talks · Chats · Assistant · Wallet · Agents**, Gwani/Gwana in one private center Assistant, and no new chat backend.
- **J03/J10/J11 end-to-end** must prove actual cross-account text edit/delete/read after app restart, block/revoke/no permission leaks; native private voice is separate C04. No billing/crypto data paths are touched.

## Deployment, rollback and release status

No changes to production, infrastructure, secrets, CI or migration. This patch is a guarded code change on an unmerged draft branch; rollback is omitting/reverting these source commits before any future deployment. Source remains **PARTIAL_IMPLEMENTATION** because canonical composition, migration registration, durable outbox/realtime/mobile mount and live two-account qualification are not delivered by #472. SOURCE_WRITTEN: YES; LOCAL_TESTED: NO; DB_INTEGRATED: NO; CI_EXECUTED: NO; APP_INTEGRATED: NO; DEVICE_VERIFIED: NO; PROVIDER_QUALIFIED: N/A for private DM text; DEPLOYED: NO; MERGED: NO.
