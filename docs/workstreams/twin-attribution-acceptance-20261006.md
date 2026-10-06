# Twin funding/purchase attribution acceptance workstream

Owner/window: current ChatGPT continuation window — 2026-10-06
Branch: `work/twin-attribution-acceptance-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Task reference: `docs/TWIN-TRANSFORMATION-TASKS.md` — TWIN-101.
Roadmap reference: `docs/TWIN-INTEGRATION-MATRIX.md` Phase 3 Credits/gifts/commission.

## Exact owned paths

- `tests/integration/twin-attribution-commission-acceptance.test.ts` (new)
- `docs/workstreams/twin-attribution-acceptance-20261006.md`

## Excluded/shared paths

- PR #136 Gateway/mobile/router/APK/production ownership;
- billing/crypto provider orchestration and live purchase/funding hooks;
- Commerce repository/model/index and ledger persistence;
- migrations and production environment;
- Event/Activity ownership.

## Dependencies

- merged originating-Twin attribution and configurable commission contracts from #152;
- live funding/purchase capture, provider-success hooks, persistent attribution and canonical commission posting/reversal remain existing shared owners.

## Current state

CLAIMED. Implement the safe TWIN-101 acceptance slice proving qualifying external funding and eligible commerce purchase attribution earn only the configured policy commission for the originating Twin, while self-attribution/internal value do not, and refund reversal creates a bounded offset instead of mutating historical earnings.
