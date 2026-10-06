# Admin publishing target-revision correction

Status: CLAIMED — 2026-10-06
Branch: `work/admin-publishing-target-revisions-20261006`
Base: PR #208 current head

Owned continuation paths:
- `apps/admin_mobile/lib/src/home_rooms_publishing/**`
- `apps/admin_mobile/test/home_rooms_publishing/**`
- `docs/workstreams/admin-publishing-target-revisions-20261006.md`

Purpose:
- remove the unsafe synthetic global publishing revision from PR #208;
- add per-target revisions for News categories, Home Rooms and assistant Home presentation;
- make Story Radio read-only in this generic page because canonical Story publication is already owned by PR #213;
- validate stale mutations against the exact target revision before transport;
- verify the returned target revision advances after mutation;
- align the client with Ops command contract PR #227.

No shared admin shell/API route, Ops service, Story Radio #213, Gateway, migration,
production environment or deployment file is edited.