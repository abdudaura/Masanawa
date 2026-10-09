# F17/C04 — bounded private voice streaming and account-switch readback

Updated UTC: 2026-10-09T04:09:37.086Z. Owner: GPT-6 F17 exact-path mobile transport continuation.
**Status: PARTIAL_IMPLEMENTATION; DRAFT / UNMERGED / NOT DEPLOYED.** This is one security/performance fix inside the existing C04 implementation, **not** completion of end-to-end private voice messaging.

## Canonical ownership and immutable SHA evidence

- Existing draft: https://github.com/Baatiku/masanawa/pull/478; branch `work/c04-private-voice-notes-20261008`. **Do not duplicate C04 schema, media backend or routes.**
- Inspected latest main: `5e758673ae91082520b21b3153da53791ae2cbf3`. The existing PR was branched at older `5d19afc952b3dcabd18ee8f8d1c3ad13b72e6762`; leave rebase/merge to the integrator. Pre-continuation PR source HEAD `f0d67698782002f292a1ba744a5430c5d7371bab`, last live visible change 2026-10-09T03:03:58Z, over five minutes before this claim.
- Five-minute claim committed `57410a1af4037a7ecf4a4770a73ecc346f704dc5` and linked in PR comment https://github.com/Baatiku/masanawa/pull/478#issuecomment-6074048695 (claim UTC 2026-10-09T04:06:28Z). Substantive source checkpoints: `a1d6f8aebebf751a7a1429da80d03170529e6630`, `b2c74dfe72693a8a330c6223fd8c078e124618b5`, final source `1027c2f47f4b3709fc69f82b4d4f367019b6133e`; test-creation commit `1fd21b57c0b91f4a58e7b65c90d42671076e2160`. Source Git blob `da4258cb3be0de0c99c28dd282d28e54551b667b`; test blob `63021dee4ccf2e38f6e7cd1b8b20c2574dd03727`. This handoff-only commit follows the source/test checkpoint; read the PR's actual HEAD for its commit SHA.
- Exact modified paths: `apps/mobile/lib/src/human_media/human_voice_transport.dart`, new `apps/mobile/test/human_media_transport_bounds_test.dart`, this handoff. **No other exact-path ownership claimed or modified.** Earlier F17 backend, Ogg codec/security tests, C04 Flutter recorder/playback and prior handoffs remain present on the same PR.
- Requirements: **F17/C04, M03/M04/M10, J04/J11** (voice transport + human DM/privacy, incomplete integrated journey).

## Implemented code and tests

1. Replace Dio `ResponseType.bytes` full-response eager buffering with genuine `ResponseType.stream` for private voice GET. Enforce `audio/ogg` content type, reject invalid/over-bound declared Content-Length **before** reading, sum actual streaming bytes with a hard 1,572,864-byte ceiling and minimum 84 bytes, reject truncated/length-disagreeing streams, and preserve the original authenticated Gateway route. Bytes are accumulated only after checking the remaining bound; no public object URL or provider credentials are exposed.
2. Explicitly subscribe/cancel on invalid headers, cancel stream readers on oversize, network failure or sign-out, and check the original user access-token snapshot midstream and after completion to avoid returning old-account audio. Existing canonical ApiClient bearer/401-refresh integration is unchanged. This token comparison is intentionally fail-closed and may require retry after a same-account token rotation; it is not a new identity provider.
3. Fence `DELETE /messages/voice/:messageId` completion against an account/session switch. The server may have already committed deletion: reject the now-stale client result, require a history re-read, and do **not** claim the delete was rolled back.
4. Added **eight adapter-backed Flutter regression cases**: authenticated normal chunks, actual oversize cancellation, wrong media type with cancellation, over-limit content length with cancellation, truncation/length discrepancy, sign-out midstream, delete during account switch, and normal delete. Tests create fake HTTP response streams for isolated failure cases; they do **not** qualify real backend/provider/device delivery.

## Verification evidence (precise)

- **PASS — GitHub source readback and static assertions only:** all eight targeted structural checks for bounded stream implementation, early/late cancellation, auth fence, preserved send/list surfaces, and the eight authored test cases. These are **not Flutter/Dart test results**.
- **NOT_RUN — Flutter analyzer / unit tests / APK / two-device end-to-end:** this execution container lacks `dart` and `flutter` executables. The project is a private repo with unavailable GitHub DNS for local checkout (`git ls-remote` failed `Could not resolve host: github.com`); GitHub connector commits and readback succeeded. No device or private S3 credentials are available here. GitHub Actions quota/zero-step blocker remains #457; do not label workflow failures as executed test failures or passes.
- **NOT_RUN — C01/C02/C04 disposable PostgreSQL, S3, provider, Firebase and production:** no shared composition or production systems were touched. Prior C04 F17 backend handoff reported **41 earlier tests passed at a different source SHA**; this new mobile source is not covered by that evidence.

## Dependencies, risks, and exact integrator steps

- Reconcile C01 #468 and canonical C02 #472 vs #475; apply only approved `0016 → 0017 → 0018` migrations on a disposable database first, and integrate #478 C04 with the existing C02 human-only Flutter thread via **F12/C08**. Resolve C03/C05 protected outbox and private restart state; do not duplicate inbox, routes or Gateway composition. Work #497 and Firebase #461 must be preserved.
- Run from a real checkout of this PR HEAD: `cd apps/mobile && flutter pub get && flutter analyze && flutter test test/human_media_transport_bounds_test.dart test/human_media_models_test.dart test/human_media_controls_test.dart test/human_media_recorder_lifecycle_test.dart test/human_media_playback_stop_test.dart && flutter build apk --debug`. Then exercise real account A/B, revoked contact, 401 refresh, physical Android low-memory/weak network, 1.5 MiB and malformed upstream bodies, mic denied, background/kill/restart and private file erasure. Confirm media server tests, S3 SSE/bucket-private policy and SQL cleanup on actual providers.
- Inspect whether Dio adapters or server/proxy omit or change audio Content-Type/Content-Length; this client now fails closed on a wrong MIME type. Prove real response-stream cancellation and token-rotation behavior with an executable Dart run; static assertions are insufficient.
- If the checks fail, fix **on PR #478** with a refreshed exact-path lease and new SHA. Preserve the canonical exactly-five-tab root **Talks · Chats · Assistant · Wallet · Agents**, all payment/Firebase guards, and leave the PR draft/unmerged until full accepted evidence.

**No merging, branch deletion, production provider calls, or deployment was performed.**
