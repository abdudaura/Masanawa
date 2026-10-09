# AF07 Masana & Contacts — ownership and execution handoff

**Owner/window:** MASANAWA-01 / AF07-masana-contacts-20261009
**Claimed at (UTC):** 2026-10-09T21:42:40Z
**Most recent concrete work:** fresh main and open-PR/branch inspection, source and cross-slice contract comparison at claim time.
**Branch:** `work/af07-masana-contacts-20261009-masanawa01`
**Fresh main/base SHA:** `f381f077c485c04261459b77a42c215d3ce3a14b`
**Status:** PLANNED, no application source edited at claim time.

## Exclusive exact paths (one writer)
- `apps/mobile/lib/src/masana_contacts/masana_contacts_screen.dart`
- `apps/mobile/lib/src/masana_contacts/masana_directory_controller.dart`
- `apps/mobile/test/audio_first/af07/masana_contacts_screen_test.dart`
- `docs/workstreams/AF07-masana-contacts-20261009.md`

**Explicit exclusions:** AF00 owns root router/composition/deep links; AF07 does not edit `apps/mobile/lib/src/router/**`, pre-existing `apps/mobile/lib/src/contact_hub/**`, `apps/mobile/lib/src/messages/**` or current `apps/mobile/lib/src/state/twin_directory_state.dart`. AF08 owns auth; this slice consumes caller-provided signed-in session identity and existing public Twin transport; no new identity backend. Existing PRs #468 and #508–#511 remain untouched and authoritative recovery inputs.

**Dependencies/contract:** AF00 stable root integration pending; reuse `TwinDirectoryTransport` public persona IDs and C01/C02 human Contacts interface from #468/#508. `docs/AUDIO-FIRST-INTEGRATION-CONTRACTS.md` AF v1. New chat uses **Masana & Contacts** as a nested destination, with human and AI tagged/typed routes, not extra bottom tabs.

**Scope:** Implement a bounded reusable directory screen with Masana/Contacts switcher, server-backed search, refresh, safe persona resolve before navigation, denial/loading/offline/retry and account-switch fences. Consume real human contacts UI as an injected widget (not a duplicate transport or contact authority). Add widget tests. Give AF00 an exact mount/handoff; do not silently own composition.

**Acceptance:** UI-09 / UX-A04. Claims only source/testing outcomes actually observed. Local owner APK and physical-device/provider checks are unavailable, preserve existing source.

**Next action:** publish/read-back this exact claim via a visible PR, then edit owned source; update this handoff with immutable SHAs/results and integration instructions.
