# U05 — Opt-in, reviewable assistant memory: implementation handoff

Updated (UTC): 2026-10-09T00:04:41.012Z; owner/window: GPT-6 U05 isolated window.
**STATUS: PARTIAL_IMPLEMENTATION / SOURCE COMMITTED / TESTS UNVERIFIED / DRAFT AND UNMERGED.**
PR: https://github.com/Baatiku/masanawa/pull/522
Base latest-main-at-claim: `5e758673ae91082520b21b3153da53791ae2cbf3`.
Branch: `work/u05-opt-in-agent-memory-20261009-gpt6`.
Substantive code checkpoint: `85ec8359080a43396ff72f6397fb40fb76696b02` (subsequent tests and this handoff also committed; PR head is authoritative final SHA).
Claim: `docs/workstreams/u05-opt-in-agent-memory-20261008.md`, initial repository-visible commit `9b3112d440287c0387e4cc26796174eb4edb028e`. Five-minute lease refreshes at last commit; do not overwrite or double-claim without inspecting PR #522.

## Verified ownership boundaries / collisions

Chosen after reading `CONTINUE-HERE.md`, U/F reconciliation, U execution/contract, the canonical memory model/repository/governance/tombstone modules, and live GitHub PRs and branches. U05 had **no open PR, existing branch or main workstream claim** at claim time. U01 #519 and U02/U03 fresh branches are independent upstream. Existing #497 is draft integration; preserve Firebase #461, R17/C08 #493, C02/C05 competing implementations, financial and native owners. This branch only adds new `operator_memory` paths and this handoff; no shared root app, migration registry, finance, Firebase, production config or other lane's files.

## Exact files by layer

- Gateway: `services/gateway/src/operator_memory/service.ts`, `routes.ts`, `consent_postgres.ts`, `agent_context.ts`.
- Proposed DB DDL (NOT registered/applied): `services/gateway/src/operator_memory/sql/001_opt_in_consent.sql`.
- Gateway tests: `services/gateway/src/operator_memory/service.test.ts`, `consent_postgres.test.ts`, `routes.test.ts`, `agent_context.test.ts`.
- Flutter: `apps/mobile/lib/src/operator_memory/agent_memory_controller.dart`, `manage_agent_memory_screen.dart`.
- Flutter tests: `apps/mobile/test/operator_memory/agent_memory_test.dart`.
- Handoff: this file.

## Implemented in scoped source

1. Authenticated session authorizer produces tenant/user IDs; trusted server adapter must resolve a real canonical private Relationship scope (cannot be supplied by request body); the MemoryRepository, not the gateway, persists records/revisions.
2. Durable opt-in consent is explicitly default-OFF with atomic compare-and-set revision. Opt-out denies assistant memory retrieval. Signed-in user may still review/edit/delete with proper guards. Consent table contains no memory text.
3. Explicit `remember` and `correct` use canonical record/revision methods, user-and-scope markers, canonical UUIDv7 IDs, 512-character bounds, expiry 1–365 days, SHA-256 provenance, bounded count, readback and optimistic revision; rejects wrong account, wrong scope, expired/tombstoned records, stale revision, unsupported kind and background assistant recall without consent. Preferences, manually entered task checkpoints and research notes are distinct categories; there is no silent source ingestion.
4. `prepareForget` refuses without the **canonical** one-time governed tombstone/approval port, never mutates lifecycle directly. The Flutter screen never pretends a prepared request is deleted.
5. Assistant context compilation forces a fresh consent-gated `forAssistant=true` lookup and encloses manual memories in a lower-trust, data-only JSON envelope. No memory text becomes a tool authorization, validated fact, or higher-priority prompt instruction. Isolated Fastify route registration (no shared composer edits); Dio requests use current bearer credentials, no client-selected identity, no plaintext local persistence; account-bound controller discards late responses and exposes explicit reset; nested privacy UI provides opt-in, review, remember, correct, prepare forget, retry and honest failure states.

## Exact missing implementation/integration — blockers NOT silently done

