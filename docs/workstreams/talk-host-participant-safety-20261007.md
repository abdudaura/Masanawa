# Host participant safety controls — 2026-10-07

- Owner/window: current ChatGPT implementation window
- Branch: `work/talk-host-participant-safety-20261007`
- Base SHA: `6e7a7abae00116f3b797d9bd074d3a013fc6fe57`
- Task: complete Host-side participant Report/Block controls with server enforcement.
- Last repository-visible update: 2026-10-07T13:10Z

## Implemented

Canonical participant identity:
- Host moderation projection now carries optional canonical `userId`, `profileHandle`, and `personaId`.
- Human active Seats resolve `profileHandle` by joining the existing tenant-scoped `talks.public_profiles`.
- The synthetic Host row carries its canonical Host user ID.
- Expert/Twin Seats expose their canonical persona ID.
- These identifiers are only surfaced through Host-authorized moderation controls.

Server enforcement:
- Raise Hand checks the canonical safety preference where the Talk Host is the viewer and the raising human is the subject.
- A Host-blocked user receives `talks.blocked_by_host` / HTTP 403 and no Host request is created.
- Comment writes now also deny a user when that Talk Host has blocked them.
- Existing viewer→Host block/mute enforcement remains intact.
- Lowering an already raised hand remains possible because the new denial applies only to raising.
- No migration is required; enforcement reuses `talks.safety_preferences`.

Mobile safety:
- `TalkHostParticipant` now parses `userId`, `profileHandle`, and `personaId`.
- Talk safety transport now supports canonical generic profile/persona report targets in addition to Talk/replay reports.
- Host **Manage participants** menu now includes **Report** for non-Host participants with a canonical report target.
- Human Speaker reports target `profile` using the verified public profile handle.
- Expert/Twin reports target `persona` using the canonical persona ID.
- Human Speakers with both verified user ID + profile projection get **Block**.
- AI Seats never get a misleading human-user Block action.
- Block flow:
  1. explicit confirmation;
  2. durable Host→Speaker safety preference is written first;
  3. active Seat is removed through canonical moderation;
  4. Host controls refresh.
- If the block succeeds but live Seat removal fails, the UI says so explicitly and asks the Host to retry Remove.
- Host Seat remains immutable and never receives Report/Block menu actions.

## Verification coverage added

Gateway:
- accepted human Seat projection includes canonical `userId` and `profileHandle`;
- Host-blocked user cannot Raise Hand and no request insert occurs;
- comment SQL asserts inverse Host→commenter block guard;
- existing Host immutability remains covered.

Mobile:
- Host participant model parses human user/profile identity and AI persona identity;
- generic safety-report fake captures exact target kind/id/reason;
- Host reports human Speaker as profile target;
- Host blocks a human Speaker, writes the canonical safety preference and removes the Seat;
- Host reports Expert by persona identity;
- Expert has no Block action;
- existing Host mute/remove behavior now uses stable menu keys instead of private menu generic types.

## Product/authority invariants

- Report is private and goes through the canonical safety-report API.
- Block uses the existing safety-preference API; no second block list is introduced.
- Active Seat removal uses the existing Host moderation service and LiveKit enforcement.
- Human block does not apply to Expert/Twin persona identities.
- Host self-action remains impossible.
- No new migration, lifecycle authority, payment authority, or social graph is introduced.

## Status

- Implementation status: complete pending current-main resync/PR evidence.
- Verification status: focused backend/mobile regressions committed; repository CI execution evidence pending.
- Deployment status: not deployed.
- Handoff: compare against newest main/open claims, resync if behind, then open PR and inspect mergeability + workflow step evidence before merge.
