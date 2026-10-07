# Talk Direct Twin private control — 2026-10-07

- **Owner/window:** current ChatGPT transformation window
- **Branch:** `work/talks-direct-twin-control-20261007`
- **Base SHA:** `e2bcd10c0df534f7f176b7a27937ee9d71b07c23`
- **Lane:** private owner-only steering for an admitted Twin Seat
- **Lease:** active

Owned:
- `services/gateway/src/talk_direct_twin/**`
- focused tests
- this handoff

Not owned:
- shared Gateway routes/composition
- Twin profile persistence
- Talk/Seat persistence
- mobile UI
- AI worker files
- migrations/deployment

Rules:
- Only canonical Twin owner can write/clear instructions.
- Target must be an admitted active Twin Seat; Experts cannot be directed.
- Instruction is private control data, never a public comment/transcript/activity payload.
- Instructions are revisioned, bounded and short-lived.
- Worker reads latest active instruction by tenant/talk/seat only.
- Removed/muted/ended Seat integration should stop consumption; this store does not create live authority.
- Clearing/replacing uses expected revision custody.
- No language preference is hardcoded; instruction text is free-form owner intent.

Status: implementing.
