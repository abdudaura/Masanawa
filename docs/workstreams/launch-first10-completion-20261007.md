# Launch first-10 completion workstream

Owner/window: current ChatGPT launch completion window
Branch: `work/launch-first10-completion-20261007`
Base: `release/mobile-apk-ready-20261006` @ `956d00694e34a71c75947991d8744dab4518b6c7`
Started: 2026-10-07

## Reclaimed stale ownership

Under docs/MULTI-WINDOW-WORK.md five-minute lease, stale shared work from PR #126 and PR #136 is reclaimed after inspecting and preserving useful history. The rejected local-agent commits at the old #136 head are intentionally not reintroduced.

## Scope

Finish the user's first ten launch priorities as far as code can be completed without physical-device/provider-account evidence:

1. Android APK/device readiness support
2. Flutterwave billing chat journey
3. NOWPayments crypto end-to-end wiring/recovery
4. Home/Rooms integration into active mobile shell
5. Voice-first Twin creation integration
6. Twin share/deep-link/free public chat
7. WhatsApp production channel wiring
8. Telegram production channel wiring
9. Core Teaching Skill integration
10. Paid Twin voice production wiring/recovery

Also close the directly required Wallet/financial-recovery glue exposed by those paths.

## Shared-sensitive paths

This workstream owns shared integration/router/chat/Gateway composition for this reclaimed pass. Before each shared edit, re-read current branch/head and preserve newer work.

## Status

Implementation: in progress
Verification: pending
Deployment: not claimed
Physical APK/provider qualification: user/device/provider dependent; code paths and deterministic test/build hooks will be completed here.
