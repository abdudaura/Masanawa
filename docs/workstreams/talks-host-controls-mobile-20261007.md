# Talk Host controls mobile implementation — 2026-10-07

Owner/window: current ChatGPT implementation window
Branch: `work/talks-host-controls-mobile-20261007`
Base: `18af70f2a363d8207db612fa40883c1158297feb`

## Scope

Replace listener-only controls on Host Talk view with compact Host moderation controls.

Owned:
- mobile Host control models/transport/provider;
- Host Requests / Manage sheets;
- End Talk confirmation;
- Talk screen Host action-bar wiring;
- focused mobile tests;
- this handoff.

Not owned:
- live audio/media transport (#344/#345);
- Talk persistence migrations (#337);
- AI Seat payment/holds;
- backend Host moderation implementation;
- production deployment.

## Product rules

Host controls are compact:
- Requests
- Add AI
- Manage
- End

Human Speaker requests are free.
Sponsored AI requests never bypass Host approval.
Host may accept/decline requests and mute/remove active non-Host participants.
The Host itself cannot be removed through the moderation sheet.
End Talk is explicit and destructive.

Status: active.


## Implementation checkpoint

Implemented:
- Host Talk action bar now uses **Requests · Add AI · Manage · End**;
- listener-only **Raise hand** is no longer shown to the Host;
- pending request count is surfaced compactly on the Requests action;
- Requests sheet supports:
  - free human Speaker requests;
  - sponsored Expert requests;
  - sponsored Twin requests;
  - explicit Accept / Decline;
- Manage sheet lists active Seats and supports Mute / Unmute / Remove for non-Host participants;
- the Host row is immutable in the moderation sheet and has no self-removal menu;
- End Talk requires explicit destructive confirmation;
- live Host controls are not projected onto ended/replay mode;
- successful moderation refreshes Talk/Host state;
- failures are friendly and never show raw transport/provider errors;
- focused model and widget tests cover request acceptance, participant moderation,
  free human-seat semantics and explicit End confirmation.

## Mobile-facing backend contract

`GET /talks/:talkId/host-controls`

Host-authorized response:

`{ requests: [], participants: [] }`

Request projection:
- `requestId`
- `kind: human_speaker | sponsored_expert | sponsored_twin`
- `displayName`
- optional `detail`
- optional `avatarUrl`
- optional `amountLabel` for sponsored AI display only

Participant projection:
- `participantId`
- `displayName`
- `kind: human | expert | twin`
- `isHost`
- `isMuted`
- optional `avatarUrl`

`POST /talks/:talkId/host-requests/:requestId`

Body:
`{ action: "accept" | "decline" }`

Returns the refreshed Host controls projection.

`POST /talks/:talkId/host-participants/:participantId`

Body:
`{ action: "mute" | "unmute" | "remove" }`

Returns the refreshed Host controls projection.

`POST /talks/:talkId/end`

Ends live participation for the authenticated Host's Talk. The backend decides replay
publication and final lifecycle state.

## Required server invariants

- every route is authenticated, tenant-scoped and Host-authorized;
- the Host cannot moderate/end another user's Talk;
- the Host Seat itself cannot be removed through participant moderation;
- human Speaker admission is free;
- sponsored AI admission must consume only a valid paid/held request and never bypass
  canonical Commerce authorization;
- accept/decline/mute/unmute/remove/end are idempotent;
- capacity policy is enforced server-side (6 total / max 3 AI at launch defaults);
- ending a Talk disables new live participation and coordinates with the live-presence
  runtime rather than creating a parallel lifecycle authority.

A 404 on Host-controls read fails soft to an empty moderation sheet during rollout.
Mutations/end never pretend success when their backend route is unavailable.

Status: Host-controls mobile slice complete; backend moderation/end implementation is an independent lane.
