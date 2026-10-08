# Gateway compilation blocker

Owner: Gwani production investigation window.
Base: 88e67cc6c79de1ca09e02f11e929065dcfb2ea82
Branch: work/deletion-optional-field-build-fix-20261008
Owned: packages/identity/src/account-deletion.ts; this record.
Evidence: Railway deployment 9d4a1531 failed TS2375 at account-deletion.ts:101: explicit undefined lastErrorCode violates exactOptionalPropertyTypes.
Scope: omit cleared optional error field on recovery; preserve failed reason and lifecycle guards. No migration/storage/auth changes; R12 write-guards PR423 has distinct paths.
Updated: 2026-10-08T05:31Z. Active bounded build repair.
