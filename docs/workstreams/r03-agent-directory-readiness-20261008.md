# R03 default-persona availability truth

Owner: ChatGPT R03 mobile directory window
Branch: `work/r03-agent-directory-readiness-20261008`
Base main: `265f2c5f6db81d076f57ca32dd47db3ff7fb0ad6`
Task: R03, truthful end-to-end agent presence projection and cache recovery. Does not claim that presence verifies voice-runtime readiness or provision the seventeen-persona roster.
Owned paths: `apps/mobile/lib/src/agents/agent_directory.dart`, `apps/mobile/lib/src/agents/agent_directory_cache.dart`, `apps/mobile/lib/src/state/agent_directory_state.dart`, `apps/mobile/test/agent_directory_readiness_test.dart`, `apps/mobile/test/agent_directory_fast_start_test.dart`, `services/gateway/src/agent_directory.ts`, `services/gateway/src/agent_directory.test.ts`, `docs/workstreams/r03-agent-directory-readiness-20261008.md`.
Shared dependencies: canonical voice/provider readiness and actual 17-persona provisioning remain separately owned; no shared Gateway composition, migrations, or worker changes. PR #411 owns only the root shell and its workstream; no path overlap.
State: bounded client availability parsing implemented; tests authored but not executed. Build/deployment/device status: not verified.
Last update: repository commits `f1972e4`, `b266ea0`, `4cb460f`, `334a60d` (2026-10-08).

## Implementation evidence and handoff

- Unknown/missing presence no longer defaults to `Available`; fail closed to `Offline`. The explicit `available` and recognized working/listening/on-call states remain intact.
- Non-string malformed `presence` no longer throws during JSON decoding and takes the same offline path.
- Focused unit tests cover explicit availability, missing, unknown, malformed presence, named states and JSON cache round-trip.
- This is not the complete R03 gate. The roster of seventeen AI personas, actual voice qualification, provider/worker readiness, and canonical server availability still need separately claimed implementation and executable integration evidence.
- Flutter/Dart executable tests were not run in the available connector environment. Do not merge this as a release gate without CI and device verification.

## Expanded R03 ownership claim

Found the Gateway projects `available` for every visible persona without an activity record. This is unverified availability. The new bounded scope will represent unknown presence honestly in Gateway/mobile, prevent persisted cached activity from implying current availability, and show pending Twins as unverified; none of these claims constitute runtime/audio qualification. This claim expansion precedes edits to added paths.

## Gateway-to-mobile presence correction (2026-10-08)

Implementation: `services/gateway/src/agent_directory.ts` no longer projects `available` when the authorized activity query has no record. It returns `unknown` (a distinct status, not an invented offline assertion); an explicit activity record retains its actual value. Presence remains informational and **does not certify inference, Gemini voice or paid Talk AI-Seat admission**. Gateway unit cases cover both situations.

Mobile: `AgentPresence.unknown` presents `Status unverified`; invalid/missing values also map there, while explicit offline remains Offline. Restored on-device directory snapshots have their live presence and work counts cleared; writes persist only non-live projection; sign-in transient outage and in-flight refresh clear stale active state. Newly previewed Twins remain unverified until a canonical directory refresh. Tests cover unknown parsing, immutable unverified snapshot, cached restore/outage/refresh and explicit recovery.

Owned commits: `cf92729`, `4afa22f`, `f156dc0`, `01ed00d`, `8c105b7`, `ab3ae8f`, `b80903a`, `bd0dd2d`, `bbbf7f4`. Source readbacks verified these changes on this branch; TypeScript/Vitest/Flutter tests are **authored but not executed**. Earlier CI failed before reported application steps; no production or Android proof. This is a bounded safety/projection hardening PR, not R03 full acceptance.

Remaining R03: 17-persona stable seed catalog/full profiles, provider and per-agent voice-readiness qualification, end-to-end first paid AI Seat, and service/device acceptance. Do not infer these from status or a draft PR. This lane's bounded changes are checkpointed and can be reviewed independently; no longer reserves server composition or other workstream paths.
