# R13 — Stable media stop-time and replay publication recovery

Owner: ChatGPT R13 isolated replay finalization lane.
Branch: `work/r13-replay-finalize-recovery-20261008`. Base main: `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`. Last update: 2026-10-08T06:16:06.812Z.
Exact owned paths: `services/gateway/src/talk_replay/egress/coordinator.ts`, `services/gateway/src/talk_replay/egress/coordinator.test.ts`, `services/gateway/src/talk_replay/egress/postgres_media_repository.ts`, new `services/gateway/src/talk_replay/egress/postgres_media_repository.test.ts`, and this claim.
No PRs currently edit these R13 paths. Own only replay media state/ordering; leave shared gateway routes/composition, other workstreams' database/migrations and Replay domain unchanged.

Observed bugs: a stopped media job's persisted completion time is ignored on later finalize retry, producing an inflated segment; replay can be published before the media job is marked ready; markReady does not require an existing stopped state, so it can resurrect an aborted job. Implement correct timestamp and atomic status guards with crash-replay test cases. Do not claim storage/deployment/Android acceptance without object-store, LiveKit and credentials.
Status: claimed/implementation pending; CI runner remains unqualified.
