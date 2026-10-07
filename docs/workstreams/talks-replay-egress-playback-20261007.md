# Talk replay Egress + playback delivery — 2026-10-07

- **Owner:** current ChatGPT Talks backend window
- **Branch:** `work/talks-replay-egress-playback-20261007`
- **Base:** `52bdb56b717b50a6d543832933771572f246fcce`
- **Lane:** real LiveKit audio recording egress + S3-compatible private object custody + authenticated replay playback delivery
- **Owned paths:**
  - `services/gateway/src/talk_replay/egress/**`
  - `services/gateway/src/talk_replay/playback/**`
  - isolated replay service/route/composition additions
  - `packages/talks/migrations/0007_talk_replay_media.sql`
  - focused egress/playback tests
  - this workstream
- **Reuses:** merged replay persistence/runtime, LiveKit room credentials, existing Talk Host authority.
- **Not owned:** mobile files; AI Seat Commerce; global search; unrelated Billing/Crypto/Twin/channel code.
- **Security:** no permanent public object URLs; no storage credentials sent to clients; playback authorization remains tenant/Talk/replay-state scoped.
- **Status:** active.
