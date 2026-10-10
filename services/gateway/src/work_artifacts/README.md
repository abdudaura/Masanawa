# U07 private text artifacts

This module produces **real UTF-8 `.txt` files only** (1–262144 bytes). It does not
accept PDFs, HTML rendering, executable files, arbitrary uploads, model URLs, or
claim antivirus scanning. Its content qualification is fatal UTF-8 validation,
control-character rejection, fixed MIME/extension, attachment disposition and a
plain text preview. Other formats need a separately qualified scanner/parser.

An artifact is `ready` only after PUT and a full stored-content SHA-256/size
readback. A lost write response becomes `failed`; `recover` reads the existing
object without repeating generation. Idempotent creation binds owner, request,
filename, exact content, lifetime and provenance. Metadata never contains bytes.

Access tickets last at most 60 seconds, require current authentication, bind
tenant/user/artifact/revision, and never grant a public S3 URL. Download proxies
bytes through Gateway, rechecks grant/block/state after storage I/O, and checks
the current session before emitting bytes **or filename/hash headers**. Revocation
cannot retract bytes already delivered or exported by a user.

## Composition the shared owner must apply

No shared source was modified. These are actual exported functions, not new
routes that claim to be active on main:

```ts
import { composeWorkArtifacts } from './work_artifacts/composition.js';
import { createArtifactS3 } from './work_artifacts/private_store.js';
import { registerArtifactRoutes } from './work_artifacts/routes.js';
import { createArtifactTaskAdapter } from './work_artifacts/task_adapter.js';
```

1. F11 assigns one migration filename to `schema.sql`, after
   `security.platform_user_profiles`; run the disposable DB test before manifest
   registration. The schema has a file journal, CAS revisions, grants and a
   DB-clock atomic cap of 20 creation attempts/account/UTC day. The global
   Gateway limiter must also cover ticket/read/share traffic. Daily retries
   intentionally consume the anti-abuse cap.
2. F18 calls `createArtifactS3` with **existing private storage** configuration
   and binds `composeWorkArtifacts({db,objects,ticketSecret,canShare,
   authorizeTask,admitCreation})`. Use canonical pool and a server-side dedicated
   random key, not provider credentials or client configuration as the key.
   `canShare` must check live accepted-person/block/deletion policy in both
   directions; `authorizeTask` must reread the current user-owned private U02
   task and exact operation; `admitCreation` is the existing global account
   quota/active-account guard. These callbacks have no permissive defaults.
3. Register `registerArtifactRoutes(app,{artifacts,authorizer})` with the
   **existing PlatformCustomerSessionAuthorizer** and auth-aware log redaction.
   Do not log request text or download tickets. Set AJV `removeAdditional:false`
   if the existing Gateway wants explicit rejection of unknown JSON fields;
   schema validation must never be disabled. Return safe typed errors.
4. Register U01 `files.create` version 1 through the U04 domain registry with
   `createArtifactTaskAdapter({service:artifacts,repository,readTask})` (the
   repository is `createArtifactRepository(db)`, same underlying store).
   `readTask` binds the U02 owner/session-aware `read({actor,taskId})` API.
   Call `persist(actor,taskId,{filename,text,ttlSeconds})` only after U02 has
   admitted `running`/`reconciling`. The adapter requires the private Assistant
   scope and actual generated content, maps the operation UUID into a stable
   canonical request ID, and emits U02 `confirmed` only after verified bytes.
   `reconcile` does status/readback only; it does not generate/upload again.
   No U01/U02 package exports, capability flags or schema are modified here.
5. Schedule `sweep()` in the elected worker with a bounded interval. Revocation
   and failed deletion persist; `deleted` tombstones are swept until expiry plus
   one hour to remove late PUTs. Keep per-operation storage timeout at 15 seconds.
   Test actual provider consistency/retention and bucket private/SSE policy.
6. F08 creates `accountErasure({isQuiesced,verifyErasure})` from the composed
   domain and calls it from its trusted deletion worker. `isQuiesced` must prove
   durable admission denial AND drainage of every admitted/uncertain provider
   PUT; a signed-out UI alone is insufficient. `verifyErasure` must qualify all
   retained versions/replicas under the actual provider policy. S3 `isAbsent`
   is only a HEAD readability probe: 404 alone cannot erase old versions.
   Start without a cursor, persist the returned `next` only on success, and
   repeat bounded 50-file batches while preserving the same durable fence.
   Never accept an HTTP/client cursor. On any exception retry the previous
   batch; tombstones are re-deleted, absence is verified, grants are cleared,
   and metadata is retained. `next:null` qualifies this fenced artifact scan,
   not whole-account completion. F08 must then remove artifact metadata/quota
   in its coordinated transaction before deleting the profile FK. This real
   source hook is not yet mounted in the account-deletion worker.
