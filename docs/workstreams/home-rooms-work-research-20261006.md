# Home/Rooms Lane W — Work & Research Rooms

Status: ISOLATED LANE COMPLETE — shared integration only remains
Branch: `work/home-rooms-work-research-20261006`
Base: `docs/home-rooms-launch-20261006`
PR: #202

## Ownership

This window owns only:
- `apps/mobile/lib/src/rooms/work_research/**`
- `apps/mobile/test/rooms/work_research/**`
- `docs/workstreams/home-rooms-work-research-20261006.md`

## Completed

- Added server-projected `WorkResearchRoomProjection` for the two launch presentations:
  - `work-business`
  - `research-answers`
- Added reusable server-owned quick-start contracts; the client emits only the opaque `intentId`.
- Added work/result projection with bounded statuses, 0..1 progress, artifacts and source evidence.
- Added HTTPS-only artifact/source link validation.
- Added source-aware evidence metadata including publisher and observation time.
- Added one reusable responsive Room screen for both presentations.
- Added loading, unavailable, stale-with-warning, retry and no-work states.
- Added typed callbacks for quick starts, artifacts and source evidence; no router/transport/Gateway assumptions.
- Added focused model tests for parsing, source awareness, HTTPS enforcement and progress bounds.
- Added focused widget tests for rendering, typed quick-start dispatch and retry behavior.

## Boundaries preserved

- No Workflow engine or research execution engine was created.
- No provider/Commerce truth is duplicated.
- No hard-coded Character IDs or financial behavior.
- No shared router, chat screen, Masanawa transport, Gateway composition, production environment or Commerce/Event migration edits.
- No Lane H, S, N, T, B, A or G paths were edited.

Rooms remain presentations over canonical Skills/runtime/Commerce.

## Validation

Repository workflows fired on the implementation head, but both failed before checkout:
- Mobile Build run `37444467749`: job has `steps = null`.
- Foundation CI run `37444467618`: job has `steps = null`.

This matches the known hosted runner-allocation failure and is not a code/test result. The current execution container has no Flutter/Dart SDK, so no false local pass is claimed.

## Remaining integration dependencies

Owned by shared integration/production lanes, not Lane W:
- #136 wires Home/Room navigation/deep links.
- #136 or its transport owner loads the canonical Work/Research server projection.
- canonical runtime/Workflow/Skill execution resolves opaque quick-start `intentId` values.
- artifact opening/downloading and source-link launching are supplied by the shared app integration layer.
- Activity/Wallet may later project canonical outcomes; Lane W does not write those systems.

No further isolated Lane W implementation is required before shared integration.

## Commit trail

- claim: `87824fa0936277620ec348fbffa6cd5bc92517e7`
- models: `789907d565b4483c10c54e844fd0dc79c8a4014f`
- Room screen: `74fcac1739957ba8a4ba36938f8fa84fd7e46891`
- model tests: `d5184d903e951241d9cca5e521f475056f3454da`
- widget tests: `d08c819fb72536a22648c9a018144af10b183970`
