# Talk replay / recording runtime — 2026-10-07

- **Owner/window:** current ChatGPT replay runtime window
- **Branch:** `work/talks-replay-recording-runtime-20261007`
- **Base SHA:** `025666690e41c8cde69ba67451591b0690fa220f`
- **Claim published:** 2026-10-07 09:42 UTC
- **Lane:** recording lifecycle + replay publication policy/state
- **Lease:** 5 minutes from latest repository-visible work

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
- live-presence/admission runtime currently owned by PR #345
- Host moderation backend
- Commerce/Billing/Crypto/Twin/channel foundations
- shared lockfile, production config or deployment

## Product invariants

- Replays derive from a real human-hosted Talk; replay policy never creates a live Talk.
- Recording begins/continues only when publication policy allows recording and a human Host has authorized the Talk recording state.
- Ending the live Talk finalizes recording; replay publication is a separate explicit state.
- Replays can be withheld, published, or later unpublished without rewriting recorded media custody.
- Platform enforcement can block publication even when the Host requested replay.
- Segment manifests are metadata only; this lane does not own media bytes/storage URLs.
- Participant identity/seat labels are preserved as durable replay metadata supplied by the owning adapter.
- State transitions are revision-guarded and deterministic for CAS persistence/replay.

## Status

Claim active. Implementation starting.
