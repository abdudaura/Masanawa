# Workstream claim: bills-flutterwave

- Owner/window: ChatGPT window 2026-10-04 17:58 +01
- Branch: `work/bills-flutterwave-catalog-20261004`
- Base SHA: `3906419669203844018b6687ad06ab2af48654eb`
- Task references: launch-required Flutterwave bill catalog / recipient validation / fulfillment-requery groundwork; does not close Tasks 072-150
- Owned paths:
  - `docs/workstreams/bills-flutterwave.md`
  - `docs/FLUTTERWAVE-BILLS-ADAPTER.md`
  - `packages/providers/src/flutterwave-bills/**`
- Shared-contract dependencies: canonical Commerce Offer/quote/fulfillment state, Security CredentialRef resolution, Gateway/chat-actions integration, production environment registration. This branch will not edit those shared owners.
- Current step: claim publication before implementation
- Last update: 2026-10-04 17:58 +01
- Implementation status: not started
- Verification status: not started
- Deployment status: not deployed
- Handoff evidence: pending

## Collision boundary

This claim intentionally excludes `packages/providers/src/index.ts`, package manifests/lockfiles, Commerce, Gateway, mobile, migrations, root configuration and canonical guiding docs. Integration must wire exports/dependencies after active owners coordinate shared changes.
