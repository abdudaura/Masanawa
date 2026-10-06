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


## Implementation checkpoint

Implemented on PR #295:

- My Twin primary actions stack automatically on narrow screens or large text;
- My Twin performance metrics reduce columns at large text instead of clipping;
- Talk-to-me loading content now allows the label to wrap;
- Explore cards expose an explicit semantic button label and wrap capability tags;
- Wallet primary actions and Bills/Crypto actions stack on narrow/large-text layouts;
- Wallet balances stack when necessary and transaction amounts move below the title at large text;
- Activity summary reduces columns at large text and transaction amounts move into the subtitle;
- widget coverage exercises Wallet and Explore at a 320px viewport with 200% text scaling.

## Verification

- PR head: `93413b8ce162d3f32ac6cd0228254e0ce3987b36`
- PR is mergeable.
- GitHub Foundation CI and Mobile Build still terminate before producing downloadable job logs, matching the repository-wide runner failure.
- The local execution container cannot resolve `github.com`, so an exact-head Flutter checkout cannot be run there.
- TWIN-076 is therefore **implemented but not yet qualified**; do not mark it complete until Flutter analyze/tests and a real-device narrow-screen pass succeed.


## Final implementation delta

Additional hardening after the first checkpoint:

- My Twin moves price detail into the subtitle at large text so trailing text cannot squeeze the setting title.
- Explore removes the decorative chevron at large text to preserve content width.
- Activity and Wallet entries expose explicit screen-reader labels with event/value context.
- Activity and Wallet histories now use lazy `ListView.builder` construction, reducing widget work on long histories and low-end Android devices.
- No text-scale clamping was introduced; system accessibility scaling remains authoritative.

Integration dependency published on PR #136:

- customer Settings still exposes `Default Masanawa agent`; TWIN-075 says ordinary Settings should be limited to account/privacy/security/language/help. #295 did not touch that #136-owned path.

Implementation status: **complete on this lane**.
Qualification status: **blocked externally** until a working Flutter runner/device is available.
