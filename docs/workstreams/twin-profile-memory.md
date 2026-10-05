# Twin profile and representational memory — Lane A

Owner/window label: ChatGPT Lane A / 2026-10-05
Branch: `work/twin-profile-memory-20261005`
Base SHA: `c00de8cf7845c3a4caa39f088539c547e6a76b87`
PR: #148
Tasks: TWIN-010, TWIN-011, TWIN-012, TWIN-013, TWIN-014.
TWIN-015 remains with the active My Twin/onboarding owners (#145/#123) to avoid overlapping their files.

## Exact owned paths

- `docs/workstreams/twin-profile-memory.md`
- `packages/identity/src/twin-profile.ts`
- `packages/identity/src/twin-profile.test.ts`
- `packages/memory/src/representation.ts`
- `packages/memory/src/representation.test.ts`
- `services/gateway/src/twin_profile.ts`
- `services/gateway/src/twin_profile_routes.ts`
- `services/gateway/src/twin_profile.test.ts`

No package root exports, existing Identity/Postgres repositories, migrations, Gateway app/main,
mobile router/chat, My Twin/onboarding files, Commerce, billing or crypto files are owned.

## Implemented

- TWIN-010: bounded public twin profile contract with discoverability and a public-only
  projection that excludes owner User identity and internal revision/private configuration.
- TWIN-011: normalized stable `publicId` share identity with an invariant preventing
  profile revisions from changing tenant, owner, Character or public share id.
- TWIN-012: public twin representation predicate admits only the exact twin's
  `character-shared` Memory scope; relationship, character-private, session, task,
  cross-tenant and another Character's shared memory fail closed.
- TWIN-013: conversational profile customization supports bounded display name, bio,
  interests, languages, HTTPS avatar and discoverability changes with optimistic revision custody.
- TWIN-014: discoverability changes are standing changes and require explicit owner
  confirmation before application; preview returns the exact confirmation requirement.
- Isolated Gateway read/preview/apply service and route registrar are ready for the shared
  integration owner. Stable identity changes returned by a store are rejected.
- Focused Identity, Memory and Gateway tests cover privacy projection, immutable share id,
  confirmation gating, scope leakage, stale revision and forged/out-of-scope store results.

## Verification

- Claim was published and reread in draft PR #148 before implementation.
- Current `main` was rechecked after implementation and remains the base SHA above.
- Compare audit: branch is 8 commits ahead, 0 behind and exactly the eight claimed paths
  above are changed.
- Foundation CI run `37289561266` completed as failure before executing any step:
  job `111696500785` has `steps: null`. This is runner allocation/non-execution, not
  a code test result.
- An independent container checkout was attempted, but outbound DNS/network access is
  disabled in that runtime (`Could not resolve host: github.com`), so an executable
  local typecheck/test pass cannot honestly be claimed from this session.

## Integration handoff

1. Identity/storage owner: add an append-only durable profile table/repository and export
   `twin-profile.ts` only after migration numbering/ownership is explicitly reconciled.
2. Memory/runtime owner: export `representation.ts` and use
   `createPublicTwinRepresentationPredicate()` for public twin context retrieval; never
   include owner Relationship/private scopes in public twin inference.
3. Gateway integration owner: compose `registerTwinProfileRoutes` with authenticated
   PlatformSession authority and an adapter over the canonical profile repository.
4. Lane B / Explore: back `PublicTwinDirectorySource` from discoverable
   `PublicTwinProfileProjection` records; do not use the internal agent directory.
5. My Twin/onboarding owner (#145/#123): consume read/preview/apply customization and fold
   the first-run transition into My Twin for TWIN-015 without deleting the verified
   onboarding transport until parity is proven.

No migration, shared export/composition or deployment is claimed.

Last update: 2026-10-05.
Implementation: complete within safe Lane A ownership.
Verification: source/diff audit complete; executable runner evidence unavailable.
Deployment: not claimed.
