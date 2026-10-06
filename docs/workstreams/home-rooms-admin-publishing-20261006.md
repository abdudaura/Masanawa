# Home/Rooms Lane A — Admin publishing

Status: ISOLATED ADMIN PUBLISHING COMPLETE — canonical command execution integration remains
Branch: `work/home-rooms-admin-publishing-20261006`
Base: `work/mobile-admin-app-20261005` (admin control-plane PR #129)
PR: #208

## Ownership

This lane changes only:
- `apps/admin_mobile/lib/src/home_rooms_publishing/**`
- `apps/admin_mobile/test/home_rooms_publishing/**`
- `docs/workstreams/home-rooms-admin-publishing-20261006.md`

## Completed

- Story Radio series publication visibility/order projection.
- News category visibility/pinning projection and explicit pin/clear-pin admin control.
- Home Room visibility/order projection and reorder controls.
- Platform-assistant Home presentation projection and editable display-name/left-right/visibility controls.
- Revision-bound mutation intents for visibility, ordering, pinning and assistant presentation.
- Dedicated transport boundary; no direct database access.
- Controller with load, mutation serialization, optimistic revision checks and revision-advance enforcement.
- Mutation controls are disabled while a command is in flight.
- Mutation intents reject blank target IDs, zero/negative revisions, blank News pin IDs and blank assistant display names before transport.
- Responsive admin publishing page with loading/error/empty/stale states.
- Focused parsing, mutation-authority, controller and widget tests, including the previously missing reorder/pin/assistant UI paths.

## 2026-10-06 takeover audit

The prior handoff marked Lane A complete, but the UI only exposed publication visibility. The declared mutation contracts for:
- Home Room reordering;
- News pinning;
- assistant Home presentation;

were not reachable from the page.

This continuation closed those isolated gaps without touching the admin shell, Story Radio/News domain implementations, Gateway composition, Commerce/Event migrations, production environment or PR #136 mobile/APK ownership.

Implementation continuation commits:
- complete publishing controls: `8a330dc81fc1c07b780ca3540282cf2b55e5dbdd`
- widget coverage: `2ec5958e604a9e155d6ed5b486e64e58160ca607`
- fail-closed mutation intent validation: `db9623b2d1fd83926ea6a7854e9a2ca9d63367f1`
- mutation validation coverage: `e0b7d6c4e521636d2d4e259fdd9a99e3ec79c5ee`

## Authority preserved

The client never fabricates publication truth and never performs direct SQL/database writes. Mutations carry the currently loaded revision and must be executed by the canonical authorized Ops/Gateway owner. Story Radio, News and Home projections remain owned by their canonical domains.

## Remaining shared-owner integration

Only cross-owner integration remains:

- PR #129 / Ops owner mounts this page in the existing admin shell and implements `HomeRoomsPublishingTransport` through canonical authorized commands.
- Story Radio owner exposes/retains canonical authorized publication commands. The active Story Radio runtime currently models Series plus Episodes carrying `seasonNumber`/`episodeNumber`; it does not expose a separate Season entity or a standalone series-order command. Lane A must not invent those domain authorities.
- News owner exposes canonical category visibility/pinning commands.
- Home/#136 integration owner exposes canonical Home Room visibility/order and assistant-presentation commands and consumes only resulting customer projections.
- If Story Radio later adds explicit series ordering or a first-class Season command, the domain owner must define that canonical command first; Lane A can then project it without owning Story Radio truth.

No further isolated Lane A source implementation is required before those owners supply/mount the canonical command endpoints.

## Commit trail before takeover

- claim: `01fcdaddae130c3822620a92d9c7478f22f046e3`
- models: `3efd44481adfd5b5559c37da0d6890425e446f95`
- page: `9acaca3f9b8e90d19bc267b7e9cc722456350838`
- model tests: `a35dbe721a2bdb733be62d067785c59f5ad6458f`
- page tests: `d20b96f974eda1535d4f3b8fcd5f539f732c4780`
- controller: `194c313d8bfa5d26480e3569e047f91407de543a`
- controller tests: `405b079b4263973b931100b385970d5860cbb7e5`

## Validation

- Branch diff remains confined to the declared Lane A-owned paths.
- GitHub Foundation CI run `37447676651` on implementation head `e0b7d6c4e521636d2d4e259fdd9a99e3ec79c5ee` failed before checkout: job `112216321822` has `steps = null` and no logs. This is the repository's known hosted-runner allocation failure and is not a code test verdict.
- The current execution environment has no network path to clone the private repository and therefore cannot run Flutter locally. No test pass is fabricated.
