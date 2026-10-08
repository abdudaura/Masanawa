# R02 / R19 — LiveKit agent dispatch identity fencing

Owner/window: ChatGPT new R02 LiveKit dispatch lane; branch `work/r02-livekit-dispatch-identity-fence-20261008`; base main `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`.

Task: R02 AI audio routing and R19 persona identity safety. Last update: 2026-10-08T06:11:42.845Z.
Exact owned paths: `services/gateway/src/talk_ai_worker/livekit_dispatch.ts`, `services/gateway/src/talk_ai_worker/livekit_dispatch.test.ts`, `docs/workstreams/r02-livekit-dispatch-identity-fence-20261008.md`. No shared Gateway composition, migrations, LiveKit worker or PR #448 `worker.ts` edits.

Conflict check: live open PR files reviewed; no matching paths. Five-minute rule applies; claim is published in draft PR before implementation.

Observed issue: dispatcher compares only Seat ID; an existing AI dispatch can be wrongly reused after persona/tenant/kind changes. List/create can also race under concurrent requests and ambiguous CreateDispatch outcomes. Implement full metadata matching, fail-closed mismatch, bounded input, safe concurrent replay, and deterministic adapter tests. No fake audio availability or provider credential claims.

Status: CLAIMED. Tests/build/deployment/device not yet verified.
