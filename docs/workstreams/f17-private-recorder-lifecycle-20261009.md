# F17 — Private human voice recorder lifecycle recovery (2026-10-09)

## Exact-path ownership claim — 2026-10-09T00:48+01:00 (2026-10-08T23:48Z)

This F17 recovery **adopts existing draft C04 PR #478**, branch `work/c04-private-voice-notes-20261008`, after its most recent 2026-10-08T14:02:02Z update was more than five minutes old. Before claiming, inspected current `main` guidance, all open PRs, Work #497's file list (its media changes are Gateway-only), and U21 #508. No concurrent F17 branch or active claim appeared. Do not take over other C04 files or the global Flutter router.

**Sole leased source paths:** `apps/mobile/lib/src/human_media/human_voice_controller.dart` and new `apps/mobile/test/human_media_recorder_lifecycle_test.dart` plus this handoff. Other writers should avoid these while this window is active; recheck five-minute lease before reclaiming. No new 0018 migration, Gateway authority, API, native Firebase, wallet, root tabs or provider changes.

**Reason:** async permission, microphone start/stop and session shutdown can interleave. A recorder start completing after shutdown can leave a microphone and private temporary file active; two concurrent begin calls can also conflict. Fix with lifecycle fences and deterministic cleanup, including failure recovery, then author reproducible widget/controller tests with fake recorder and temporary files. Keep C04 as an opt-in human DM only.

**Parent:** existing C04 PR #478 (rather than duplicating C04 source onto newer `main`). PR #478 is still draft/unmerged; current latest-main direction is unchanged. Full status/test/handoff will be appended after source commit and review.
