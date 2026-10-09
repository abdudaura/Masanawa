# F09 / R13 replay recovery — seek authority fence

**2026-10-08. Claim only:** this is a narrow recovery of existing draft [R13 #503](https://github.com/Baatiku/masanawa/pull/503), not a replacement replay implementation. Existing head at inspection: `2f13e7b0ea37506d7e62a3587828d785169ddf01`; live main: `5e758673ae91082520b21b3153da53791ae2cbf3`. The last #503 activity was older than the five-minute repository ownership lease. Work integration #497 holds an earlier copy of this PR; later integration must salvage this additive correction.

## Explicit exact-path lease
- `apps/mobile/lib/src/talks/talk_replay_playback.dart`
- `apps/mobile/test/talk_replay_playback_session_test.dart`
- This claim/handoff file only.

**Bug to address:** `_loadFresh` checks current authorization/freshness before awaiting `player.seek` but, after that await, can publish cached private credentials and the new paused state despite sign-out, account switch, or expiry while the seek is pending. If `autoPlay` is true it invokes the authorization check in `_beginPlaying`, but the prior saved credentials can still enter state without rechecking. Enforce both conditions after seek and add deterministic delayed-seek regression tests for authorization changes and expiry. No changes to Gateway composer, provider secrets, DB migrations, core auth, financial handlers, five-tab router, Firebase, S3, or media/replay policy.

## Verification and handoff
Source and tests will be committed on the existing #503 draft. Static source inspection alone is **not** an executed Flutter regression. CI #457 still reports zero-step hosted failures; the final integrator needs `cd apps/mobile && flutter test test/talk_replay_playback_session_test.dart`, `flutter analyze`, and device tests (logout while seeking/playing, stale signed URL, replay unpublish/blocked contact). Preserve Work #497's other R13 changes. **Status: IN_PROGRESS / UNVERIFIED / DRAFT / UNMERGED.**

## Completed bounded source implementation and SHA-specific handoff

- Claim commit: `3a648a10954cd427109803fa262e393ce7b0bfed`.
- Production fix: `715da3de40ab38d5590b7c099e687672fa0ae5d9`, in existing R13 playback controller only.
- Regression tests: `5fb1f954bf5b84803d67dde6a684d37bb86f76b8`, extending existing delayed audio fake (no new production mocks).
- Fix: after the awaited native seek during a *fresh authenticated URL load*, check `_authorized()` again; on lost current session fail closed and best-effort pause. Recheck signed-link freshness using the injectable clock, and if stale fail instead of emitting `paused` with stale media credentials. Existing post-load, before-seek and `_beginPlaying` authorization fences remain.
- Added **two deterministic asynchronous unit regressions**, targeting a paused replay refreshed after initial URL expiry: (1) account revoked while a renewed native seek is pending; (2) the refreshed signed URL expires during that pending seek. Previously both branches could publish a paused snapshot/cached credential without post-seek revalidation; they now end in `failed` with no second play.
- Tests authored, **not executed**: no Flutter/Dart executable repo checkout in this GitHub connector session. Static GitHub readback/assertions checked 7 invariants (including exact branch head, changed checks, both test names, delayed fake, older Work source), **7/7 matched**; this is not a test pass.
- **Work #497 has NOT received this delta.** Compared its replay controller source: it does not contain the new post-seek guard. At final integration cherry-pick/semantically apply the two changes from the exact commits, while preserving other #497 replay/recording source, and rerun the focused suite. No `main` mutation, migration, shared Flutter router edit, native config change or rollout.
- Required executable checks: `cd apps/mobile && flutter test test/talk_replay_playback_session_test.dart && flutter analyze`; then current auth/tenant, replay-unpublish, Android `just_audio` and FCM/player lifetime, old-buffer revocation, and real S3 signature/clock-skew tests. Hosted CI quota/runner issue #457 is separate. No provider/device/real PostgreSQL test is claimed.
- **Disposition:** PARTIAL_IMPLEMENTATION (bounded R13 hardening) / DRAFT / UNMERGED / NO DEPLOYMENT / NOT VERIFIED_E2E. Keep original #503 and Work #497 branches until this unique delta is reconciled. Full F09 replay/egress/storage is not complete.

