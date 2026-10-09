# U15 — Live Talk Host Copilot: implementation and integration handoff

**Scope:** U15 On-stage agent usefulness and safety; R02/R09/R15 dependencies.
**Owner/window:** GPT-6, 2026-10-09; activity governed by the repository five-minute claim rule.
**Status:** PARTIAL_IMPLEMENTATION / RUNTIME UNVERIFIED / NOT DEPLOYED.
**Base main:** 5e758673ae91082520b21b3153da53791ae2cbf3
**First repository-visible claim:** 51c79c76ece9acfef5a8e42c7d6072539affda35
**Implementation head before final handoff:** b57ddc8f9cd0c0b7bb013f77242263903cb147cc
**Branch:** work/u15-safe-live-stage-copilot-20261009-gpt6
**Draft PR:** https://github.com/Baatiku/masanawa/pull/536 (OPEN, DRAFT, UNMERGED)
**Final head SHA:** use PR #536's live head / the commit containing this handoff. Updating this file necessarily produces one later commit.

## Exact owned paths and preserved authority

Changes are limited to services/gateway/src/talk_agent_live_copilot/**, apps/mobile/lib/src/talk_live_copilot/**, apps/mobile/test/u15_live_copilot_test.dart, apps/mobile/test/u15_live_copilot_transport_test.dart, and this workstream record. No edits to shared Gateway app.ts/main.ts, Flutter router, Firebase/native keys, payment ledger, core Talk worker, official SQL migration registration or production configuration.

Inspected canonical R02 AI Seat worker and LiveKit dispatch, R09 authorized event-context projection and SQL, R04 Seat quote/admission service, U01 action contract, the U/F scope corrections, latest main inventory, draft PR conflicts and five-minute claim policy. U15 had no live matched branch, issue or PR before claim. Existing overlapping R02/R09/R04/F04/Work source must be preserved.

## Code added and behavioral boundaries

1. Host service: authenticated existing Platform session and tenant-bound current live human Host check, plus canonical live-state/AI pause. Up to three bounded Host suggestions from R09's public approved stage events. No private DMs, unmoderated comments, balances or model-generated factual claims in the suggestions.
2. Manual Talk turn: only after explicit Host review, current admitted paid Seat eligibility, not removed/muted, current commerce authorization and connected Host. Delegates voice generation/publication to the canonical R02 worker, which rechecks Host/Seat after inference. No model-suggested turn may autonomously publish or self-authorize a paid Seat.
3. Durable PostgreSQL claim: request-id dedupe per authenticated Host, content/seat/Talk conflict fencing, SHA-256 hashed transcript rather than raw text, per-Host/Talk hourly turn cap serialized by pg_advisory_xact_lock in a transaction, and compare-and-swap outcome finalization. Unknown/live delivery outcomes are not replayed as another payable turn.
4. Isolated Fastify HTTP routes with strict TypeBox schemas; explicit 202 for uncertain/in-progress and 409/429 for denial/conflict/quota. User/tenant/amount/cost/identity are never accepted from request body.
5. Flutter typed API client, account-session/Talk/Seat epoch-fenced Host controller, review-confirmation panel, accessibility/readback copy, high-entropy request ID and same-key retry for lost HTTP responses. Denials/quota remain typed results; uncertain publication is not claimed audible or complete. No root navigation or native changes.
6. Proposed SQL file is NOT a registered/applied migration and should only be assigned a canonical sequence by the elected F04 migration integrator.

## Test and validation evidence (do not report green runtime tests)

Authored three backend test files (copilot.test.ts, postgres.test.ts, routes.test.ts) and two Flutter test files (u15_live_copilot_test.dart, u15_live_copilot_transport_test.dart) covering Host/Seat rejection, privacy, idempotency, quota, rollback, unknown results, no auto-inference, account switch, reviewed send, and transport errors.

EXECUTED: read-only GitHub PR file-list and source structural checks at implementation SHA b57ddc8; all 14 changed paths confined to claimed roots, PR verified draft, no shared/router/finance edits. First static probe had 13/14 checks due to a wrong literal string assertion for the unknown assignment; corrected focused source inspection passed 4/4. These are static checks only, NOT successful TypeScript/Dart compilation or automated unit tests.

NOT EXECUTED, with no success/failure claim:
- pnpm --filter @masanawa/gateway-service typecheck
- pnpm exec vitest run services/gateway/src/talk_agent_live_copilot/*.test.ts
- pnpm --filter @masanawa/gateway-service build
- In apps/mobile: flutter analyze lib/src/talk_live_copilot test/u15_live_copilot_test.dart test/u15_live_copilot_transport_test.dart
- In apps/mobile: flutter test test/u15_live_copilot_test.dart test/u15_live_copilot_transport_test.dart
- Applying migration to disposable Postgres, two-node concurrency and crash recovery/unknown reconciliation; live authenticated Gateway/Flutter integrated tests
- LiveKit provider publishing, two-device audio/admission/mute/Host leave/reconnect, background app, cost/turn-budget and actual audibility

Environment lacks a mounted authenticated repository workspace, installable pnpm/Flutter toolchain, suitable PostgreSQL and real provider/device credentials. GitHub Actions #457 has reported quota/zero-step CI failures; not equivalent to tests executing.

## Correctness and integration gaps

PARTIAL_IMPLEMENTATION is required: route module is NOT mounted; proposed SQL claim table NOT applied; authentic session and R02 worker + R09 projection not composed with the new service; Host-only nested Talk Flutter panel NOT mounted by the F12/R04 screen owner. Thus this draft is not enabled, deployable, device-tested, end-to-end verified or safe to merge. No external source-verified fact-check service is implemented; approved suggestions derive solely from public Talk context. Real post-crash reconciliation and retention policy for running/unknown turn claims require backend operator implementation before production. Host confirmation acknowledges dispatch only, never listener audibility or provider billing qualification.

## Ordered handoff to one future integration window

1. F04/R09 and F02 inspect PR #536, existing R02/R09/R15 worker and stage contracts, choose canonical ordered migration, review SQL schema, retention, locks and per-tenant policies; test on disposable PostgreSQL.
2. Compose authentic existing session, tenant-bound Host authorization, seat/live repository, R09 stage repository and ONE R02 worker in designated shared Gateway owner; mount isolated routes only after real quota and delivery reconciliation are qualified. Recheck five-minute shared-file claims immediately before editing.
3. F12/R04 mount the Host-only Flutter panel under an actual logged-in human Host and current admitted Seat, never in private Assistant, human DM Chats or audience public controls.
4. Execute actual Vitest/typecheck/build/Flutter/widget/SQL multi-node and real two-device LiveKit tests; audit cost/mute/rejoin, adversarial safety, Host departure and simultaneous turn races. Record SHA-specific results and resume or correct code failures.
5. Keep this PR DRAFT and UNMERGED until all integration/security/CI/device gates are evidenced. Do not delete branches, change production or activate payment.
