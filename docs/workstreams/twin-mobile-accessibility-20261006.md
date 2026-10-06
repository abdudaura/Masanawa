# Twin mobile accessibility / narrow-screen qualification — 2026-10-06

Status: active
Owner/window: ChatGPT continuation window
Branch: `work/twin-mobile-accessibility-20261006`
Base: `2a7ee0393bdc907cc1c7f29e73659ee20b66d12a`
Task: TWIN-076

## Exact owned paths

- `apps/mobile/lib/src/screens/twin/my_twin_screen.dart`
- `apps/mobile/lib/src/screens/explore/explore_screen.dart`
- `apps/mobile/lib/src/screens/activity/activity_screen.dart`
- `apps/mobile/lib/src/screens/wallet/wallet_screen.dart`
- `apps/mobile/test/twin_mobile_accessibility_test.dart` (new)
- `docs/workstreams/twin-mobile-accessibility-20261006.md`

## Boundaries

- no Gateway/router/chat/payment-provider/Commerce/migration edits;
- preserve root navigation and existing Twin product behavior;
- improve narrow-screen, large-text, semantics and low-end rendering only;
- no fixed text scaling clamp that would defeat accessibility.

## Current step

Audit the four customer Twin root screens for horizontal overflow and inaccessible action density, implement responsive fallbacks and semantic labels, add widget coverage, then hand back exact-head verification evidence.
