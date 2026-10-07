# Human Talk invitations — 2026-10-07

- Owner/window: current ChatGPT implementation window
- Branch: `work/talk-human-invitations-20261007`
- Base SHA: `31b49fbeb88b64531aea430c7c6f233b0c0b97ce`
- Task: implement the required Host **Invite human** control end to end.
- Last repository-visible update: 2026-10-07T14:50Z

## Implemented

Persistence:
- Added `packages/talks/migrations/0013_human_invitations.sql`.
- One durable invitation per tenant + Talk + invitee user.
- Status: `pending | accepted | declined`.
- Stores canonical Host user ID, invitee user ID, verified public handle/display name and timestamps.
- Re-sending a non-accepted invitation is idempotent and returns it to pending.
- An already accepted invitation cannot be silently reset.

Host send:
- Added authenticated `POST /talks/:talkId/invitations` with `{ handle }`.
- Host identity always comes from the authenticated platform session.
- Target resolves only through tenant-scoped `talks.public_profiles`.
- Host cannot invite itself.
- Existing active human Seat cannot be invited again.
- Ended/non-live Talks cannot send invitations.
- Existing Host↔invitee block/mute safety relationships make the invitee unavailable.
- Human invitations are free; no Commerce path is involved.

Recipient decision:
- Added authenticated `POST /talks/:talkId/invitation-response` with `accept | decline`.
- Recipient identity always comes from the authenticated session; no caller-supplied user ID.
- Decline grants no Seat.
- Accept rechecks relationship safety and live state.
- Accept uses the existing canonical `human_seat_admitted` Talk transition.
- Acceptance persists a durable active human Talk Seat and accepted participation state.
- Any already-connected LiveKit session is promoted to Speaker/publish authority.
- The same canonical launch capacity policy is reused; no second Seat authority.

Activity delivery:
- Human invitation send upserts a single actionable `talk_invitation` Activity item:
  - title identifies the Host;
  - detail identifies the Talk and free human Speaker Seat;
  - `requiresAction=true`;
  - action label `Respond`.
- Accept/decline resolves the same Activity ID with `requiresAction=false`.
- Production Gateway composition uses the existing `talks.activity` repository; no parallel notification dashboard.

Mobile Host UX:
- Existing Host **Manage participants** sheet now has a compact **Invite** action.
- Host enters a verified profile handle such as `@amina`.
- Client strips a leading `@` and sends the canonical handle.
- Success message confirms the target handle; errors stay user-friendly.
- Permanent Talk action bar remains compact; no fifth primary control was added.

Mobile recipient UX:
- Actionable Talk invitations in Activity show explicit **Decline** and **Accept** buttons.
- Decision posts directly from Activity.
- Activity refreshes in-place after resolution.
- Successful decision shows a concise confirmation.
- Opening the Talk remains separately available through the existing Activity target.

## Verification coverage added

Gateway:
- route test covers Host invitation send by profile handle;
- route test covers authenticated recipient accept/decline;
- PostgreSQL test covers verified-profile invitation persistence;
- PostgreSQL test covers canonical free human Seat admission + connected-session publish promotion;
- existing Host moderation/free-seat/immutability tests remain.

Mobile:
- Host controls fake records exact Talk + handle invitation payload;
- Host Manage widget test sends `@amina` and verifies canonical `amina`;
- Activity fake tracks decisions and removes action state after mutation;
- Activity widget tests cover Accept and Decline directly from the feed;
- failing Activity transport satisfies the expanded interface without exposing raw errors.

## Invariants

- Every public Talk still has a real human Host.
- Human Seats remain free.
- Invitation acceptance never bypasses canonical Talk capacity or live-state transitions.
- No AI Seat Commerce logic is reused for humans.
- No fake notification-only invitation exists: Activity action resolves durable invitation state and grants the Seat on accept.
- Safety is checked on both send and acceptance.
- No existing Raise Hand flow is replaced; invitations are Host-originated while Raise Hand remains listener-originated.

## Status

- Implementation status: complete pending current-main resync/PR evidence.
- Verification status: focused backend/mobile regressions committed; repository CI execution evidence pending.
- Deployment status: not deployed.
- Handoff: compare against newest main/open claims, resync if behind, then open PR and inspect mergeability + workflow step evidence before merge.
