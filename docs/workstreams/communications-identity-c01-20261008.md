# C01 private human-contact admission — 2026-10-08
- Owner/window: GPT-6 live implementation, **C01 communications-identity only**.
- Branch: `work/c01-private-contact-admission-20261008`; base `main` at `0bed6fe5ada04fc64189a06d64619ef1dd4db87d`.
- Scope: authenticated human-to-human messaging contact discovery, privacy policy, consent, block-aware request/accept and schema, with tests. Never import phone contacts, expose arbitrary user ID or grant a public Talk Seat.
- Exact paths owned: `services/gateway/src/human_contacts/*.ts`, `packages/talks/migrations/0015_human_messaging_contacts.sql`, and this workstream file. New paths only, no edits to shared Gateway `app.ts`, `main.ts`, Flutter shell/router, central migrations registry, identity or finance.
- Shared integration dependency: Gateway composer/app injection and auth/error mapping by R17/C08/C02 integration owner before mobile activation. Backend C02 DM membership/admission must consume these policies, not reinvent them.
- Related owner decisions P03/N02/M01/M10/Q05 and C01, J03; canonical docs PR #465/#466.
- Current work: implementing repository, service, SQL migration, route contract and focused tests. Check fresh active claims/PR paths before changes; 5-minute lease applies.
- Verification: pending. GitHub Actions #457 quota issue; node runtime has no project dependency install / full PostgreSQL service; record checks honestly and do not merge without executable verification.
