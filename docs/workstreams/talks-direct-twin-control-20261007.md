# Talk Direct Twin private control — 2026-10-07

- **Owner/window:** current ChatGPT transformation window
- **Branch:** `work/talks-direct-twin-control-20261007`
- **Base SHA:** `e2bcd10c0df534f7f176b7a27937ee9d71b07c23`
- **PR:** #367 — Add private Direct Twin control for live Talks
- **Lane:** private owner-only steering for an admitted Twin Seat
- **Lease:** released with implementation handoff

## Owned
- `services/gateway/src/talk_direct_twin/service.ts`
- `services/gateway/src/talk_direct_twin/service.test.ts`
- `services/gateway/src/talk_direct_twin/postgres_repository.ts`
- `services/gateway/src/talk_direct_twin/postgres_repository.test.ts`
- `services/gateway/src/talk_direct_twin_routes.ts`
- `services/gateway/src/talk_direct_twin_routes.test.ts`
- `packages/talks/migrations/0008_direct_twin_instructions.sql`
- this handoff

## Implemented
- Only authenticated canonical Twin owner can read/set/clear Direct Twin instructions.
- Target must be an admitted, non-removed Twin Seat; Expert Seats are rejected.
- Twin owner is resolved server-side from active `talks.talk_seats` -> `talks.persona_profiles.owner_handle` -> `talks.public_profiles.user_id`.
- Clients never nominate an owner identity.
- Instructions are bounded, revisioned and short-lived (default 5 minutes; configurable 10s–30m).
- Expired instructions read as empty rather than leaking stale steering.
- Compare-and-swap persistence rejects stale replacements/clears.
- Worker-side reader fails closed on owner mismatch, persona mismatch or expiry.
- Durable private store: `talks.direct_twin_instructions`.
- HTTP contract:
  - `GET /talks/:talkId/twin-seats/:seatId/direct`
  - `PUT /talks/:talkId/twin-seats/:seatId/direct`
  - `DELETE /talks/:talkId/twin-seats/:seatId/direct?expectedRevision=N`
- Public response shape does not manufacture Talk transcript/comment/Activity output.
- Language remains dynamic; no language preference is stored here.

## Tests
Focused tests cover:
- owner-only active Twin control;
- Expert/inactive/non-owner rejection;
- expiry;
- revisioned clear/set;
- worker fail-closed reads;
- no public-projection leakage;
- HTTP auth/set/read/clear validation;
- server-side Twin owner resolution;
- CAS SQL and conflict behavior.

## Integration handoff
- Register `registerDirectTwinRoutes` in shared Gateway composition after competing route work settles.
- Compose `createPostgresDirectTwinRepository` from the canonical Gateway PostgreSQL pool.
- Wire customer-session authorizer into `createDirectTwinService`.
- The merged live AI worker should call `readDirectTwinInstructionForWorker` immediately before persona invocation.
- Clear instructions when Seat is removed or Talk ends; TTL remains a second safety boundary.
- Never publish Direct Twin text into comments, captions, replay transcript, Activity or search.
- Mobile should expose this only to the owner of an active Twin Seat, as a compact private sheet/chat control.
- Host does not gain access merely because they Host the Talk unless they are also the Twin owner.

No mobile UI or production deployment was changed.

**Status:** Direct Twin private-control backend is end-to-end complete except shared composition/mobile wiring.
