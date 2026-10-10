# AF09 — Account-isolated durable audio Talk publish recovery

**Date:** 2026-10-10. **Parent:** Published Audio Talks UI-04/UI-06/UI-07, UX-A08/UX-A09, existing [PR #609](https://github.com/Baatiku/masanawa/pull/609). This continues the same PR/branch, not a helper/integration branch. Main observed at `7c443966be97e9092cbc1fb98562c75253434326`. Claimed paths and readback on `factory/claims` as `af09-609-account-isolated-drafts-20261010-gpt6-0428` before edits.

## Customer journey now supported in isolated source

The earlier `SecureTalkPublishAttemptStore` stored **one** encrypted publish attempt for the entire device. Account B's new publish could replace account A's unknown-outcome attempt, erasing the only local copy of A's idempotency key and allowing a duplicate after restart. The active audio composer already uses this interface, so no new route/provider/library/UI is introduced.

- `apps/mobile/lib/src/audio_posts/audio_post_draft_store.dart`: per-account encrypted recovery slots, conflicting same-account publish-key/payload rejection, strict account and request match on read/clear, crash-safe migration of the old single-slot value (new write before old delete), no cross-account overwrites. The account-key suffix is an encoding of the opaque account ID **for namespacing, not secrecy**; values remain in `FlutterSecureStorage`. Existing unknown-outcome recovery is never auto-submitted.
- `apps/mobile/test/audio_first/af09/draft_store_test.dart`: nine authored Flutter tests covering account switching/restart, same-key isolation, legacy migration without loss, wrong-account legacy clearance denial, wrong-key clearance denial, mis-scoped state, corrupt storage, conflicting same-account attempts and same-key payload mutations.
- Source commits in existing PR: storage `638a8eef9c76356411647cc22247d9746aca7755` + same-account guard `e8311fe2e39c945c0cf0c3580ccea7c65583875c`; tests `e7eb0eaf212fa5b6340aaf584882f6071a865d72` + `0eecd1d1bfc8f2c5d8ddafa85e1bc4f31e314caa`. Blob readback matched committed source and tests. This is **IMPLEMENTED_UNVERIFIED**; no runtime test was executed.

This does **not** add raw audio recovery or fix missing AF05 recording/upload, signed playback, worker registration, migration or shell wiring. Legacy migration of an inaccessible/corrupt entry blocks recovery instead of silently issuing a different publish key.

## Finite parent-milestone closure checklist

| ID / exact source boundary | Owner | Source state at this checkpoint | Separate execution / integration |
| --- | --- | --- | --- |
| AF09-11 account-isolated pending publish, `audio_post_draft_store.dart`, `draft_store_test.dart` | AF09 / this PR | **IMPLEMENTED_UNVERIFIED**, commits above | 9 Flutter cases AUTHORED/NOT_RUN; no integrated SHA |
| AF09-01/02 social contract/service/route and `adapters/storage/postgres/src/audio_posts/{repository,following_repository,processing_queue}.ts` | AF09 | IMPLEMENTED_UNVERIFIED in #609; review combined source | Real Node24/pnpm12/PG NOT_RUN |
| AF09-04 composer/feed/Following/Saved/My Talks/comment/player UI under `apps/mobile/lib/src/audio_posts/**` | AF09, AF05 | PARTIAL: many modules in #609, root mounting still **MISSING** | Flutter analyze/widget/E2E NOT_RUN |
| AF09-03/07 recording→verified private upload, server media verification, signed playable range + single audio focus, canonical media authorities | AF05 + AF15 | **MISSING connected production source/adapter** | Real device/object/provider NOT_RUN |
| AF09-05 canonical AF08 actor, PostVisibility, Gateway route imports, `services/gateway/src/{app,main}.ts` | AF00 / AF08 | **MISSING actual composition** | Auth/visibility E2E NOT_RUN |
| AF09-06 social posts/comments/reactions/follow + queue append-only SQL in `database/migrations/**` | AF00 | **MISSING allocated/installed migration** | Disposable PG/restart NOT_RUN |
| AF09-08 trusted moderation worker scheduler/tenant enumeration/queue registration in `services/worker/src/main.ts` | AF00 + AF09 | **MISSING registration**; queue/worker exists uncomposed | Concurrency/restart/PG NOT_RUN |
| AF09-09 two-account post→processing→feed→authorized play/follow/comment/save/delete and privacy tests | AF09 + AF13 + AF05/15 | **MISSING composed E2E** | NOT_RUN |
| AF09-10 one audited nondeploying integration SHA + #497/unseen local-source preservation and shell routes | AF00 | **NOT INTEGRATED**, source not closed | No safe baseline elected/verified |

## Execution and immediate owners

Actual environment probe: Node `v22.16.0`, Git `2.47.3`; `pnpm`, `flutter`, `dart`, `psql` **UNAVAILABLE**. Attempted `git ls-remote https://github.com/Baatiku/masanawa refs/heads/main` returns `Could not resolve host: github.com`. No checkout and no exact-head Flutter run; readback is a source-integrity check, not a test PASS.

**AF13 or capable AF00/local Flutter runner** at latest PR #609 HEAD executes `cd apps/mobile && flutter pub get && dart format --output=none --set-exit-if-changed lib/src/audio_posts/audio_post_draft_store.dart test/audio_first/af09/draft_store_test.dart && flutter analyze lib/src/audio_posts test/audio_first/af09 && flutter test test/audio_first/af09/draft_store_test.dart test/audio_first/af09/composer_test.dart`. Repair any real errors before integration.

**AF00 root integrator** must continue actual route, DB migration, media/worker and mobile tab wiring via exact-path transfer on ONE demonstrably nondeploying reviewed target. Copy this finite checklist to the source-of-truth `docs/NEXT-WAVE-DELIVERY-20261010.md` under the protected documentation claim, referencing these commits and the final tested integration SHA. **AF05/AF15** implement verified recording/upload/playback; **AF09** continues their existing PR's remaining source. No local pull/rebuild request until source is connected and integrated; preserve owner's unreceived local fixes. **No main merge, production deploy or VERIFIED_E2E claim.**
