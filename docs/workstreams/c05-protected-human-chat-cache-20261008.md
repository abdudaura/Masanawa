# C05 — Protected, indexed human-chat history and offline outbox

- Owner: ChatGPT, independent C05 mobile-performance lane.
- Branch: `work/c05-protected-human-chat-cache-20261008`
- Started: 2026-10-08T10:59:09.225Z (repository-visible lease; recheck current activity after 5 minutes).
- Base: main `5d19afc952b3dcabd18ee8f8d1c3ad13b72e6762`.
- Requirement refs: N02, P05, P07; J03, J04, J10, J11.
- Exclusive source paths: `apps/mobile/lib/src/messages/cache/**`, `apps/mobile/test/messages/cache/**`, `apps/mobile/pubspec.yaml` (only C05 SQLCipher dependency). No shared shell/route, Gateway app/main, provider/ledger, C01/C02 or CI workflow edits.
- Dependency: two incompatible active C02 branches both claim `0017`: `work/c02-durable-human-dm-20261008` vs `work/c02-private-text-core-20261008-gpt6`. These must be reconciled into one canonical API/schema before C05 may wire live synchronization into R17/C08 navigation. C01 is unmerged PR #468.
- CI block: #457 Actions budget; Flutter/Dart SDK unavailable in this execution environment. Do not report tests as run.
- Implementation target: encrypted per-account indexed local cache, stable message identity and paged history, safe pending outbox with crash-consistent request IDs, tombstones, bounded pruning, and account switch/sign-out removal. Build isolated component and relevant tests, then hand off shared root integration only to R17/C08.
- Status: CLAIMED / NOT VERIFIED. Never call this full C05 or J03/J10 DONE without real API, two-device/Android benchmark proof.
