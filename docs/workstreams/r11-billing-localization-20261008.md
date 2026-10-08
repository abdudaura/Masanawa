# R11 — localized billing journey and authoritative receipts: Work handoff

Updated (UTC): 2026-10-08; owner/window: GPT-6 R11 billing localization.
**Classification:** `IMPLEMENTED_UNVERIFIED` for the bounded billing **presentation/localization** slice only. Full **R11**, R05 funding recovery, R07 provider qualifications, C07 speech/action parity and the five-tab integration remain **PARTIAL_IMPLEMENTATION / OPEN**. No feature is DONE. No production releases.
**Claim:** This file's predecessor committed at `11684640393506f2fc86af9fb61d2d0270a380b2` before edits. Five-minute lease was confirmed by the last PR updates: R11 #426 at 05:28Z; R05 #440 at 05:58Z (on 2026-10-08). No active overlap at claim. This work intentionally does not touch shared router, Gateway or money authority.

- Base `main`: `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`
- Branch: `work/r11-billing-localization-20261008-gpt6`
- Implementation source HEAD: `437641a1e544c989d987476c2b396e3f9979d81a`; subsequent handoff-only HEAD is visible in [draft PR #501](https://github.com/Baatiku/masanawa/pull/501). Do not rewrite the implementation SHAs.
- PR: [#501](https://github.com/Baatiku/masanawa/pull/501), **draft/open/unmerged**.
- Trace: **R11**, supports R05/R07 and P02/P03, wallet/history and J07/J11 language/receipt recovery; final requirements audit in `OWNER-REQUIREMENTS-TRACEABILITY-20261008.md`.
- Existing owner collisions: [#426](https://github.com/Baatiku/masanawa/pull/426) modifies all 6 ARB files for shell/twin translation; [#440](https://github.com/Baatiku/masanawa/pull/440) modifies `billing_screen.dart` for quote funding restoration. Both stale leases carefully respected, but **merge conflict remains**. [#482](https://github.com/Baatiku/masanawa/pull/482) changes secure Settings language preference in other files and should remain independent. [#497](https://github.com/Baatiku/masanawa/pull/497) coordinates shared Work integration, not a replacement. #457 owns Actions runner/budget verification.

## Changed paths, source and integration boundary

- `apps/mobile/lib/l10n/app_en.arb`, `app_ha.arb`, `app_ar.arb`, `app_fr.arb`, `app_es.arb`, `app_pt.arb`: 53 additively namespaced `billing*` strings for full screen category/provider/service, quote entry and wallet confirmation, transfer instructions, history, receipt, known financial phases, unknown-phase fail-closed, retry/errors, and authorizing session expiry. Template metadata and amount placeholders are defined; non-English placeholders preserve `{amount}`.
- `apps/mobile/lib/src/screens/billing/billing_screen.dart`: replaces billing hardcoded copy in form, list, successful wallet action, history/status and receipt with generated Flutter `AppLocalizations`. Known server quote phases are mapped to translated labels; unknown state shows **status unavailable**, never completed. Amounts remain exact server-derived decimal **NGN** strings and existing typed Gateway model; no client currency conversion, quote mutation or inferred paid status. Recipient/meter/provider references are shown verbatim with LTR text direction, receipt token remains selectable LTR even within Arabic RTL layout. Internal/provider exceptions are not displayed as untrusted UI copy; recognized auth/quote-expiry codes have explicit localized recovery text.
- `apps/mobile/test/localization/billing_journey_localization_test.dart`: widget-projection tests for five *supported* UI locales, exact NGN kobo, tenant/user-opaque reference rendering, token text, unknown-status fail-closed and refund text. Uses typed `BillingCheckoutView` / `BillingQuote` real production models and `BillDetails`, **not proof of a live DB response**.
- Existing `apps/mobile/test/localization/arb_integrity_test.dart` validates six catalog key/placeholder parity, and `masanawa_localization_test.dart` guards locale negotiation/RTL. No new database migration, service route, auth, push, secrets, payment provider, ledger or root navigator changes; existing authenticated Gateway `billingHistory`/`billingQuote` and purchase/status projections remain the authoritative data chain.
- **Hausa caveat:** Hausa ARB content is supplied, but canonical `MasanawaLocalization.supportedLocales` deliberately excludes `ha` until Material/Cupertino delegate support is available; do **not** advertise Hausa UI ready. It requires the separate R11 rollout decision and runtime verification.
- **Voice caveat:** this slice translates existing silent text/tap Billing UI; C07/R07 native assistant voice requests and parity remain separate open integration work, not satisfied by ARB copy.

## Executed versus deferred verification

**Executed:** GitHub branch readback and JavaScript static validation (no Dart runtime): all 6 ARB resources have the same **146 non-metadata keys**, including **53 billing keys**, nonempty values, English key metadata and intact declared placeholder tokens. Result `errors=[]; passed=true` at implementation SHA `437641a1...`. This is **structural only**, not compiled localization, translation certification, widget test execution or provider evidence. Source was refetched and reviewed from the pushed branch.

**Not executed (no Flutter/Dart executable or local repository checkout in this window):**

```bash
cd apps/mobile
flutter pub get
flutter gen-l10n
dart format --output=none --set-exit-if-changed lib/src/screens/billing/billing_screen.dart test/localization/billing_journey_localization_test.dart
flutter analyze
flutter test test/localization/arb_integrity_test.dart test/localization/billing_journey_localization_test.dart test/localization/masanawa_localization_test.dart
flutter test
flutter build apk --release
```

A clean environment with Flutter/Dart/Android toolchain is required. `dart format` may request a format-only commit before verify. Existing CI [#457](https://github.com/Baatiku/masanawa/issues/457) confirms multiple Foundation CI/Mobile Build runs had **zero job steps**; do not count those as passed or failed source tests. No CI retry was attempted. PostgreSQL, billing provider, physical devices, restored funding state, external voice and deployed revision **not tested**; no live money flow executed.

## Next Work integrator actions

1. Compare *exact current heads* of #501, #426, #440 and latest `main`, plus #482, before attempting merges. Union translations in six ARBs without losing root/Twin keys from #426. Compose R05 #440's owner-scoped funding-status/readback and stale-account cleanup into `billing_screen.dart` **before** or concurrently with this localization; never replace #440 with this older main snapshot. Preserve `billingStatusLabel`, exact amounts/provider IDs and account-specific cleared state. Review #497 integration effects. If merge cannot be qualified, retain drafts.
2. Run the commands above on the reconciled SHA. Resolve analyzer/compiler problems rather than weakening tests. Add widget tests for restored funding/read-only bill, offline/401/expired quote and account switch once the R05 branch is composed; include negative state and Arabic RTL 320dp/large-font tests.
3. Authenticate test account to live-for-test Gateway/Postgres; create a real allowed bill quote, confirm wallet/funding, kill/restart, read history and matching receipt, compare exact NGN kobo/recipient/token and re-render locale switching without changing server quote/money state. Exercise declined confirmation, server 401, expired quote, pending/unknown/failed/refunded statuses. **No charges without user-authorized safe sandbox/provider credentials.**
4. R07/C07 owner must separately demonstrate mic/typing/taps equivalence and market/provider qualification, not mistake translated labels for live eligibility. Validate French/Spanish/Portuguese/Arabic UI, RTL and semantics; Hausa delegate gate remains OPEN.
5. Once all executable/local, DB/API, Android, provider and global integration checks pass at reviewed SHA, owner may change draft state and merge in the verified dependency order. Record test links and SHAs in the consolidated Work matrix, then ship only after release gates.

## Data, security, backward compatibility and rollback

No schema migration or data transformation. Canonical amounts `serviceAmountKobo`, `feeAmountKobo`, `totalAmountKobo`, trusted receipt fields, existing authenticated headers/tenant scoping and route names unchanged. No customer identifiers copied into logs or local persistent storage by these edits; LTR decoration is presentation only. Semantic conflicts with #440 can **regress account/funding recovery if blindly merged**. English original copy remains as `app_en.arb` fallback; revert this isolated PR to roll back translations, not ledger or provider payments. Payment features and regional qualifications remain exactly as before.

Release gates: SOURCE_WRITTEN=yes (bounded UI source); LOCAL_TESTED=no; CI_EXECUTED=no; DB_INTEGRATED=existing API source only, not tested on this PR; APP_INTEGRATED=source wired to BillingScreen, unverified; DEVICE_VERIFIED=no; PROVIDER_QUALIFIED=no; DEPLOYED=no; MERGED=no.
