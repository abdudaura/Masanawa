# Twin public-memory safety — TWIN-093

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/twin-public-memory-safety-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
PR: #223
Task: TWIN-093 — protect private owner memory from public Twin responses.
Roadmap references: `docs/TWIN-TRANSFORMATION-TASKS.md`, `docs/TWIN-MULTI-WINDOW-EXECUTION.md`, PR #148 representational-memory handoff.

## Exact owned paths

- `docs/workstreams/twin-public-memory-safety-20261006.md`
- `packages/memory/src/public-twin-context.ts`
- `packages/memory/src/public-twin-context.test.ts`

## Excluded/shared paths

Not owned and not changed:

- `services/gateway/src/app.ts`
- `services/gateway/src/main.ts`
- mobile router/chat/transport/APK paths
- production environment/configuration
- migrations and PostgreSQL repository schemas
- `packages/memory/src/index.ts` root export seam
- Identity, Commerce, Billing, Crypto, Workflow and provider-owned paths
- PR #136 production integration paths

## Completed implementation

- Added a single public-Twin context compiler that constructs the authorized scope predicate internally from canonical `character-shared` Memory for the represented Character.
- Rejects cross-tenant candidates, owner-private Character memory, Relationship-private memory and another Twin's shared memory before context compilation.
- Rejects a mixed public/private candidate batch rather than silently filtering it.
- Reuses the canonical `compileMemoryContext` path so token budgeting, deduplication and provenance remain unchanged.
- Preserves exact Memory record/revision/source-content provenance in the compiled public context.
- Added focused strict-TypeScript tests for the allowed path, each private/leakage path, mixed-batch rejection and provenance preservation.

## Changed-file audit

PR #223 changes exactly the three owned paths above. No shared Gateway/mobile/router/APK, migration, production environment, Commerce or provider files are changed.

## Verification

- Source/type audit completed against `packages/memory/tsconfig.json`, strict root TypeScript settings, canonical Memory fusion/context/projection contracts and the existing PR #148 representation boundary.
- Foundation CI run `37452572382` on implementation head `4cd1c9cfc63e94faf77abd5b0298c682c787f3d1` failed before checkout with `runner_id=0` and `steps=[]`. No repository code executed, so this is recorded as hosted-runner non-execution rather than a code verdict.
- Final branch head after this handoff update is the commit produced by this documentation update.

## Remaining dependencies

1. Memory/export owner: append-only export of the completed public context boundary through `@masanawa/memory` when shared root-export ownership is available.
2. Shared Gateway/runtime owner (#136 or explicit successor): use this compiler for public Twin inference/retrieval composition; do not compose owner Relationship/private scopes.
3. Executable CI remains needed when GitHub runner allocation recovers.

State: ISOLATED COMPLETE / INTEGRATION READY.
No further isolated implementation remains in this lane.

Last update: 2026-10-06.
