# Integration suite

Cross-owner or multi-component integration tests. Owner-local database integration tests may remain colocated with the owning adapter/package.

## Skills acceptance

`skills-acceptance.test.ts` uses public package entrypoints and an isolated database
created from `MASANAWA_TEST_DATABASE_URL`. It needs PostgreSQL 18 and a test account
with database creation rights, as provided by Foundation CI. It verifies canonical
Skills persistence/restart, exact certification/dependency pins, readiness CAS,
database invariants, and Provider-neutral consequential Tool execution/recovery.
Without the database URL, these tests skip explicitly; local unit tests cannot
substitute for the real database acceptance gate. Device dispatch is simulated.
