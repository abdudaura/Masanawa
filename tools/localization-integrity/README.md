# F07 localization merge-integrity audit

Standalone, read-only Node.js 22+ source check for Flutter ARB files. No new package, provider, SDK or production runtime dependency.

From repository root:

```sh
node --test tools/localization-integrity/audit.test.mjs
node tools/localization-integrity/audit.mjs apps/mobile/lib/l10n
```

The audit returns structured JSON and exits with status 1 on errors. It detects missing/additional keys across English, Arabic, French, Spanish, Portuguese and Hausa; missing files, invalid JSON or locale tags; missing/orphan placeholder metadata; unbalanced ICU braces, absent `other` plural/select cases and unsupported formatters; placeholder-name drift (including amount/currency identifiers); empty messages; and translation of the fixed brand name.

**Scope limits:** This checks syntax and placeholders, not translation quality, RTL rendering, safe money formatting at runtime, financial APIs, voice parity, or a complete Hausa Flutter locale. The disabled Hausa framework locale remains governed by R11; this tool does **not** enable it. It is intentionally not wired into shared GitHub Actions, which are owned by CI #457/F11. It reads but never changes ARB files.

Run after reconciling unmerged R11 drafts [#426](https://github.com/Baatiku/masanawa/pull/426), [#482](https://github.com/Baatiku/masanawa/pull/482) and [#501](https://github.com/Baatiku/masanawa/pull/501), before `flutter gen-l10n`, `flutter analyze`, widget tests, or Android qualification. The R11/F07 integrator remains responsible for resolving concurrent ARB edits and performing those actual Flutter/device tests. Source presence and a passing checker do not establish release qualification.
