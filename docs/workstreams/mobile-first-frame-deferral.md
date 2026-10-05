# Mobile first-frame deferral — 2026-10-05

Owner/window: ChatGPT startup-performance continuation after cache-first mobile checkpoints.
Branch: `work/mobile-first-frame-deferral-20261005`
Base: `abd124444c3bfb67fd61d3f61954dd17dc8746ab`

Purpose:
1. Keep noncritical push/deep-link platform initialization from competing with Flutter's first useful frame.
2. Preserve notification/deep-link behavior by initializing immediately after first paint.

Owned paths:
- `apps/mobile/lib/main.dart`
- focused startup/deep-link tests if needed
- `docs/AGENT-HARNESS.md`, `CONTINUE-HERE.md` and this claim at checkpoint

Boundaries:
- no Firebase configuration changes;
- no notification permission behavior changes;
- no native MainActivity/audio changes;
- no auth, Gateway, workflow, billing or provider changes.

Acceptance:
- `runApp` and router/theme creation are not blocked by push initialization;
- MobilePushService initialization begins after the first Flutter frame;
- initial deep links remain queued/delivered through the existing PendingDeepLink path;
- docs updated before merge.

Status: active.
