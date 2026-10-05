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

Implemented:
- MobilePushService deep-link stream subscription remains installed during app init;
- Firebase/push/native initial-link initialization now starts in a post-frame callback;
- router/theme/session first-frame startup no longer competes with that noncritical initialization;
- existing PendingDeepLink draining behavior is unchanged.

Verification:
- PR #168 merged into `work/billing-main-integration-20261005` at `93df1c6bcd29446eb5204ae09e7b5e0685e20486`;
- Foundation CI run 37293798214 and Mobile Build run 37293798165 both ended before executing any steps (`steps: null`), preserving the known hosted-runner limitation;
- MainActivity contains no eager Firebase/audio/network initialization;
- branch diff is limited to main startup scheduling and checkpoint docs;
- no APK rebuild was performed;
- executable Flutter checks remain subject to the hosted runner-allocation issue.

Status: merged implementation checkpoint.
