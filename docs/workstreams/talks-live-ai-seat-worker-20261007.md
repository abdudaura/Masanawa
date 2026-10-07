# Live Talk AI Seat worker — 2026-10-07

- **Owner/window:** current ChatGPT transformation window
- **Branch:** `work/talks-live-ai-seat-worker-20261007`
- **Base SHA:** `fa16f586eff7bc6610cd2700118d1c0038828a8c`
- **Lane:** admitted Expert/Twin Seat -> live context/inference/audio publication orchestration
- **Lease:** active

Owned:
- `services/gateway/src/talk_ai_worker/**`
- focused tests
- this handoff

Not owned:
- shared Gateway composition
- LiveKit SDK dependency/lockfile
- AI Seat commerce/persistence
- Talk live persistence
- mobile UI
- replay/gifts/safety/search
- production deployment

Rules:
- Worker can start only for a canonically admitted Expert/Twin Seat.
- Human Host presence and `aiGenerationAllowed` are checked before inference and again before publish.
- Host reconnecting/ended, Seat mute/remove, or revoked commercial admission aborts publication immediately.
- Late inference/audio after revocation is discarded.
- Worker never becomes Host and never creates a Talk lifecycle.
- Comments/reactions are not automatically injected into AI context.
- Twin private Direct-Twin instructions are an explicit private control channel, not public transcript.
- Provider/model/voice selection remains server-side persona configuration.
- Media/provider adapters remain replaceable.

Status: implementing orchestration contract + race-condition tests.
