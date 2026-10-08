# C06 internal custody-backed crypto transfer — live claim / evidence

- Lane: C06 / R06-R08 coordination; W06 W07, J09. Owner/window: ChatGPT GPT-6 C06 implementation 2026-10-08.
- Branch: `work/c06-internal-crypto-book-transfer-20261008`; base `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`.
- Claim time: 2026-10-08T11:29:00Z (update with commits). Five-minute **activity** lease; no indefinite reservation.
- Scoped implementation: `packages/commerce/migrations/0110_internal_crypto_transfers.sql`, `packages/commerce/src/internal-crypto-transfer.ts`, `adapters/storage/postgres/src/commerce/internal-crypto-transfer.ts`, `services/gateway/src/internal_crypto_transfer_routes.ts`, `apps/mobile/lib/src/finance/internal_crypto_transfer_*.dart`, focused tests. Existing crypto service/register wiring if conflict-safe only; no alternate ledger.
- Existing C02 #472/#475, C05 #474/#476, C01 #468, C03 #473, C04 #478, C07 #480, R18 #435 and shared CI #457/#460 not owned. C06 must never reinterpret user-to-user DM or Credits transfers as crypto settlement.
- Initial state: CLAIMED, source not yet implemented. Mandatory full SHA-specific handoff will replace this record. Do not call DONE before actual tests, DB double-entry, consent, privacy and A/B readback.
