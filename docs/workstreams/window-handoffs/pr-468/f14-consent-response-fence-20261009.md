# F14 / C01 — consent response state-transition fence (2026-10-09)

**CLAIM — ACTIVE · 2026-10-09T00:42+01:00 · inherited draft PR #468**. Continue the existing F14/C01 branch; do not create a second contact schema, runner, integration PR or migration.

- GitHub scope: https://github.com/Baatiku/masanawa/pull/468, branch `work/c01-private-contact-admission-20261008`, head before claim `fefd2443dfd54ec86f05fb4694762b9141c1b3f7`. Latest inspected `main`: `5e758673ae91082520b21b3153da53791ae2cbf3`. Claim time is after previous branch's last visible update 2026-10-08T19:29Z (>5 minutes).
- Selected workstream: **F14 / C01 (P0)**. Privacy/consent correctness of recipient response. Preserve earlier owner pagination, revocation/reconnection, requestRevision CAS, U21 and U24 developments.
- Exclusive implementation paths being claimed: `services/gateway/src/human_contacts/postgres_repository.ts`, `services/gateway/src/human_contacts/postgres_repository.test.ts`, `services/gateway/src/human_contacts/postgres_integration.test.ts`, this exact handoff file. No other path and no shared gateway composer, migration, root/router, Firebase, provider, finance or production system.
- Confirmed gap in existing SQL: current `respond` allows a declined edge to become accepted and an accepted edge to become declined **with the same request revision**, not just processing a pending invite or idempotent retry. This undermines explicit consent/revocation UX and can reorder paginated contacts on duplicate retries.
- Intended narrowly-scoped fix: only `pending -> accepted/declined` or exact-result idempotent retry; never cross final states via stale response. Preserve updated_at on exact-result retry. Add SQL contract test and disposable DB regression proving decline cannot be silently accepted, acceptance cannot be rewritten by stale decline, and retries retain timestamp. Keep revoker-only explicit reconnect revision semantics.
- Recheck exact-path ownership before edits. **Source not yet modified** as of this claim. Claim publication/readback must precede code changes.
- Evidence pending: code push and GitHub readback; local pnpm/PG/test runners unavailable in current GitHub connector-only environment; no CI/device/provider verification implied. No merge, production deployment, Firebase or money changes.

## Implemented source checkpoint and repository evidence

- **Source/test checkpoint commit:** `c93199707e09dbeea4caeceee9edd2de3da093b4` on the existing C01 draft PR #468. Prior scope claim checkpoint: `9202b6c4e4ee2a0bed19ba75948cd6313835059e`. PR head after this handoff commit and its source history must be read from GitHub (a commit cannot include its own SHA).
- Database/repository: `postgres_repository.ts` now changes a pending consent edge to final `accepted` or `declined` only. For the **same requestRevision**, an identical response is idempotent; the opposite final response fails without modification. A repeated result preserves `updated_at` instead of unexpectedly shifting contacts during cursor pagination. This does not change the canonical C01 0016 migration or the revoker-only reconnect flow that advances `request_revision`.
- TS unit contract: `postgres_repository.test.ts` asserts pending/same-result-only SQL, absence of declined↔accepted shortcuts, existing identity and moderation checks, and timestamp stability rule.
- Disposable PG source: `postgres_integration.test.ts` creates distinct real sender/recipient identities and public profiles in a disposable test tenant; verifies both denied final-state reversals, idempotent exact retries and unchanged `updated_at`. Uses existing local-only `MASANAWA_C01_ENABLE_DB_TESTS=yes` guard. Data is within the existing randomized cleanup tenant.
- Exact changed files from prior PR #468 head `fefd2443dfd54ec86f05fb4694762b9141c1b3f7`: `services/gateway/src/human_contacts/postgres_repository.ts`, `postgres_repository.test.ts`, `postgres_integration.test.ts`, and this new handoff only. No shared auth composer, `main.ts`, `app.ts`, migration, Wallet, Firebase, Flutter router, device native files or U21/U24 feature files touched.
- Verified **readback**, not tests: GitHub returned new blobs for all three files; comparison of prior PR head to checkpoint confirms exactly these four changed paths and four commits. Additional source assertions show SQL restriction, idempotent timestamp expression and regression source are present. Source inspection is not proof of runtime behavior.

## Verification and exact remaining commands

**NOT RUN / NOT VERIFIED:** Vitest, TS typechecking, disposable PostgreSQL, Flutter, full API E2E, device/account switch, provider/real two-person acceptance, signed APK and CI. The available container has Node but lacks a working repository checkout, `pnpm`, `psql`, `flutter`, and access to this private GitHub repository through `git` (DNS resolution failed). Connector only supports GitHub source changes/readback, not command execution. Existing CI issue #457 reports exhausted Actions quota. No CI rerun or production DB actions attempted.

Run on a restored local checkout with dependencies, then the integrated feature branch SHA:
```bash
pnpm exec vitest run services/gateway/src/human_contacts/postgres_repository.test.ts services/gateway/src/human_contacts/service.test.ts services/gateway/src/human_contacts/routes.test.ts
pnpm -r typecheck
# Only with a fresh disposable local *_test Postgres DB and explicit operator opt-in:
MASANAWA_C01_ENABLE_DB_TESTS=yes MASANAWA_C01_TEST_DATABASE_URL='postgresql://local_test:REDACTED@127.0.0.1:5432/masanawa_c01_test' pnpm exec vitest run services/gateway/src/human_contacts/postgres_integration.test.ts
cd apps/mobile && flutter analyze && flutter test test/human_contacts_transport_test.dart test/human_contacts_controller_test.dart test/human_contacts_screen_test.dart
```

**Integration and release dependencies:** Keep #468 draft/unmerged; resolve C01 vs R18 #435 shared Gateway changes through Work #497, apply 0015→0016→0017 migration order on disposable Postgres, reconcile U24 #510 stacked C01 screen/controller and U21 #508 paging adapter, preserve U22 device-only privacy and Firebase #461, validate K13–K20 and two-device real consent after final F12 five-tab/Chats route integration. Canonical C02 #472/#475 must enforce accepted contact policy at send time; fixing F14 SQL alone does not establish DM authorization. No new migration or route was created by this narrow security correction.

**State:** F14/C01 remains `PARTIAL_IMPLEMENTATION`; newly authored SQL/test source present but `TESTS_EXECUTED=no`, `DB_E2E=no`, `E2E=no`, `MERGED=no`, `DEPLOYED=no`. Reviewer should specifically verify race behavior with simultaneous accept and decline on the same revision under real Postgres row locking before any integration promotion.
