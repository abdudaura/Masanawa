# U27 — privilege-fenced agent operations admin handoff

Updated (UTC): 2026-10-08T19:26Z
Window/owner label: U27 isolated Ops + admin-mobile control
**Status: PARTIAL_IMPLEMENTATION — NO VERIFIED END-TO-END RESULT**
Claim/lease: this file and the exact new U27 paths. Repository-visible claim commit `ecacb526baff6f06b60cffda0282ea4abf0ea410` at 19:17Z; narrowed Ops composition expansion `bbbcfe0345abc2b6b508fa2abc38540d13a5a2c1` at 19:23Z; first source/test checkpoint `c7092a43057d154d87e0bed1092901defa70d63a`; guarded audit-fence source/test checkpoint `faa77aeba957ef5c32f3cdbcc1ffbe9174f2b827`.
Base main SHA: `5e758673ae91082520b21b3153da53791ae2cbf3`; branch: `work/u27-agent-admin-control-20261008-gpt6`.
PR: [#516](https://github.com/Baatiku/masanawa/pull/516) **DRAFT, OPEN, UNMERGED**.
Acceptance source: U27 of `docs/ADDITIONAL-U21-U30-AND-FOUNDATION-F01-F18-20261008.md`, existing Admin Control Plane, five-tab consumer contract (unchanged). No consumer J/K journey has been executed.

## Ownership/collision inventory

- Existing canonical Ops `agent_admin.ts` and Postgres repositories used for presentation, CharacterVersion reference, skills/skill assignment; **no second catalog, database, ID authority or signed tool grant store**.
- New exclusive directories: `services/ops/src/operator_admin/**`, `apps/admin_mobile/lib/src/operator_admin/**` and `apps/admin_mobile/test/operator_admin/**`.
- Narrow previously claimed wiring only: `services/ops/src/app.ts`, `services/ops/src/main.ts`, `apps/admin_mobile/lib/src/screens/admin_shell.dart`. No changes to Gateway app/main, migration registries, finance, Firebase, consumer five-tab navigation, mobile voice or providers.
- At claim time, open PRs for U21–U24, U26 and U28–U30 were present. U25 had recent claim HEAD `1360b57c1033ccffb1211e13dab5cbfc32ebbc38` and was deliberately avoided. No U27 PR/branch was present. Reviewed #497/#506/#468/#493/#480 filenames for Ops overlap: none in that subset. **All open PRs must be refreshed again at integration; this is not a claim of zero collisions.**
- #497 final Work, Firebase #461, C01–C06 draft conflicts, R17/C08 five-tab owner and CI #457 remain untouched.

## Implemented source, exact files

**Postgres/DB:** no new migration; uses existing `@masanawa/agents` tenant-scoped, revision-fenced CharacterSkillAssignment/AgentPresentation repositories via injected `AgentAdminService`. No direct mobile-to-DB queries.

**Server/API/auth:**
- `services/ops/src/operator_admin/agent_control.ts`: privileged projection of actual configured agent/version/skill assignment/readiness, tenant authority before reads, bounded agent cardinality, explicit skill detach **only** behind a REQUIRED injected atomic audit+approval CAS writer; without it all writes refuse, while read APIs remain possible. Validates revision/stale request and checks post-write authoritative readback. No runtime writer is supplied by this PR.
- `services/ops/src/operator_admin/routes.ts`: GET `/v1/admin/operator/agents` and DELETE `/v1/admin/operator/agents/:characterId/skills/:skillVersionId` with strong numeric `If-Match`, no-store, sanitized 400/403/409/503 errors, no unaudited grant/re-enable/publish endpoint.
- `services/ops/src/app.ts` and `services/ops/src/main.ts`: routes *only* when a real explicit injected `AgentAdminAuthorizer` and existing AgentAdminService are provided; no change to production environment or permissive fallback. Default Ops service has no new route when unavailable.

**Flutter admin (not consumer five tabs):**
- `apps/admin_mobile/lib/src/operator_admin/operator_agent_api.dart`: typed catalog and mutation transport over existing Ops-origin AdminApi session, bearer rotation on 401, strong revision header, no optimistic success, sanitized network errors.
- `apps/admin_mobile/lib/src/operator_admin/operator_agents_page.dart`: read-only version/skill status, explicit remove confirmation, stale/conflict/failure recovery, invalidate old loading results after rebuild/disposal, post-mutation fresh server readback, no hardcoded support agent IDs.
- `apps/admin_mobile/lib/src/screens/admin_shell.dart`: separate **Agent Operations** entry in existing admin navigation only.

**Auth and privacy:** a consumer/anonymous without server grant cannot read or modify U27 catalog; admin UI does not hold raw provider secrets or local duplicate capability permissions. Tool assignment is **not** falsely presented as runtime-ready. No local data persistence outside existing secure AdminSession. No finance API or user-ledger mutation.

**Tests authored:** `services/ops/src/operator_admin/agent_control.test.ts` (authorization, catalog projection, CAS, unknown skill denial, API semantics, closed-default composition); `apps/admin_mobile/test/operator_admin/operator_agent_api_test.dart` (bearer, CAS header, error and uncertain response); `apps/admin_mobile/test/operator_admin/operator_agents_page_test.dart` (review, cancellation, readback, stale conflict, denial). These are **source-only**, not executed or proven passing.

## Missing implementable scope — not DONE

1. Full U27 privileged **signed capability enable/disable** and tool/version assignment must be based on canonical runtime action registry and signed manifest validation, not inferred from assigned skills. Current safe UI intentionally permits only removal; there is no activation grant.
2. Admin version **publish/rollback** with immutable version lineage, server authorization, impact preview, no widened tool grants and durable undo is missing.
3. **Atomic durable audit and approval** for detach is not integrated with the canonical Postgres transaction. Security hardening commits `faba65f99a40298235ffdad775919f84dbe608f8` and `faa77aeba957ef5c32f3cdbcc1ffbe9174f2b827` make the mutation **always return 503 when the mandatory auditedRemoval adapter is absent**, even if a real Ops authorizer is injected. The test fixture supplies only an in-memory model of that adapter. **Do not enable actual skill-removal operations in production until transactionally atomic audit, operator approval, tenant authorization and CAS are implemented, tested and injected.**
4. Ops tenant session/`MASANAWA_OPS_ADMIN_GRANTS_JSON` runtime authorizer is injected through existing extension seam, **not configured in this PR**; no existing production admin access proven. Real scope-based grants/privilege revocation and tests still needed.
5. Real quotas, creator funding visibility, cost diagnostics and per-AgentRun health (read-only masked) remain outside U27 page. Scope them to existing finance/ops authority and avoid direct ledger writes.
6. Real disposable Postgres concurrent CAS and tenant A/B tests, admin APK install/login/role switching, sign-out while mutation in-flight, app/device recovery, production receipt/audit review are not executed.
7. Some global Ops endpoints and existing admin shell may need integration with #497 or other foundation lanes; rebase/mergeability must be determined from live target.

## Verification executed vs unexecuted

Executed: GitHub connector inspected main SHA, branch HEAD and all 10 touched source/test files; requested branch workflow inventory returned **0 workflow runs**. These are source-presence checks, **not** compiler/test passes. No remote shell checkout, Flutter/Dart SDK, pnpm installation, disposable Postgres connection, device, admin grant/credentials or CI execution available in this session. GitHub Actions #457 is a known quota/zero-step incident; it was not retried.

**NOT EXECUTED; run on Work checkout at this PR's final HEAD:**
```sh
pnpm install --frozen-lockfile
pnpm --filter @masanawa/ops-service typecheck
pnpm --filter @masanawa/ops-service build
pnpm exec vitest run services/ops/src/operator_admin/agent_control.test.ts
cd apps/admin_mobile
flutter pub get
flutter analyze
flutter test test/operator_admin/
```
Then complete actual Postgres migration/readiness, signed-in admin vs consumer API probes, concurrent revision conflict, revoked-grant check, background/logout race, audit records and physical Android signing/test flows. Record real exit codes, logs and tested SHAs. Test without live funds; no crypto/billing provider needs to be invoked.

## Specific Work integration and security sequence

1. Reinspect PR #516 head/base/merge conflicts and live U/R/F claims. Preserve #497, #461, #457 and no competing migration; rebase only after coordinating Ops shared source.
2. Independently compile/typecheck this source and run both test suites above. Repair any real errors; do not bypass failing cases or infer pass from zero-step CI.
3. Add canonical Ops runtime signed capability authority, immutable version snapshot, approve/publish/rollback and **transactionally durable admin audit/outbox**. Keep identity+tenant grants server-side; every mutation must require a reviewed policy, exact expectedRevision, idempotency and readback.
4. Test safe grant/no-escalation across version changes; deny consumer, anonymous, expired admin, wrong tenant, revoked grant, unknown skill and conflicts. Test double concurrent requests and DB loss between write and audit.
5. Add authenticated masked run diagnostics, quotas/spend and creator float visibility through existing bounded finance/read-only projections; no second financial ledger. Test limits and redaction.
6. Qualify Flutter app on real Android with grants, cancel/confirm, auth refresh, sign-out during mutation and offline/restart. Align with final admin app and five-tab consumer router (do not move admin controls into consumer tabs).
7. After full security review, production-safe DB backup/restore and verified CI/device, decide merge/deployment separately. **Do not merge or deploy this draft as-is.**

## Release gates and rollback

| Gate | Result |
| --- | --- |
| SOURCE_WRITTEN (bounded U27 slice) | YES |
| Entire U27 source complete | **NO — PARTIAL_IMPLEMENTATION** |
| LOCAL_TESTED / CI_EXECUTED | NO / NO |
| DB_INTEGRATED / AUDIT_ATOMIC | Existing repository reused, **real integration and audit unverified / missing** |
| APP_INTEGRATED | Admin navigation source wired; live authenticated server **UNVERIFIED** |
| DEVICE_VERIFIED / PROVIDER_QUALIFIED | NO / N/A — no provider write |
| DEPLOYED / MERGED | NO / NO |

Rollback: feature is not deployed, can remove optional Ops registration/page without altering DB schema; existing CharacterSkillAssignment authority and wallet unaffected. For a future real write, a stale cached page may have shown a removal while the server is uncertain; client invalidates and insists on fresh read. **Never restore or enable a skill automatically after ambiguous failure.**

### Security checkpoint after first handoff (2026-10-08T19:28Z)

- Backend mutation path now **fails closed unless `AuditedSkillRemoval.removeAndAudit` is explicitly supplied**. Existing normal Ops `AgentAdminService.putSkillAssignment` is never called by U27 protected route. Injected writer contract requires a single transaction for tenant/operator authorization, approval, revision compare-and-swap and durable audit.
- `services/ops/src/operator_admin/agent_control.test.ts` adds default 503 / `AGENT_CONTROL_UNAVAILABLE` checks and asserts unsafe repository write cannot be used. Actual persistent audited adapter remains unwritten and explicitly scoped to final Work security integration.
- Source-inspection predicates verified six boundaries (default off, mandatory writer, no direct write, no-store, confirm modal, client readback). These are static source checks, **not compiler, database or device tests**.
- Latest code/test commit before this handoff amendment: `faa77aeba957ef5c32f3cdbcc1ffbe9174f2b827`. Current PR HEAD after the handoff amendment must be recorded in PR #516 description; do not treat earlier handoff checkpoint as tip.
