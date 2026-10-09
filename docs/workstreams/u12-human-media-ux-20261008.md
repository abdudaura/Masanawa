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
