# U12 — Private human media UX ownership and handoff

**Window:** autonomous GPT-6 U12 (2026-10-09, Africa/Lagos).  
**Branch:** `work/u12-private-human-media-ux-20261009-gpt6`  
**Base:** `5e758673ae91082520b21b3153da53791ae2cbf3` (`main`)  
**Claim opened:** 2026-10-09 01:22 +01:00; five-minute activity lease, refreshed by commits/PR updates.  
**Scope:** U12; C04/F17 existing secure voice-note code is *upstream*, not reproduced.  
**Exclusive exact paths:** `apps/mobile/lib/src/human_media_ux/**`, `apps/mobile/test/human_media_ux/**`, this handoff.
**Protected / NOT owned:** `apps/mobile/lib/src/human_media/**` (C04 #478 / F17), `services/gateway/src/human_media/**`, `app.ts`, `main.ts`, `apps/mobile/lib/src/router/**`, global mobile pubspec/Firebase/native sources, C02/C03/C05 persistence, shared migrations, wallet/ledger and LiveKit/Gemini audio.

## Live inspection at claim

- Current main is documentation baseline `5e758673`; U12 module absent on main.
- U08/U09/U10/U11 branches already exist; no U12 branch or PR found at claim.
- C04 private voice source exists in **draft #478**, head `9cd1f2f4dcd97a377cf40326d6faa9dc6129a333`, updated 2026-10-08 23:55Z, beyond five-minute lease but **must be preserved**; it implements authenticated Ogg/Opus audio-only routes/client under its exact paths and remains unmerged.
- C01 #468, C02 #472/#475, C03 #473/#483/#486, C05 #474/#476, Work #497 and F12/R17/C08 #493 are unmerged/conflict-prone. No fictional attachments server route or second recorder.
- Shared GitHub Actions issue #457 is blocked by exhausted runner budget, not proof tests passed.

## Work plan/status

Claimed `PARTIAL_IMPLEMENTATION` pending source/tests/evidence. Add separate accessible Flutter presentation and state controller **only** for user-reviewed, explicit selected media with account/revocation fencing and bounded preview. Existing C04 voice playback/recording is authority; the U12 interface is a view contract, not new audio capture or upload auth. Build isolated controller/widget tests; do not claim C02/C04 live integration. Update this handoff with exact commit/test evidence and integration dependencies.

## Acceptance required from integrator

Integrate into actual C02 human-only DM route using current C04 `HumanVoiceNotesPanel` / `HumanVoiceController`, not an AI/Assistant/Talk thread. Back/restart and account change must clear media. Real attachment sending requires a separately approved C04 extension with tenant/membership/private-media API and exact MIME/size rules; unsupported document/image modes remain preview-only or unavailable. Validate denied microphone, low RAM, data saver, offline retry and 2-device secure playback on Android after merger. No native or finance side effects.

## 2026-10-09 source checkpoint / handoff

**Status: PARTIAL_IMPLEMENTATION · SOURCE PUSHED · UNVERIFIED · NOT READY TO MERGE.**

**Last checked source checkpoint:** `3d182cd5fe99f85b22c2a7a3fe6f52390a20f54e` (before this handoff update), compared against `main 5e758673ae91082520b21b3153da53791ae2cbf3`. All code was committed to this U12 branch via GitHub file/commit operations, not applied to main.

### Implemented (owned only)

1. `apps/mobile/lib/src/human_media_ux/private_media_draft.dart`: identity-bound, cancelable local attachment review state with on-device header-based PNG/JPEG/PDF type checks (no MIME/extension trust), strict 8 MiB cap, validated file-name limits, hard fail on spoof/mismatch, exact-path local privacy, secure per-selection request ID, recheck before send, no blanket media/history inspection, server-side admission delegate required.
2. `apps/mobile/lib/src/human_media_ux/private_media_dock.dart`: real Flutter existing-file-picker-backed, semantic and Talk-independent review controls, data-saver reveal opt-in, memory-bounded image preview, PDF metadata view, image cache evict on account/selection switch, verified-progress display, disabled send until an authorized private attachment provider exists. Composes upstream C04 voice panel only through an injected existing voice widget; does not construct another recorder.
3. Optional `PrivateMediaUploadPort` *requires* the future C04/C02 authorized backend attachment API and its tenant/user/conversation membership checks; no production implementation exists yet. Any timeout stays UNKNOWN; retry preserves original request ID. Success requires exact account, thread, request ID, nonempty receipt and fresh authorization. Old account callbacks are fenced by invalidation epoch; never claim a delivery from a model result.
4. `apps/mobile/test/human_media_ux/private_media_draft_test.dart` and `private_media_dock_test.dart`: **14 authored cases** covering magic/header and oversize guards, unsupported type, explicit review, denied admission, late picker, changed media before upload, lost acknowledgment/idempotent retry, forged receipt, late success after revoke, revoked admission after upload, widget selection, account-controller swap and malformed PDF appearance. These use small fake adapters for negative-path tests, **not** fake production delivery.

### Actual checks/evidence

- GitHub readback of **all four code/test files** succeeded.
- GitHub base..head comparison had **9 commits at pre-handoff checkpoint**, exactly **5 changed files** (four new U12 code/test files and this handoff); verified all paths are in the published ownership claim. No root router, Gateway auth/composer, migration, native/Firebase, financial, or C04 code touched.
- Source contract/static guard inspection: optional upload unavailable = Send disabled; selected type revalidated before calling upload; account/thread/retry ID receipt check, fresh membership check and epoch-based logout fence are present. **These are review checks, not executed Dart tests.**
- **Not run:** `flutter analyze`, `flutter test`, Android builds, physical microphone/media tests, disposable PostgreSQL or private S3. Runtime has no `dart`/`flutter`/`pnpm` installed; Git access from container cannot resolve `github.com`. GitHub Actions shared blocker #457 reports exhausted quota/zero-step CI. No CI or device PASS is claimed.

### Exact Work/integrator verification steps

After fetching the branch into a Git worktree that has Flutter/Dart SDK >=3.12.2:

```sh
cd apps/mobile
flutter pub get
dart format --output=none --set-exit-if-changed lib/src/human_media_ux test/human_media_ux
flutter analyze lib/src/human_media_ux test/human_media_ux
flutter test test/human_media_ux/private_media_draft_test.dart test/human_media_ux/private_media_dock_test.dart
```

Then compose with C01 #468, chosen canonical C02 #472/#475, C03/C05 and C04 #478 on the authorized human-only Chats thread. Inject the *existing* `HumanVoiceNotesPanel` as the voiceNotes widget. Add `HumanPrivateMediaDock` below (not instead of) the C02 text composer; instantiate controller with exact verified current account+thread identity and revalidate membership on every operation, call revoke/dispose on sign-out/thread switch. Do not pass the public Talk or Assistant recorder.

**Important:** the existing C04 server only supports authenticated `audio/ogg` voice notes. PNG/JPEG/PDF support is **local preview only**; the Send button stays absent until the backend owner reviews/writes a separate private image/document contract and transport, full durable message ownership, server-side binary revalidation, content scanning, authorization, retry journal, and deletion. Never attach an unqualified public CDN/file-storage endpoint. Voice upload progress is still governed by C04/F17, not fabricated here.

Further required acceptance (NOT RUN): on two real users/devices check authenticated C02 C04 voice delivery/playback, denied OS microphone, focus with public Talk and Gemini, Revoked/blocked contacts, late 401/OTP refresh, slow network and ambiguous upload, expired private GET, Android MIME/Opus recorder support, data-saver/perf, application restart, and access revocation on deletion. C05 secure pending outbox/restart persistence, private S3 policy, C02 ordered rendering and release tests remain other owners' work. C04 backend/image attachment implementation is explicitly outside this lane.

**Disposition:** Leave DRAFT/UNMERGED. This window owns review UX only; U12 end-to-end capability is **not** complete without the named dependencies.


### Draft pull request and final checkpoint

- **Draft PR:** [#533](https://github.com/Baatiku/masanawa/pull/533), opened against `main` with no merge or production action.
- **Final source patch:** `bdfbad3ce4ef7dd023a111c5301a64a25b39e611` (asynchronous Flutter image-cache eviction type safety); earlier functionality at `3d182cd5fe99f85b22c2a7a3fe6f52390a20f54e`.
- **Final handoff commit:** this documentation update is the branch HEAD; check PR current HEAD before integrating. Do not treat previous immutable checkpoint SHA as the latest commit.
- **Test outcome:** code-review/static-path checks only. All **14 authored test cases remain UNEXECUTED** until an SDK-capable environment is available. Existing C04/R17/F12/F17 integrations are still outside this branch and require the named canonical owners.
