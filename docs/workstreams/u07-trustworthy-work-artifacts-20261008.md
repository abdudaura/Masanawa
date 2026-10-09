# U07 — Trustworthy work artifacts handoff

Updated (UTC): 2026-10-09T01:09:15Z. Owner/window: autonomous Work 88b2711eedab.
Status: **PARTIAL_IMPLEMENTATION / ISOLATED / DRAFT / UNMERGED**.
PR: https://github.com/Baatiku/masanawa/pull/524
Branch: `work/u07-verified-work-artifacts-20261009`
Base main: `5e758673ae91082520b21b3153da53791ae2cbf3`.
Current source/test checkpoint: `89bcb823c849991f90356c62ab181422640b1eac`.
The final pushed handoff HEAD is recorded in the PR body after this file is committed.

## Claim and recovery

Initial claim commit `f1590af294b7378204ee4bb4916185729fe9d0c2` was published in #524 at 2026-10-09T00:08:56Z, before source writes.
The original claim text incorrectly said 00:15Z; the immutable commit/PR timestamp above is authoritative.
Ownership renewed at this update after checking current PR/head and all matching U07 branches; only this U07 branch was returned.
Exact owned paths: `services/gateway/src/work_artifacts/**`, `apps/mobile/lib/src/work_artifacts/**`, `apps/mobile/test/work_artifacts/**`, this handoff.
U07 owned module lease renewed for account-erasure source hooks and additional verification. Shared F11/F18/F08/F12/U04 composition remains with its elected owners; no shared files are claimed.

Read order: CONTINUE-HERE; unfinished reconciliation; expanded U/F allocation; U execution workbook; MULTI-WINDOW-WORK; final consolidation handoff; operator V1; human Chat privacy; implementation kickoff and actual object-store/auth/contracts source.
No applicable AGENTS.md was found in the inspected main/C04 trees.
Live discovery preserved existing U01–U06 branches, U21–U30 PRs, C04 #478 and Work #497.
U07 was the next available source scope at selection. No existing U07 implementation was replaced.
Acceptance references: U07, K09; inherited R12/R15/R16 and C07/C08 qualification remains open.

## Implemented source

| Layer | Files/functionality |
| --- | --- |
| Model/service | `model.ts`, `service.ts`: real bounded UTF-8 text artifacts, canonical injected IDs, exact request/content/name/lifetime/provenance idempotency; generating/ready/failed/revoked/deleting/deleted states; SHA-256 and size readback before ready; no invented file URLs |
| Persistence | `schema.sql`, `postgres.ts`: proposed durable file journal, owner/request uniqueness, owner+tenant CAS revisions, paginated owner list, bounded grants, physical-delete retry and tombstone sweep; atomic DB-clock 20 creation attempts/account/UTC day |
| Private storage | `private_store.ts`: narrow artifact-content adapter using existing private S3 configuration/signing/SSE policy, 15-second deadlines, no redirects/public URL, bounded streamed reads |
| Auth/API | `routes.ts`, `composition.ts`: current PlatformCustomerSessionAuthorizer; strict body schemas, typed safe errors; session recheck before bytes or filename/hash headers; no-store/nosniff; internal operator provenance cannot be supplied through HTTP |
| Task bridge | `task_adapter.ts`: consumes structural U02 actor/task interfaces; requires owner/session/private Assistant/files.create v1/running-or-reconciling and exact operation; actual text persistence and separate byte-verified readback; never reruns generation on reconciliation |
| Flutter | `work_artifact.dart`, `artifact_controller.dart`, `artifact_card.dart`: existing ApiClient transport, bounded download, plain-text preview, explicit save/share/revoke/delete, current-account cancellation and stale result fencing, RAM preview purge, no offline download fallback; existing file_picker only |
| Tests | Node handler/security/lifecycle/storage tests; separate real Fastify and disposable PostgreSQL harnesses; five Flutter controller/DTO tests authored |
| Integration guide | Backend `README.md` records actual exported functions, API contracts and exact F11/F18/F08/F12 composition steps |

No production, Firebase, financial ledger, shared Gateway app.ts/main.ts, migration registry, root router, pubspec, theme or other window's branch was modified.
One supported format is implemented: inert UTF-8 .txt, 1–262144 bytes. Arbitrary binary uploads/PDF generation and antivirus qualification are not promised.

## Executed verification

- Node 24.19.0: `node --import ./services/gateway/src/work_artifacts/tests/register.mjs --test services/gateway/src/work_artifacts/tests/*.test.mjs` — **27 passed, 0 failed, 0 skipped**, exit 0.
- This runs exact authored TypeScript runtime sources with native type erasure. It is NOT a TypeScript build/typecheck.
- Real temporary file I/O proves text -> file -> checksum readback -> actor-bound download; metadata repositories and authorization providers in these tests are injected test doubles.
- Covered cross-account/tenant access, explicit recipient grants, expiry/block/revocation, stale ticket/revision, task cancellation during upload, lost PUT response/recovery, checksum drift, denied task origin, bounded data/filename handling, interrupted deletion and late-object sweep.
- Handler tests exercise current-session revocation, no metadata header leaks on 401, strict schema declarations and safe exception responses. They are NOT a running Fastify HTTP test.
- Remote Git tree comparison: all **18 local source/test/guide files exactly match their Git blob SHAs** at source checkpoint above.
- GitHub comparison at that checkpoint: 8 commits ahead of main, 0 behind, 19 added paths, all inside owned boundaries.
- Additional reviewed fixes reject Unicode/malformed ticket signatures with 403 rather than a server error, and invalid request/recipient/cursor IDs with typed 400 rather than retryable 503. Regression cases pass.
- Initial test command without preloading the import resolver failed on .js -> .ts resolution; corrected --import command above executed successfully. No application test failure was hidden.

