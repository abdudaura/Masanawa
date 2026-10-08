# U22 device-local phonebook — active ownership and handoff

- **Claim:** 2026-10-08, current owner GPT-6; global freeze lifted.
- **Base main:** `5e758673ae91082520b21b3153da53791ae2cbf3`.
- **Branch:** `work/u22-local-phonebook-20261008-gpt6`.
- **Exclusive code boundary:** `apps/mobile/lib/src/device_contacts/**`, `apps/mobile/test/device_contacts_*_test.dart`, this handoff. Dependency-only `apps/mobile/pubspec.yaml` proposed, subject to native release owner review.
- **Dependency:** U21 owns Masanawa Contacts Hub; F12 installs nested Chats route; native release/F10 owns manifest, iOS Info.plist, signed binary qualification. No modification of these shared paths.
- **State:** IN PROGRESS; source and tests not yet verified. The five-minute ownership rule applies; recheck fresh branch/PR before reclaim.
- **Design boundary:** explicit opt-in, OS permission, session-only local contacts and invite through user-selected share sheet. No server contact upload, hashes, automatic AI context, unverified account matching, or private phone number in referral URL.