7. F12/C07 render `ArtifactCard` for real `media-artifact_*` result references;
   provide `GatewayArtifactTransport` the current canonical ApiClient and a
   synchronous signed-in tenant/user identity getter. Bind controller on every
   session transition; clear/dispose on logout, route/account change. Refresh
   metadata at mount; never pre-download or create a sixth tab. Bind the existing
   C01 accepted-person picker for Share; otherwise the control stays absent.
   Expired/failed results have no download action. Save uses the existing
   file_picker dependency and explicit user confirmation; preview stays in RAM.
   Account change after the OS save sheet receives bytes cannot erase a copy.

## API

All paths are Gateway-relative and require current bearer authentication.
All responses are `no-store, private`; no external links are returned.

| Method/path | Input/result |
| --- | --- |
| GET `/work-artifacts?after=...` | 30 owner rows, opaque canonical ID cursor |
| POST `/work-artifacts/text` | requestId, filename, text, ttlSeconds; always user-text provenance |
| GET `/work-artifacts/:id` | current owner/read-granted metadata |
| POST `/:id/recover` under same root | empty JSON; stored-object status check |
| POST `/:id/ticket` | empty JSON; actor-bound ticket and expiry |
| POST `/:id/download` | ticket JSON; verified text attachment bytes |
| POST `/:id/share` | revision, recipientUserId, ttlSeconds (60–86400) |
| POST `/:id/revoke` | revision; terminal access revocation |
| DELETE `/work-artifacts/:id` | durable deleting → deleted, idempotent retry |

`generatedText` is internal only. A caller cannot choose tenant/user or claim
operator provenance in the public creation body. Grants are capped at 20 and
never outlive the file. Stale sharing/revocation revisions return 409. Nonowners
cannot inspect other grants or private task/operation provenance.

## Executable evidence and limits

Run exact TypeScript runtime sources with Node 24 (type erasure, **not tsc**):

```sh
node --import ./services/gateway/src/work_artifacts/tests/register.mjs --test services/gateway/src/work_artifacts/tests/*.test.mjs
```

The 34 unit/handler cases use real temporary file I/O and injected metadata/
policy test doubles. Three additional executed integration cases cover real
Fastify 5.12.5 HTTP injection, exact SQL on PGlite 0.3.14 (embedded PostgreSQL
WASM), and HTTP -> SQL -> filesystem -> two-account share/revoke -> erasure.
All 37 pass. Embedded PostgreSQL is not a multi-process server/locking test;
session/contact adapters remain test doubles. No live S3 or Android claim.
Seven backend modules (including composition with exact main contracts) also pass TypeScript 5.9.3 with the repository's strict
compiler options and Node 24 typings. Full workspace/auth/routes build is
still a separate gate. Runtime type erasure initially missed a Buffer generic
inference incompatibility in S3 request bodies; the typed bounded byte copy fixes it.

Execute the additional dependency-backed harnesses explicitly:

```sh
node --import ./services/gateway/src/work_artifacts/tests/register.mjs --test services/gateway/src/work_artifacts/tests/fastify.integration.mjs services/gateway/src/work_artifacts/tests/embedded_postgres.integration.mjs services/gateway/src/work_artifacts/tests/flow.integration.mjs
MASANAWA_ARTIFACT_DISPOSABLE=yes MASANAWA_ARTIFACT_TEST_DATABASE_URL='<dedicated empty masanawa_test_* database>' node --import ./services/gateway/src/work_artifacts/tests/register.mjs --test services/gateway/src/work_artifacts/tests/postgres.integration.mjs
pnpm --filter @masanawa/gateway-service typecheck
cd apps/mobile
flutter analyze lib/src/work_artifacts test/work_artifacts
flutter test test/work_artifacts
```

The PG harness refuses nonempty/non-test databases and rolls back its DDL;
its profile prerequisite is a minimal FK fixture, not full platform migration
qualification. Multi-node CAS, simultaneous quota admissions, production S3
signing/read/revoke/cleanup and full canonical migrations need integration tests.

Status: **PARTIAL_IMPLEMENTATION / ISOLATED / DRAFT**, because final Gateway,
task/provider, deletion-worker and Flutter root composition are not applied.
