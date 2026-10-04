# Workstream claim: bills-flutterwave

- Owner/window: ChatGPT window 2026-10-04 17:58 +01
- Branch: `work/bills-flutterwave-catalog-20261004`
- Base SHA: `3906419669203844018b6687ad06ab2af48654eb`
- Task references: launch-required Flutterwave bill catalog / recipient validation / fulfillment-requery groundwork; does not close Tasks 072-150
- Owned paths:
  - `docs/workstreams/bills-flutterwave.md`
  - `docs/FLUTTERWAVE-BILLS-ADAPTER.md`
  - `packages/providers/src/flutterwave-bills/**`
- Shared-contract dependencies: canonical Commerce Offer/quote/fulfillment state, Security CredentialRef resolution, Gateway/chat-actions integration, production environment registration. This branch does not edit those shared owners.
- Current step: isolated provider-edge slice implemented; awaiting executable CI/toolchain verification and coordinated integration
- Last update: 2026-10-04 18:02 +01
- Implementation status: implemented on branch
- Verification status: source/diff reviewed; GitHub exposes no check runs for current head yet, so no executable test pass is claimed
- Deployment status: not deployed
- Handoff evidence: draft PR #95; implementation head before this claim update `301e772fcd56a80c79fa11cdb8f7866bf55a97e9`

## Implemented

- dynamic NG bill-category discovery;
- dynamic category -> biller -> item/package discovery with provider identifiers preserved;
- NGN qualification at the provider edge;
- customer-identifier validation projection;
- exact server-owned reference/recipient/amount dispatch;
- bill-status requery with verbose provider evidence;
- POST transport/5xx results become `dispatch_outcome_unknown`, requiring reconciliation before any redispatch;
- GET transport failures remain separately retryable;
- provider response bodies are not leaked through typed errors;
- focused regression tests cover discovery, validation, dispatch, ambiguity, requery, 404 and fail-closed country behavior.

## Collision boundary

This claim intentionally excludes `packages/providers/src/index.ts`, package manifests/lockfiles, Commerce, Gateway, mobile, migrations, root configuration and canonical guiding docs. Integration must wire exports/dependencies after active owners coordinate shared changes.

## Remaining coordinated work

- package export/composition wiring;
- scoped Security CredentialRef resolution;
- Commerce Offer/quote/fulfillment binding and verified settlement;
- webhook evidence ingestion/deduplication;
- chat-actions plus app/WhatsApp/Telegram rendering;
- production env/IP-whitelist setup;
- authenticated live Flutterwave catalog, validation, dispatch and requery qualification.

No live bill purchase, account readiness, deployment or production certification is claimed.
