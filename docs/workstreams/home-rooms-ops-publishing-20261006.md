# Home/Rooms Ops publishing command seam

Status: ISOLATED OPS COMMAND CONTRACT COMPLETE — shared authorization/repository composition remains
Branch: `work/home-rooms-ops-publishing-20261006`
Base: `work/mobile-admin-app-20261005` / PR #129
PR: #227

## Ownership

Changed paths only:
- `services/ops/src/home_rooms_publishing.ts`
- `services/ops/src/home_rooms_publishing.test.ts`
- `docs/workstreams/home-rooms-ops-publishing-20261006.md`

No existing PR #129 Ops/app/auth file, PR #208 admin-mobile file, PR #213 Story Radio
admin file, Gateway/customer-mobile path, migration, direct SQL, production environment or
deployment file is edited.

## Completed

- Mandatory `HomeRoomsPublishingAuthorizer` on every read/write.
- Explicit publishing capabilities for News, Home Rooms and Home assistants. This seam
  grants no authority by itself; shared composition must deliberately map them into the
  canonical admin authorization policy.
- News category projection with its own revision.
- Home Room projection with its own revision.
- Assistant Home presentation projection with its own revision.
- Separate repository ports for each canonical authority; no synthetic aggregate store.
- News visibility and pin/clear-pin commands use the category's exact expected revision.
- Home Room visibility/order commands use the Room's exact expected revision.
- Assistant presentation uses the Character presentation's exact expected revision.
- Fail-closed target-id, revision, sort-order, display-name and assistant-position checks.
- Repository result must return the exact requested target and a newer target revision.
- Read authorization must resolve all three domains to the same Tenant before data is
  returned.
- Focused tests cover independent revisions, capability checks, mutation inputs,
  cross-target repository corruption/stale revision rejection and cross-Tenant read
  rejection.

## Story Radio boundary

Story Radio is deliberately absent. PR #213 owns its canonical admin publication endpoints
and publication authority. Do not route Story mutations through this generic service.

## Integration contract

PR #208 should replace its synthetic global `HomeRoomsPublishingProjection.revision`
with per-target revisions:
- `NewsCategoryAdminItem.revision`;
- `HomeRoomAdminItem.revision`;
- `AssistantHomePresentation.revision`.

Each mutation should send the revision of the exact target being changed. Story Radio
continues through #213's own command model.

PR #129/Ops shared composition must:
1. map these explicit publishing capabilities into canonical operator authorization;
2. implement the three repository ports using domain-owned storage/commands;
3. mount routes without bypassing the service;
4. return target-specific revisions after every accepted mutation.

## Verification

- changed-file audit is exactly the three claimed files;
- Foundation CI run `37453545166`, job `112235549940`, failed before checkout with
  `steps = null`; no code/test verdict is fabricated;
- Render external builds are currently unavailable because the workspace has exhausted
  build-pipeline minutes; no false executable pass is claimed.

**No further isolated implementation remains in this Ops command-contract slice.**
