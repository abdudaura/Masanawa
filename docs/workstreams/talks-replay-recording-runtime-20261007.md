# Talk replay / recording runtime — 2026-10-07

- **Owner/window:** current ChatGPT replay runtime window
- **Branch:** `work/talks-replay-recording-runtime-main-20261007`
- **Base SHA:** `a2068fdd2d893044e7602d76aebd5df94bd5d77c`
- **Original claim:** `work/talks-replay-recording-runtime-20261007` from `025666690e41c8cde69ba67451591b0690fa220f`
- **PR:** #349 — Add Talk recording and replay publication runtime
- **Last repository-visible update:** 2026-10-07 09:52 UTC
- **Lease:** released with implementation handoff

## Owned paths

- `packages/agents/src/talk-replay.ts`
- `packages/agents/src/talk-replay.test.ts`
- one export-only addition to `packages/agents/src/index.ts`
- `docs/workstreams/talks-replay-recording-runtime-20261007.md`

## Explicitly not owned

- `apps/mobile/**`
- `services/gateway/**`
- `packages/talks/**` persistence/migrations
- actual WebRTC/SFU/media transport
- object/blob storage adapters
- live-presence/admission runtime owned by PR #345
- Host moderation backend
- Commerce/Billing/Crypto/Twin/channel foundations
- shared lockfile, production config or deployment

## Implemented invariants

- Recording creation requires explicit human Host consent and current server recording policy.
- Segment manifests are bounded, ordered, sequential, non-overlapping and checksummed; media references are opaque adapter metadata, never public URLs.
- Ending the live Talk finalizes recording; replay publication does not create or extend live state.
- Host preference can auto-publish only when policy allows and at least one media segment exists.
- Empty/incomplete recording never becomes a public replay.
- Only the recorded Talk Host can publish, unpublish or discard.
- Platform enforcement can publication-block a finalized replay and the Host cannot override or discard that blocked evidence.
- Publish/unpublish/discard/platform-block transitions are revision-guarded.
- Replays can be private or unpublished without deleting finalized recording custody.
- This runtime consumes terminal live outcomes but does not duplicate PR #345 live-presence authority.

## Verification

- PR #349 is reported **mergeable** by GitHub against current `main`.
- Foundation CI run `37603277231` failed before creating any workflow steps; job `112732570159` has an empty step list and no job logs. This matches the existing repository-wide zero-step CI infrastructure failure already documented by the Talk backend/runtime lanes.
- Focused tests are committed for:
  - Host consent and disabled recording policy;
  - ordered segment custody and overlap rejection;
  - auto-publication vs private preference;
  - server publication policy block;
  - Host-only publish/unpublish/discard;
  - platform enforcement and Host non-override;
  - empty-recording non-publication;
  - terminal segment rejection;
  - stale revisions;
  - malformed checksum and duration bounds;
  - backwards transition time.
- Diff against current main is isolated to the four claimed paths.
- No production deployment, Gateway composition, persistence migration or media storage operation was performed.

## Handoff

The next replay integration owner should:
1. persist `TalkReplaySession` revisions atomically;
2. feed finalized media-segment metadata from the real media plane;
3. call `live_finalized` only from the canonical Talk/live terminal outcome;
4. project only `isReplayPubliclyVisible(session) === true` into public replay discovery;
5. preserve Host-only publish/unpublish/discard checks at the authenticated service boundary;
6. map platform moderation enforcement to `platform_block`;
7. keep media authorization/storage URLs outside this public runtime contract.

**Implementation status:** complete for the claimed replay/recording runtime slice.
