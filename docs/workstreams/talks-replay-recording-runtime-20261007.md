# Talk replay / recording runtime — 2026-10-07

- **Owner/window:** current ChatGPT replay runtime window
- **Branch:** `work/talks-replay-recording-runtime-main-20261007`
- **Base SHA:** `a2068fdd2d893044e7602d76aebd5df94bd5d77c`
- **Original claim:** `work/talks-replay-recording-runtime-20261007` from `025666690e41c8cde69ba67451591b0690fa220f`
- **Resynchronized:** 2026-10-07 09:50 UTC after Talk backend/runtime merges moved canonical `main`
- **Lane:** recording lifecycle + replay publication policy/state
- **Lease:** active

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

## Tests

Focused tests cover Host consent, disabled recording policy, ordered segment custody, overlap rejection, auto-publication rules, policy block, Host-only mutations, unpublish/discard, platform enforcement, empty recordings, terminal segment rejection, stale revisions, malformed checksums, duration bounds and backwards time.

## Status

Implementation complete on current-main synchronized branch. PR handoff pending final mergeability/CI evidence.
