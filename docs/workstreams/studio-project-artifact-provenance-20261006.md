# Studio project/artifact/provenance domain — Task 135

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/studio-project-artifact-provenance-20261006`
PR: #264
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Production task: 135 — Studio project/artifact/provenance domain.

## Coordination

No existing `packages/studio`, Studio branch, or Task 135 implementation PR was found at selection.

## Exact owned paths

- `docs/workstreams/studio-project-artifact-provenance-20261006.md`
- `packages/studio/package.json`
- `packages/studio/tsconfig.json`
- `packages/studio/tsconfig.build.json`
- `packages/studio/src/index.ts`
- `packages/studio/src/model.ts`
- `packages/studio/src/invariants.ts`
- `packages/studio/src/provenance.ts`
- `packages/studio/src/*.test.ts`

## Explicitly excluded/shared paths

- root lockfile/workspace metadata
- Gateway/Worker/Ops/mobile/Admin composition
- Task 136 rendering/voice/lipsync execution
- social publication and commerce domains
- storage migrations/adapters
- provider credentials and external media SDKs

## Acceptance target

- canonical StudioProject lifecycle;
- immutable StudioArtifact revisions;
- exact Tenant + Character ownership scope;
- bounded artifact kinds/media references;
- explicit parent lineage and source evidence;
- deterministic provenance chain with no hidden mutation;
- archived project cannot accept new artifacts;
- no provider/runtime execution semantics inside the domain.

State: ISOLATED COMPLETE / INTEGRATION READY.

## Completed implementation

- added canonical `@masanawa/studio` domain package using existing `media-project` and `media-artifact` canonical IDs;
- exact Tenant + Character project ownership scope;
- active/archive project lifecycle with stale-revision protection;
- immutable artifact revision records with bounded kind/media/content references;
- explicit parent-artifact lineage and source evidence;
- deterministic order-independent provenance hashing;
- runtime validation for deserialized artifact/source enums and SHA-256 evidence;
- archived projects reject new artifacts;
- cross-project/Character scope mismatch fails closed;
- self/same-future lineage and duplicate parents are rejected;
- Task 136 provider/render execution is intentionally absent.

## Remaining integration dependencies

1. workspace/lockfile owner must add the new package importer for frozen install/build;
2. storage owner must add repository/migrations for durable projects/artifact revisions;
3. Task 136 must consume immutable Studio artifacts rather than mutate them in place;
4. Social publishing may reference finalized artifacts but must not become Studio provenance truth;
5. executable CI remains required because hosted runners are currently failing before checkout.

Implementation head before handoff: `dd458052a1727d3253438d49e2c10b30f67cfffe`.

Last update: 2026-10-06.

## Verification

- Foundation CI run `37466993528`, job `112280416084`, on implementation/handoff head `28742014b461f12b89e2b4ed12cff96bb54c2474` failed before checkout with `runner_id=0` and `steps=[]`; no repository code executed.
- No pass is claimed from that CI result; executable typecheck/test/build remains required once hosted runner allocation recovers.
