# F06 claim — cross-tenant authorization continuity for internal crypto transfers

Date: 2026-10-09. Baseline inspected: main `5e758673ae91082520b21b3153da53791ae2cbf3`.
Recovery PR: #487 (draft), existing branch `work/c06-internal-crypto-transfer-20261008-gpt6`, initially at `0950b0ce091e18a5c05f9deeab35cce33feea065`. Competing PR #490 yields to #487, must NOT merge competing 0110 migrations.

## Fresh five-minute exact-path claim (before edits)
Owner: this F06 recovery window. Scope: reject an account/tenant identity change between first authorization and refreshed transfer quote/policy qualification; preserve sender-only request recovery and ledger lock semantics.
Exclusive paths: `services/gateway/src/internal_crypto_transfer.ts`, `services/gateway/src/internal_crypto_transfer.test.ts`, this new `docs/workstreams/f06-auth-continuity-fence-20261009.md`. No changes allowed to migrations, Postgres financial ledger, payment routes, Gateway app/main, Firebase, Flutter root or production.
Lease: five minutes from this repository-visible commit; scope limited to this checkpoint and renewed only by subsequent work. Existing C06 source is unmerged and preserved.
Status: CLAIMED / NOT IMPLEMENTED as of this commit. Later additions must distinguish executed and deferred tests, record exact SHA and blockers.