- **Private identity scope:** U05 cannot assume a stable user-private canonical scope. Existing `@masanawa/memory` supports `relationship`, `session`, `task` and character scopes, but no general personal user scope. An integrator must prove a durable, tenant/user-bound private Assistant Relationship or coordinate a reviewed canonical `user-private` memory scope extension with foundation owner; Gwani/Gwana switching cannot widen memory into a shared/public Twin scope. No resolver was fabricated.
- **Canonical typed adapter:** Compose the real MemoryRepository PostgreSQL adapter to the new narrow `CanonicalMemoryPort` and a trusted PrivateScopePort; no shadow store. Absent authorization/scope blocks all APIs.
- **Database migration:** F11/Work must review/sequence/add DDL to the actual migration manifest, qualify PostgreSQL 18, account lifecycle/R12 purge and consent retention, and apply in disposable database before any deployment. This window deliberately did not run production schema changes.
- **Delete action:** Financial/safety-grade, one-time memory tombstone prepare/approval/execute/readback must use actual current AuthorityContext and live policy; only a guarded prepare seam exists. No direct DELETE as workaround.
- **Shared composition:** Current routes are intentionally unmounted; Work/F11 owns `main.ts` / `app.ts`; F12/C07 owns mounting UI, session listener, native app screens, approval UX and persona-consented retrieval. Until attached, the feature is **not user-operational**.
- **Concurrency/idempotency/security:** Explicit remember retries currently generate new record IDs and are not idempotent under lost response; add server-bound canonical operation idempotency before enabling. Count guard alone is not an atomic insert quota across nodes. Add abuse-rate and stale source revocation, privilege review, user deletion cascade, and pagination. Task checkpoint entries are manual, not implicitly verified task-source reads.
- **Full functional proof:** No real PostgreSQL/SDK device, two-account/Gwani-Gwana restart testing, CI runner qualification or production approval. **No E2E evidence; release blocked**.

## Executed vs NOT executed

- **Executed**: GitHub branch creation, claim commit, code + authored test commits pushed via GitHub Contents API; readback of new gateway paths and branch comparison against `5e758673...` showed 10 changed isolated paths, ahead by 12 at the inspected checkpoint. This is **source integrity only**, not tests.
- **NOT executed**: `pnpm --dir services/gateway exec vitest run src/operator_memory`, `pnpm --dir services/gateway typecheck`, `cd apps/mobile && flutter test test/operator_memory/agent_memory_test.dart`, `cd apps/mobile && flutter analyze`, disposable PG SQL/memory integration, two-user device validation. Working runtime has Node/TypeScript only, no installable private repository clone (network cannot resolve github.com), no pnpm/Flutter, and CI #457 already documents zero-job-step Actions quota exhaustion. Test files are **authored/unverified**, not PASS. No rerun of broken Actions workflow was attempted.
- **NOT executed**: production provider, live memory, Telegram/WhatsApp or Firebase tests; N/A to this isolated module until integration.

## Final Work integrator steps (ordered)

1. Re-evaluate claim freshness/PR #522 head and compare with Work #497, U01–U03, C07, R12/F11/F12. Preserve this branch source; keep PR draft.
2. Settle real user-private Assistant scope/membership with canonical @masanawa/memory and authority; implement approved scope resolver and typed Postgres adapter, recheck account/Twin isolation.
3. Integrate DDL with sole migration registry, disposable DB test, CSRF/origin/session auth, rate limits, R12 deletion, receipt/idempotency recovery. Do not deploy unverified DDL.
4. Implement canonical approved tombstone execution/receipt; then mount routes in Gateway and Flutter nested Assistant settings with current Dio/account listener and exact approval callback. Hook agent context read only behind durable opt-in.
5. Run gateway typecheck + Vitest and Flutter analyze/widget tests, then real 2-account/2-device and restart/privacy tests. Fix any failures before considering merge. CI #457 restore is separate and not resolved by this PR.

**No merges, branch deletion, production mutations, spending or Firebase changes.**

## Latest additive checkpoint

The follow-up committed `agent_context.ts`, `agent_context.test.ts` and `routes.test.ts`: bounded lower-trust consented AI memory projection, explicit no-authority flags, prompt-injection fixture, and Fastify payload identity-spoofing / unavailable-scope regression tests. **These tests are source-authored, NOT run.** The PR head will reflect those newer commits and this updated handoff.
