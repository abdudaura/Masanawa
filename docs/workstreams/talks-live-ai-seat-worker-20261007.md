# Live Talk AI Seat worker — 2026-10-07

- **Owner/window:** current ChatGPT transformation window
- **Branch:** `work/talks-live-ai-seat-worker-20261007`
- **Base SHA:** `fa16f586eff7bc6610cd2700118d1c0038828a8c`
- **Lane:** admitted Expert/Twin Seat -> live context/inference/audio publication orchestration
- **Lease:** released with implementation handoff

## Owned
- `services/gateway/src/talk_ai_worker/worker.ts`
- `services/gateway/src/talk_ai_worker/worker.test.ts`
- this handoff

## Implemented
- AI worker can run only for a canonically admitted Expert/Twin Seat.
- Admission also requires active commercial authorization.
- Human Host presence and `aiGenerationAllowed` are checked before inference.
- The worker re-reads both live state and Seat state after inference and before publish.
- Host reconnect/end, Seat mute/remove, or commerce revocation during inference suppresses the late reply.
- Worker stop aborts in-flight work and prevents publication.
- Expert Direct-Twin instructions are discarded; only Twin Seats receive the explicit private Direct Twin instruction channel.
- Comments/reactions are not automatically included in the worker input.
- Persona runtime and audio publication are provider-neutral ports.
- The worker never creates/extends a Talk or becomes Host.

## Tests
Focused race tests cover:
- normal admitted publication;
- Host absent before inference;
- muted/removed/revoked Seat before inference;
- Host disconnect during inference;
- mute/remove/revoke during inference;
- Twin-only Direct Twin instructions;
- worker shutdown while inference is in flight;
- empty and oversized transcript handling.

## Integration handoff
1. Media adapter should deliver canonical human speech/transcript turns to `handleTurn`.
2. Persona adapter should bind `personaId` to the canonical Expert/Twin runtime and server-side model/voice config.
3. Audio adapter should publish only under the admitted AI participant identity in the Talk's LiveKit room.
4. LiveKit mute/remove/end callbacks must update the canonical Seat/live repositories consumed by this worker.
5. Do not bypass the pre/post state reads even if the media adapter believes the room is still live.
6. Gemini/voice/provider credentials remain server-side.
7. A concrete LiveKit media adapter should reuse existing room/token credentials rather than create a second room lifecycle.

No shared Gateway composition, SDK dependency/lockfile, live persistence, commerce, mobile UI or production deployment was changed.

**Status:** AI Seat worker orchestration and anti-late-publish safety complete.
