# Twin Explore — Lane B

Owner/window label: ChatGPT Lane B / 2026-10-05
Branch: `work/twin-explore-20261005`
Base SHA: `65a801fbd96e53c803ab7d79a00b7ac6588c7e74`
Tasks: TWIN-020, TWIN-021, TWIN-022, TWIN-023, TWIN-024
PR: #142

## Exact owned paths

- `docs/workstreams/twin-explore.md`
- `apps/mobile/lib/src/agents/twin_directory.dart`
- `apps/mobile/lib/src/state/twin_directory_state.dart`
- `apps/mobile/lib/src/screens/explore/explore_screen.dart`
- `apps/mobile/test/twin_directory_test.dart`
- `services/gateway/src/twin_directory.ts`
- `services/gateway/src/twin_directory_routes.ts`
- `services/gateway/src/twin_directory.test.ts`

No shared router/chat/Gateway composition files, package root exports, migrations, Commerce,
billing, crypto, auth, or clone-onboarding paths are owned.

## Implemented

- TWIN-020: authorized tenant-scoped public twin search/lookup port and Gateway service;
  non-discoverable and cross-tenant source records fail closed.
- TWIN-021: compact Explore screen with search, refresh, empty/error states and public
  twin cards.
- TWIN-022: stable `publicId` lookup plus feature-local `resolveShare()` seam for the
  shared router/deep-link owner.
- TWIN-023: server projection fixes public text mode to `free`; mobile parsing rejects
  any directory projection that attempts to mark text as paid.
- TWIN-024: server and mobile projection explicitly label the representation `AI twin`
  and owner presence `not-present`; Explore explains that a separate owner session is
  required before the real person is represented as present.
- Public projection contains no owner User id, memory, voice price, payment authority or
  private Character configuration.

## Verification

- Claim was published and reread before implementation.
- Current `main` was rechecked after implementation and remains the base SHA above.
- Compare audit: branch is 9 commits ahead, 0 behind; exactly the eight claimed paths
  above are changed.
- Focused TypeScript and Flutter tests were added in
  `services/gateway/src/twin_directory.test.ts` and
  `apps/mobile/test/twin_directory_test.dart`.
- GitHub exposes no workflow runs for implementation head
  `42e8fb6358224175e8358e8a5e8fcc9605c5aef0`; therefore no executable hosted
  typecheck/test pass is claimed. The available connector does not provide a repository
  checkout/runtime, so fabricating a local pass would violate the evidence rules.

## Dependencies / handoff

Lane A must provide the durable privacy-reviewed `PublicTwinDirectorySource` backed by
the canonical public twin profile/discoverability projection. Lane I should then:
1. compose `registerTwinDirectoryRoutes` in shared Gateway composition;
2. bind `TwinDirectoryTransport` to authenticated Gateway requests;
3. mount `ExploreScreen` in the four-tab shell;
4. map stable public twin links to `resolveShare(publicId)` then the existing free-text
   twin conversation;
5. keep paid voice entry separate so free text cannot create a charge.

No migration is introduced and no deployment is claimed.

Last update: 2026-10-05.
Implementation: complete within Lane B ownership.
Verification: source/diff audit complete; executable runner evidence unavailable.
Deployment: not claimed.
