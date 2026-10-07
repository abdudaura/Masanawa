# Follow Talk participants — 2026-10-07

- Owner/window: current ChatGPT implementation window
- Branch: `work/talk-follow-participants-20261007`
- Base SHA: `f4410bd48b421a85ca302d158eb2da4c4cc0f309`
- Task: let listeners Follow/Unfollow verified human Talk participants from the Participants sheet.
- Exact owned paths:
  - `apps/mobile/lib/src/screens/talks/talk_more_sheet.dart`
  - focused Talk widget tests
  - this claim file
- Contract:
  - only human participant rows use the human social graph;
  - canonical participant user ID is resolved through existing user-ID profile/follow endpoints;
  - Expert/Twin remain AI-labeled with no human Follow action;
  - missing/unpublished human profile shows no fake follow target;
  - Host can still be followed through existing More action; participant-sheet follow stays consistent with it.
- Current step: make Participants sheet provider-aware and add per-human Follow/Following actions.
- Last update: 2026-10-07T15:14Z
- Status: active
