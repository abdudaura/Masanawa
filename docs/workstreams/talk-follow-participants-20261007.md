# Follow Talk participants — 2026-10-07

- Owner/window: current ChatGPT implementation window
- Branch: `work/talk-follow-participants-20261007`
- Base SHA: `f4410bd48b421a85ca302d158eb2da4c4cc0f309`
- Task: let listeners Follow/Unfollow verified human Talk participants from the Participants sheet.
- Last repository-visible update: 2026-10-07T15:17Z

## Implemented

- Existing Participants sheet is now provider-aware while preserving the same compact visual structure.
- Listener view resolves human rows through the existing canonical user-ID social-profile endpoint.
- Verified human profiles show **Follow** / **Following** in-row.
- Mutations reuse `setFollowingUserId` and invalidate the same profile provider used by the Host Follow action.
- Follow/unfollow updates in place and gives concise feedback.
- Human rows whose public profile does not resolve show no fake follow target.
- Expert/Twin rows remain explicitly AI-labeled and never call the human social graph.
- Host view of the Participants sheet stays read-only.
- Existing standalone **Follow Host** action in Talk More remains intact and shares the same canonical follow state.

## Verification coverage

- Production-like Talk fixture now includes Host + human Speaker + Expert.
- Social-profile fake tracks Host and Speaker follow state independently.
- Listener regression verifies:
  - Human · Speaker label;
  - Expert AI label;
  - Speaker Follow button exists;
  - Expert Follow button does not exist;
  - Follow → Following → Unfollow mutates only the Speaker.
- Host regression verifies the same participant sheet contains no Speaker Follow control.

## Invariants

- No backend/social-graph authority changed.
- No AI identity is treated as a human follow target.
- Missing/unpublished profiles fail closed by hiding the follow control.
- Self-follow remains protected by the existing server invariant and surfaces only friendly client failure if encountered.

## Status

- Implementation status: complete pending PR/CI evidence.
- Verification status: focused mobile regressions committed; repository CI execution evidence pending.
- Deployment status: not deployed.
- Handoff: compare against latest main/open claims, resync if behind, open PR, inspect workflow step evidence, then merge if safe.
