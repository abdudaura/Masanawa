# U07 — Verified work artifacts: implementation and integration handoff

Updated UTC: 2026-10-09T01:12:00Z.
Owner/window: autonomous Work 88b2711eedab.
PR: https://github.com/Baatiku/masanawa/pull/524
Branch: `work/u07-verified-work-artifacts-20261009`
Base main: `5e758673ae91082520b21b3153da53791ae2cbf3`.
Latest tested source commit: `d97a01cf85921a970036d00f6d12dedd4aa4b48a`.
Final handoff-only HEAD is recorded in the PR body after publication.
Status: **PARTIAL_IMPLEMENTATION / ISOLATED / DRAFT / UNMERGED**.

## Ownership and continuation

Initial claim commit f1590af294b7378204ee4bb4916185729fe9d0c2 was published at 2026-10-09T00:08:56Z, before source writes. The original text's 00:15 timestamp was incorrect; immutable GitHub timestamps are authoritative.
Ownership was renewed before both continuations, after live main, PR and scope/branch inspection. Main remains unchanged. Existing U01–U30 and foundation branches were preserved.
Exact owned paths: services/gateway/src/work_artifacts/**; apps/mobile/lib/src/work_artifacts/**; apps/mobile/test/work_artifacts/**; this handoff.
No shared composition, migration registry, router, theme, pubspec, Firebase or financial source was changed.
Owned implementation and available verification are checkpointed; exclusive lease is released to coordinated integration/review owners. Do not create a second U07 implementation.

Read: CONTINUE-HERE, unfinished reconciliation, expanded U/F allocation, execution workbook, MULTI-WINDOW-WORK, final consolidation, operator V1, human Chat privacy and actual canonical storage/auth/task contracts. No applicable AGENTS.md was found.
U07 was the next genuinely available substantive scope at initial selection. Acceptance: U07/K09, with inherited R12/R15/R16/C07/C08 gates.

## Implemented source — 22 module/test/guide files plus this handoff

- model.ts, service.ts: real bounded UTF-8 .txt, exact owner/request/content/name/lifetime/provenance idempotency; immutable content; generating/ready/failed/revoked/deleting/deleted journal; SHA-256 and size readback before ready; recover existing stored bytes without repeating generation.
- schema.sql, postgres.ts: proposed unregistered schema with profile FKs, owner/request uniqueness, revision CAS, owner paging, bounded recipient grants, durable deletion retry, fair bounded cleanup with tombstone late-PUT sweep, atomic DB-clock 20 creation attempts/account/day.
- private_store.ts: existing private S3 policy adapter, SigV4/SSE/no-store, 15-second deadlines, bounded reads, no public URLs; signed HEAD current-key absence probe. A HEAD 404 does NOT prove deletion of retained versions/replicas.
- routes.ts, composition.ts: actual composition factory and current PlatformCustomerSessionAuthorizer API. Strict body schemas, safe errors, authenticated 60-second actor/revision tickets; current access/session recheck before bytes or filename/hash headers. Public creation cannot assert operator provenance.
- task_adapter.ts: structural actual U02 actor/task subset; private files.create v1, owner/session/exact operation and admitted phase. Persist actual generated text; confirm receipt only after separate byte readback; reconcile never regenerates.
- account_erasure.ts: real trusted F08 worker hook. Mandatory durable write-quiescence and qualified provider-erasure policies; 50 files/batch plus lookahead, owner isolation, revoke/grant clearing, re-delete tombstones, erasure verification, post-I/O fence checks, CAS and retryable journal. Returns trusted worker cursor only on successful batch. Retains metadata for F08's coordinated final transaction. No HTTP exposure or whole-account completion assertion.
- Flutter work_artifact.dart, artifact_controller.dart, artifact_card.dart: canonical ApiClient transport/current account getter, bounded streamed attachment verification, cancel/stale fencing, RAM plain-text preview purge, fresh authorization for export, existing file_picker save, explicit consented share/revoke/delete/recover and optional real C01 recipient picker. No extra tab.
- tests: service.test.mjs, routes.test.mjs, account_erasure.test.mjs, register.mjs; actual Fastify, embedded PostgreSQL, composed HTTP/SQL/filesystem flow and disposable server-PG harnesses; five Flutter controller/DTO tests.
- README.md: exact API, composition, worker cursor/fence/erasure policies and commands.

One format: inert UTF-8 .txt, 1–262144 bytes. Binary/PDF/antivirus capability is not implemented. Exported copies cannot be remotely erased.

## Executed verification

Node 24.19.0: 34 unit/handler tests and 3 integration cases, **37 passed / 0 failed / 0 skipped**:

```sh
node --import ./services/gateway/src/work_artifacts/tests/register.mjs --test services/gateway/src/work_artifacts/tests/*.test.mjs services/gateway/src/work_artifacts/tests/fastify.integration.mjs services/gateway/src/work_artifacts/tests/embedded_postgres.integration.mjs services/gateway/src/work_artifacts/tests/flow.integration.mjs
```

The final flow regression passed again after the last harness edit. Fastify is main's pinned 5.12.5; pg 8.16.3; PGlite 0.3.14; exact main contracts with uuid 14.0.2. Temporary verification dependencies were not added to application manifests.
HTTP flow uses the actual composeWorkArtifacts, canonical IDs, exact SQL journal, temporary physical files, create/readback/idempotency/share/block/revoke/auth-denial/cleanup/late-object erasure. Auth/contact policies remain injected test adapters.
Embedded PostgreSQL executes exact DDL, constraints, uniqueness, CAS, quota reset/cap, cleanup and account erasure. It does NOT prove multi-process server locking or the full canonical migration chain.
Seven owned backend modules, including composition with actual main contracts, pass TypeScript 5.9.3 under main's strict compiler options:

```sh
./node_modules/.bin/tsc --noEmit --strict --target ES2024 --lib ES2024 --module NodeNext --moduleResolution NodeNext --verbatimModuleSyntax --isolatedModules --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noImplicitOverride --useUnknownInCatchVariables --forceConsistentCasingInFileNames --types node services/gateway/src/work_artifacts/model.ts services/gateway/src/work_artifacts/service.ts services/gateway/src/work_artifacts/postgres.ts services/gateway/src/work_artifacts/private_store.ts services/gateway/src/work_artifacts/task_adapter.ts services/gateway/src/work_artifacts/account_erasure.ts services/gateway/src/work_artifacts/composition.ts
```

This is scoped typechecking, not full Gateway/auth/routes build.
Remote Git blob verification matched all 22 local source/test/guide files at a0467ae7fd5e70f938b0f70f0b66ee6617974c81; the sole later source change is the exact API-published, passing final flow harness.
Earlier runtime-only tests missed a Buffer generic inference issue; typechecking found it and the bounded Uint8Array request-body copy fixes it. Unicode ticket signatures and malformed canonical IDs have typed rejection regressions. The new flow initially expected 410 for a recipient after revocation; actual 404 correctly hides inaccessible files, and the test was corrected. No failure was concealed.

## External blockers and precise integration actions

1. **F11 #518:** number/register schema.sql once after security.platform_user_profiles, preserve the elected manifest, run full canonical migrations and real multi-client uniqueness/CAS/quota/cleanup locking. No competing numbered migration.
2. **Work/F18 #497:** compose canonical pool, qualified existing private storage, dedicated server-only key, actual global quota/active-account guard, reciprocal current C01 access and exact current U02 task/operation authorization. Register routes with real session authorizer/log redaction and schedule bounded cleanup.
3. **U01 #519 / U02 #520 / U04 #523:** bind files.create v1 to the existing task executor using the shipped adapter. U02 inspected at 36e412b59f080048a034aa0cffd697276e19f9ba. No second approval/task engine.
4. **F08:** mount domain.accountErasure({isQuiesced,verifyErasure}) only after durable admission denial and all uncertain PUTs are drained. Start without cursor; store next only after success; retry failed batch unchanged. Verify all provider versions/replicas. Keep fence permanent, then remove artifact metadata/quota in the existing coordinated deletion transaction before profile FK removal. A signed-out screen or S3 delete marker is insufficient.
5. **F12 #493 / C07 #480:** mount ArtifactCard in the single private Assistant using actual media-artifact result references, canonical ApiClient/current account transition binding and accepted-person picker from C01 #468. Qualify offline/export/share/revoke/account-switch flows.
6. **Environment gates:** full Gateway workspace build/auth/routes typecheck, server-PG harness/concurrency, Flutter analyzer/five authored tests, Android/two-user/device and live S3 private/SSE/retention/erasure qualification remain unexecuted. Direct authenticated clone failed; Flutter/Dart/device/provider credentials are unavailable. A downloaded disposable PostgreSQL 18.4 binary was tested for availability, but initdb could not run: runtime rejected chown/user switching (Invalid argument/Operation not permitted). No existing server or production system was touched. Embedded SQL evidence remains distinct.
7. CI #457 is still the elected shared incident; no Actions success/repair claim.

Coordination posted to Work #497: https://github.com/Baatiku/masanawa/pull/497#issuecomment-6072180656
C04 #478 at 9cd1f2f4dcd97a377cf40326d6faa9dc6129a333 informed private-storage policy without replacing its source.
Exact integration/API instructions: services/gateway/src/work_artifacts/README.md.

## Security, rollout and rollback

No permissive production policy callbacks, public object URLs, model completion claims or client-assigned identity/provenance.
Tickets require current auth and access; recipient DTOs hide private task/operation details and other grants. Revocation is enforced after I/O.
Erasure verification requires provider policy beyond current-key readability, and the hook never removes recovery evidence itself.
No migration applied, deploy, merge, branch deletion, production modification or spending. Keep capability hidden until qualified integration. Once enabled, disable admission/routes on rollback and preserve deletion evidence rather than dropping metadata with live objects.

SOURCE_WRITTEN yes; LOCAL_RUNTIME_TESTED yes; SCOPED_BACKEND_TYPECHECK yes.
DB_INTEGRATED no; APP_INTEGRATED no; FULL_WORKSPACE_BUILD no; DEVICE_VERIFIED no; PROVIDER_QUALIFIED no; CI_SUCCESS unverified; DEPLOYED no; MERGED no.
Overall U07/K09 remains partial because elected shared integration and qualification are outstanding.
