# Channels webhook ingress ownership

Owner/window: Codex channel continuation, 7dcdf56fd0be.
Status: ACTIVE.
Branch: work/channels-webhook-ingress-20261004.
Base main SHA: 3906419669203844018b6687ad06ab2af48654eb.
Task references: 097–102 and 108, bounded ingress groundwork; no gate completion.
Last update: 2026-10-04.
Current step: implementation verified; coordinated Gateway/lockfile integration pending.

## Exact owned paths

- adapters/channels/messaging/** (new adapter workspace only)
- docs/CHANNEL-WEBHOOK-INGRESS.md (new integration/handoff document)
- docs/workstreams/channels.md (this claim)

No ownership of Gateway, Identity, Events, shared contracts/exports, migration registry, pnpm-lock.yaml, mobile, canonical guiding docs or deployment. PR #89 runtime/integration, PR #90 commerce-core and PR #91 chat-actions claims/changed paths inspected; these new paths do not overlap. No main claims existed at selection; active claims were read on their PR branches.

## Shared dependencies

Gateway/integration owner must provide durable transactional admission/dedupe, proof-based identity linking, current authority, Character routing, outbox delivery and account lifecycle/revocation. Transport verification remains transport-verified, never linked/strong. This adapter does not implement another identity, task, financial, action or memory runtime. Button data is opaque untrusted selection, never permission or pricing.

New package depends inward only on @masanawa/contracts. Integration must add its new importer to the shared pnpm-lock.yaml after reconciling PR #89; this window will not edit that shared file. Explicit composition/route/raw-body/secret registry integration and deployment remain with integration. No outbound messages or provider setup are authorized/performed by this slice.

## Evidence

Implemented: authenticated raw-byte WhatsApp and dedicated-secret Telegram ingress; account-scoped text/media/selection/edit/delivery projections; immutable bounded evidence; stable replay keys/hashes; persist-before-ack seam. No default persistence or runtime.
Verified: claim published in draft PR #92 and read back before source edits. 48 ingress regressions; 72 targeted ingress/architecture tests; strict adapter typecheck and declaration build; whitespace/file-scope checks. Main remains at the base SHA and PR #89/#90/#91/#44 scopes were rechecked. Full ingress/architecture run: 112 passed, one pre-existing environment-registry failure (NEXT_PUBLIC_OPS_API_BASE_URL missing from config/production-env.json). No frozen-install or full CI success claim.
Deployed: no.
Handoff: docs/CHANNEL-WEBHOOK-INGRESS.md records exact adoption steps and limitations. Gateway/integration must add the package lock importer, durable custody/dedupe, current account lifecycle, proof-based linking/routing, action reconciliation and outbound outbox/audio delivery. No edits to those owners' paths. Claim remains active pending coordinated adoption; do not take over without explicit transfer. Keep Tasks 072 and 097–108 open until their actual gates pass.

Implementation commit: 157a45f54048d2be7b234df285db8912acd4a075. Source publication preserved the exact base-main tree plus the initial claim and only these 13 owned files. PR #92 remains draft for Gateway/lockfile integration and live channel evidence.

Publication verified: handoff commit 9def03b0a63916efb9f9a0c29064605a83c60b5a compares ahead of main with zero behind and exactly 13 owned paths. Foundation CI run 863 failed before checkout with zero steps and runner_id=0; no code was tested by that run. This is not a passing CI gate. Local adapter checks above remain the verification evidence.
