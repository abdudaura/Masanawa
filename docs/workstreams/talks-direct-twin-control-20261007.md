# Talk Direct Twin private control — 2026-10-07

- **Owner/window:** current ChatGPT transformation window
- **Branch:** `work/talks-direct-twin-control-20261007`
- **Base SHA:** `e2bcd10c0df534f7f176b7a27937ee9d71b07c23`
- **Lane:** private owner-only steering for an admitted Twin Seat
- **Lease:** released with implementation handoff

## Owned
- `services/gateway/src/talk_direct_twin/service.ts`
- `services/gateway/src/talk_direct_twin/service.test.ts`
- this handoff

## Implemented
- Only authenticated canonical Twin owner can read/set/clear Direct Twin instructions.
- Target must be an admitted, non-removed Twin Seat; Expert Seats are rejected.
- Instructions are bounded, revisioned and short-lived (default 5 minutes; configurable 10s–30m).
- Expired instructions read as empty rather than leaking stale steering.
- Set/clear writes preserve exact owner + persona binding.
- Worker-side reader fails closed on owner mismatch, persona mismatch or expiry.
- Public response shape contains only revision/instruction/expiry and does not manufacture Talk transcript/comment/Activity output.
- Language remains dynamic; no language preference is stored here.

## Integration handoff
- Persist Direct Twin instructions in a private tenant/talk/seat store with compare-and-swap revision.
- Route authority must derive owner identity from the customer session, never request body.
- The live AI worker should read `readDirectTwinInstructionForWorker` immediately before persona invocation.
- Clear instruction when Seat is removed or Talk ends; expiry remains a second safety boundary.
- Do not publish Direct Twin text into comments, captions, replay transcript, Activity or search.
- Mobile should expose this only to the owner of an active Twin Seat, as a compact private sheet/chat control.
- Host does not gain access merely because they Host the Talk unless they are also the Twin owner.

No shared Gateway composition/routes, migration, mobile UI, AI worker files or production deployment were changed.

**Status:** Direct Twin private-control core complete.
