# R11 — Authenticated Settings language preference (2026-10-08)

Window: ChatGPT GPT-6 isolated R11 Settings-access lane; claim recorded by this branch commit. Five-minute activity lease; refresh on each pushed source/handoff commit. Branch: `work/r11-settings-language-preference-20261008`. Base: `main` at creation (initial observed `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`).

## Exact owned files
- `apps/mobile/lib/src/screens/settings/settings_screen.dart` (only additive language entry, preserve all existing Settings behavior)
- `apps/mobile/test/localization/settings_language_preference_test.dart` (new regression suite)
- `docs/workstreams/r11-settings-language-preference-20261008.md` (this claim and final handoff)

No shared Gateway, PostgreSQL, API, identity, theme, root router, ARB, mobile localization core, R17/C08 shell, CI or Android release files. Reuse existing `LocalePreferenceScope`, `LanguagePickerButton`, encrypted device-language preference storage and root `MaterialApp.router` listener. Scope is a **local device UI-language selector in authenticated Settings**, not global R11 localization acceptance; UI locale must not mutate account market, currency, server locale or speech preference.

## Collision/dependency review
- Open R18 avatar PR #435 also changes `settings_screen.dart` but its last visible update was stale when inspected. Preserve and reconcile avatar edit in final Work integration; do not replace or force-push #435. Our change is additive to Settings currently on main; root localization is already merged, R11 root-shell draft #426 edits other files.
- Other C and R lanes own Gateway, contacts, communications, shell, finance, Firebase and release verification.
- Shared CI incident #457 is reserved for owner Work; GitHub Actions quota/runner is externally blocked.

Status at claim: PARTIAL_IMPLEMENTATION. Implementation and verification evidence will be appended before checkpoint. Applicable data migration/DB/API/auth: **N/A** — existing preference is intentionally encrypted *on device*, not an account/profile field or financial-market setting; all language selection is deterministic local state and survives app restart via existing secure storage.
