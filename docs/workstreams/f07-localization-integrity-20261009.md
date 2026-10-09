# F07 — Localization integrity recovery / handoff (2026-10-09)

**Classification: PARTIAL_IMPLEMENTATION / TESTED ISOLATED GUARD ONLY — R11/F07 NOT DONE.** This branch contains a real runnable localization-source audit and regressions, not a new frontend/locale integration. Draft/unmerged, no production modification, no branch removal.

## Repository, lease and ownership
- Repository: `Baatiku/masanawa`; live base `main` SHA `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Exclusive ownership claim before source changes: [issue #540](https://github.com/Baatiku/masanawa/issues/540), refreshed in its discussion.
- Branch: `work/f07-localization-integrity-20261009-gpt6`.
- Source/test commit checkpoint: `a5b4f221f02aa67175af0531643b2beb3e9f5b24`; README checkpoint `2eebd3d43dcdd6098a84ddef1f9db76613ef765b`. Handoff commit and PR HEAD are specified in the PR metadata.
- Exact touched paths: `tools/localization-integrity/audit.mjs`, `tools/localization-integrity/audit.test.mjs`, `tools/localization-integrity/README.md`, and this handoff. Zero modifications to `apps/mobile/lib/l10n/**`, Flutter router/theme, Gateway, Postgres, auth, Firebase, financial ledger, Actions workflows or production.
- Preserves preexisting R11 unmerged implementation: [#426 shell](https://github.com/Baatiku/masanawa/pull/426), [#482 signed-in language setting](https://github.com/Baatiku/masanawa/pull/482), [#501 billing translations](https://github.com/Baatiku/masanawa/pull/501). No copying/replacing their UI or claiming merged localization.

## Actual source
- Read-only Node 22+ ARB catalog auditor for `en/ar/es/fr/pt/ha`, with JSON report and nonzero failure.
- Checks key parity against English, corrupt/missing files, locale markers, nonempty strings, orphan metadata, nested ICU braces/plural/select `other`, missing/extra interpolation placeholders including amount/currency, metadata declarations and immutable brand.
- Fourteen regression tests reproduce typical concurrent-PR translation loss, malformed ICU syntax, currency-placeholder manipulation, missing catalog, invalid metadata, accidental brand change and directory load failure. No application mocks or financial operations. This is a source-integrity guard; it deliberately does not add a duplicate `flutter gen-l10n` generator or alter locale support.

## Executed verification and exact evidence
- Node 22.16.0 isolated test runner: `node --test tools/localization-integrity/audit.test.mjs` — **14 PASS, 0 FAIL**, fixture coverage only. Local `node --check` on source/test passed.
- Executed the **published audit implementation** in a sandboxed JS evaluation against fetched authentic ARBs:
  - `main` `5e758673…`: **PASS**, six catalogs, **93 translation keys per locale**.
  - GitHub draft `refs/pull/501/head`: **PASS**, six catalogs, **146 keys per locale**.
  - GitHub draft `refs/pull/426/head`: **PASS**, six catalogs, **93 keys per locale**.
  - A pass means structural catalog consistency at that individual ref, **not** conflict-free combined PRs, complete translations or successful Flutter compilation.
- Local shell lacks authenticated repository checkout: git to `github.com` failed DNS resolution, so full in-repo Node execution on the complete merged tree was not possible. Fetched ARBs through authorized GitHub connector instead. No Dart/Flutter SDK; no Flutter analyze/gen-l10n, widget tests, RTL screenshots, low-end Android, two-device, provider/CI/E2E verification executed. Existing CI/Actions gate #457 still unresolved; do not call the feature release-qualified.

## Required next integrator actions
1. Reconcile R11 existing branches #426/#482/#501 into one complete five-tab-aware catalog and settings/billing UX without losing translations; avoid duplicate shared shell edits with R17/C08/F12.
2. Run `node --test tools/localization-integrity/audit.test.mjs && node tools/localization-integrity/audit.mjs apps/mobile/lib/l10n` after the semantic merge, and correct reported source issues. This is intentionally not wired into central Actions under F11 ownership.
3. Run Flutter `gen-l10n`, `analyze`, the existing R11 widget tests, RTL/large font/high contrast validation, Hausa fallback and real device text/voice/tap journeys. Preserve financial amounts, signed quotes, currency and provider identifiers exactly; only labels may be translated.
4. Recheck product wording for the approved five-tab **Talks · Chats · Assistant · Wallet · Agents**, with Assistant at center and human Chats distinct from AI. Keep Hausa enabled only when genuinely framework/translation-ready; do not infer it from ARB presence.
5. Preserve draft/unmerged state until verified source integration, app behavior and owner release gates. Record SHA-specific final handoff in the eventual integrator PR.

**No providers, Firebase values, database records, customer payments or production systems accessed or changed.**
