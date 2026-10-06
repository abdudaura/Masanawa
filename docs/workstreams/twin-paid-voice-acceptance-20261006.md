# Paid Twin voice acceptance workstream

Owner/window: current ChatGPT continuation window — 2026-10-06
Branch: `work/twin-paid-voice-acceptance-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Task reference: `docs/TWIN-TRANSFORMATION-TASKS.md` — TWIN-104.
Roadmap reference: `docs/TWIN-INTEGRATION-MATRIX.md` Phase 4 Paid voice.

## Exact owned paths

- `tests/integration/twin-paid-voice-acceptance.test.ts` (new)
- `docs/workstreams/twin-paid-voice-acceptance-20261006.md`

## Excluded/shared paths

- PR #136 shared Gateway/live-token/mobile/chat/APK/production ownership;
- Commerce model/repository/index and PostgreSQL persistence;
- migrations and production environment;
- Event/Activity ownership;
- provider usage-meter adapter implementation.

## Dependencies

- merged configurable trial and voice pricing/settlement contracts from #139;
- merged free-text/paid-voice admission boundary from #159;
- production usage evidence, reservations/ledger posting, Live token composition and Activity emission remain foreign-owner dependencies.

## Current state

CLAIMED. Prove the safe cross-contract paid-voice lifecycle: trial quote/admission produces zero charge, paid usage settles only from verified usage within reservation, unused reservation refunds, ambiguous/over-cap usage requires reconciliation, and voice admission remains distinct from free text.