## Not executed / precise blockers

- Full workspace TypeScript build and Gateway typecheck: tsc/installed workspace dependencies unavailable; direct authenticated git clone failed. Node runtime tests do not replace this gate.
- Fastify HTTP harness: Fastify package unavailable in this environment. Command: `node --import ./services/gateway/src/work_artifacts/tests/register.mjs --test services/gateway/src/work_artifacts/tests/fastify.integration.mjs`.
- PostgreSQL harness: no pg package, disposable PG server/connection provided. Command in README requires explicit MASANAWA_ARTIFACT_DISPOSABLE=yes and empty masanawa_test_* DB; refuses nonempty/non-test targets and rolls back its DDL. Minimal profile FK fixture does not qualify the whole platform migration chain.
- Flutter analyze/controller tests/Android: Flutter and Dart SDK absent. Run `cd apps/mobile && flutter analyze lib/src/work_artifacts test/work_artifacts && flutter test test/work_artifacts`, then Android/session/file-picker/two-user/device checks.
- Live private S3, bucket ACL/SSE/retention, actual C01 grant/block checks, full U02/U04 task and worker composition, account deletion: no qualified credentials/composed runtime available.
- CI #457 remains the designated shared Actions incident; no CI success or repair is claimed here.

## Remaining source integration and next exact actions

1. F11 assign/register schema.sql once after platform profiles; execute exact schema/CAS/uniqueness/quota tests and full canonical migration order. Never add a competing numbered migration.
2. F18 bind the canonical pool and existing private storage, server-only dedicated ticket secret, current account quota/admission, reciprocal C01 contact/block/deletion policy and owner-scoped current U02 task+operation predicate. No always-allow defaults are shipped.
3. F18 register routes with the real session authorizer and sensitive-log redaction; preserve C/R and Work #497 composition. Validate schema rejection and session rotation/revocation on HTTP.
4. U04/U01 register files.create v1 with the existing U02 execution engine using task_adapter.ts; pass actual generated text and actual task/operation state. No parallel approval/task engine.
5. Worker integrator schedule bounded sweep(). Test simultaneous PUT/delete, retry after worker loss, actual S3 consistency and physical erasure.
6. F08 disable new account access, remove owner objects, verify erasure, then remove metadata/quota rows before profile FK deletion. This deletion hook is not yet composed.
7. F12/C07 mount the result card in the one private Assistant; bind current tenant/user session transitions and existing C01 accepted-person picker. Run five Flutter tests plus actual offline/account-switch/share/export/revoke flows.

The exact composition details and commands are in `services/gateway/src/work_artifacts/README.md`.
Known dependencies: U01 #519; U02 #520 (contract inspected at 36e412b59f080048a034aa0cffd697276e19f9ba); C01 #468; C07 #480; F12 #493; shared Work #497.
C04 #478 source was inspected at 9cd1f2f4dcd97a377cf40326d6faa9dc6129a333 for private-storage policy; no C04 implementation was copied into or replaced by U07.

## Security, retention and rollback

Tickets require both current authentication and current access; no public object URL. Recipient reads exclude private task/operation provenance and other grants.
Ready requires actual stored bytes. Unknown/failed generation never becomes success from a model statement. Recovery reads existing bytes only.
Previously delivered/exported copies cannot be revoked remotely; the UI explains this before export/revocation.
Text is inert; HTML-like strings are served as text/plain attachments and rendered as plain text.
Deleted metadata is retained for bounded late-PUT cleanup; physical-object and account erasure still require the integration worker and provider verification.
No applied migration or deployment to roll back. Keep capability/routes hidden until integration qualifies them. If later enabled, disable the capability/route admission and preserve cleanup evidence rather than dropping tables with live objects.

## Release gates

SOURCE_WRITTEN: yes for owned text-artifact modules and tests.
LOCAL_TESTED: yes for Node runtime/handler tests; no for Flutter/Fastify/PG.
CI_EXECUTED: unverified.
DB_INTEGRATED: no.
APP_INTEGRATED: no.
DEVICE_VERIFIED: no.
PROVIDER_QUALIFIED: no.
DEPLOYED: no.
MERGED: no.

Overall remains PARTIAL_IMPLEMENTATION because shared source composition is missing. Do not mark U07/K09 DONE or merge from the local tests alone.

Continuation checkpoint: account_erasure.ts, signed HEAD probe and 37 passing Node/HTTP/embedded-SQL cases pushed at 6c06eb23b4d1a64b46fa2fa6d1a62fa1c91c1c68. Six core modules pass strict TypeScript. Work dependency coordination posted to #497 comment 6072180656. Verifying the canonical composition next; shared files remain unclaimed.
