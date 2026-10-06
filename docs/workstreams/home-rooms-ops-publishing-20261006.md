# Home/Rooms Ops publishing command seam

Status: CLAIMED — 2026-10-06
Branch: `work/home-rooms-ops-publishing-20261006`
Base: PR #129 mobile admin control plane

Owned paths only:
- `services/ops/src/home_rooms_publishing.ts`
- `services/ops/src/home_rooms_publishing.test.ts`
- `docs/workstreams/home-rooms-ops-publishing-20261006.md`

Explicit exclusions:
- no edits to PR #129 existing shared Ops/app/auth files;
- no edits to PR #208 admin-mobile publishing files;
- no edits to PR #213 Story Radio admin files;
- no Gateway/customer-mobile/shared route files;
- no migrations, direct SQL, production environment or deployment.

Goal:
- define an authorization-gated Ops command boundary for News categories/pinning,
  Home Room visibility/order and platform-assistant Home presentation;
- use per-target/per-domain optimistic revisions, never one synthetic aggregate revision;
- keep storage/domain truth behind injected canonical repositories;
- Story Radio stays owned by #213.

This seam grants no authority by itself. Shared composition must supply an explicit
HomeRoomsPublishingAuthorizer before any read/write can execute.