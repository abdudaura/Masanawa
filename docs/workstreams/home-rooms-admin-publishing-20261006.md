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

- Story Radio series visibility/order projection.
- News category visibility/pinning projection.
- Home Room visibility/order projection.
- Platform-assistant Home presentation projection.
- Revision-bound mutation intents for visibility, ordering, pinning and assistant presentation.
- Dedicated transport boundary; no direct database access.
- Controller with load, mutation serialization, optimistic revision checks and revision-advance enforcement.
- Responsive admin publishing page with loading/error/empty/stale states.
- Focused parsing, mutation-authority, controller and widget tests.

## Authority preserved

The client never fabricates publication truth and never performs direct SQL/database writes. Mutations carry the currently loaded revision and must be executed by the canonical authorized Ops/Gateway owner. Story Radio, News and Home projections remain owned by their canonical domains.

## Remaining shared-owner integration

- PR #129 / Ops owner mounts this page in the existing admin shell and implements `HomeRoomsPublishingTransport` through canonical authorized commands.
- Story Radio/News/Home domain owners expose their canonical read/write commands.
- #136 consumes only the resulting customer-facing projections; no admin mutation authority belongs in the customer app.

No further isolated Lane A implementation is required before those owners supply the canonical command endpoints.

## Commit trail

- claim: `01fcdaddae130c3822620a92d9c7478f22f046e3`
- models: `3efd44481adfd5b5559c37da0d6890425e446f95`
- page: `9acaca3f9b8e90d19bc267b7e9cc722456350838`
- model tests: `a35dbe721a2bdb733be62d067785c59f5ad6458f`
- page tests: `d20b96f974eda1535d4f3b8fcd5f539f732c4780`
- controller: `194c313d8bfa5d26480e3569e047f91407de543a`
- controller tests: `405b079b4263973b931100b385970d5860cbb7e5`

## Validation

No GitHub workflow was exposed for the latest isolated head at handoff time, so no CI pass is claimed. The module is intentionally dependency-light and isolated from shared admin/Gateway files.
