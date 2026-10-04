# Channels webhook ingress ownership

Owner/window: Codex channel continuation, 7dcdf56fd0be.
Status: ACTIVE.
Branch: work/channels-webhook-ingress-20261004.
Base main SHA: 3906419669203844018b6687ad06ab2af48654eb.
Task references: 097–102 and 108, bounded ingress groundwork; no gate completion.
Last update: 2026-10-04.
Current step: authenticated, bounded WhatsApp Cloud API/Telegram webhook normalization and persist-before-ack admission seam.

## Exact owned paths

- adapters/channels/messaging/** (new adapter workspace only)
- docs/CHANNEL-WEBHOOK-INGRESS.md (new integration/handoff document)
- docs/workstreams/channels.md (this claim)

No ownership of Gateway, Identity, Events, shared contracts/exports, migration registry, pnpm-lock.yaml, mobile, canonical guiding docs or deployment. PR #89 runtime/integration, PR #90 commerce-core and PR #91 chat-actions claims/changed paths inspected; these new paths do not overlap. No main claims existed at selection; active claims were read on their PR branches.

## Shared dependencies

Gateway/integration owner must provide durable transactional admission/dedupe, proof-based identity linking, current authority, Character routing, outbox delivery and account lifecycle/revocation. Transport verification remains transport-verified, never linked/strong. This adapter does not implement another identity, task, financial, action or memory runtime. Button data is opaque untrusted selection, never permission or pricing.

New package depends inward only on @masanawa/contracts. Integration must add its new importer to the shared pnpm-lock.yaml after reconciling PR #89; this window will not edit that shared file. Explicit composition/route/raw-body/secret registry integration and deployment remain with integration. No outbound messages or provider setup are authorized/performed by this slice.

## Evidence

Implemented: pending.
Verified: repository/branches/open PRs inspected; claim publication/readback required before source edits.
Deployed: no.
Handoff: follow docs/CHANNEL-WEBHOOK-INGRESS.md once implemented. Keep Tasks 072 and 097–108 open until their actual gates pass.
