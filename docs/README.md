# Masanawa Documentation

## Canonical consumer-product documents

These define what the product is **now**:

1. `PRODUCT-NORTH-STAR.md`
2. `TALKS-PRODUCT.md`
3. `MOBILE-SCREEN-ARCHITECTURE.md`
4. `CONSUMER-SERVICES.md`
5. `APP-SHELL-CONTRACT.md`
6. `MOBILE-AGENT-EXPERIENCE.md`
7. `GOLDEN-JOURNEYS.md`

`../CONTINUE-HERE.md` is the mandatory handoff entry point.

## Architecture documents

Architecture/security/runtime/domain documents remain authoritative for internal platform
invariants where they do not conflict with the consumer-product direction above.

The product reset does **not** discard identity, memory, Skills, Tools, Providers,
Commerce, channels, audit, recovery or security foundations. It removes their exposure as
consumer navigation/product concepts.

## Historical workstreams

Files under `docs/workstreams/`, old phase closure records, migration records and ADRs are
historical/technical evidence. A dated workstream must never override the current
consumer-product documents.

Git history preserves deleted Twin-first/Room-first product planning. Do not restore those
documents merely because an older branch references them; translate still-useful
implementation into the current Talk/Seat/Expert/Twin model instead.
