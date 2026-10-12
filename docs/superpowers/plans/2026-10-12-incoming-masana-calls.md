# Incoming Masana Calls Implementation Plan

> **For agentic workers:** use superpowers:subagent-driven-development for isolated source tasks and final review.

**Goal:** Implement connected incoming Masana calls on the existing AF11 contracts.
**Architecture:** Durable PostgreSQL invitations and push retry outbox; authenticated consumer transitions; existing paid voice/token/history integration; account-fenced Flutter destination.
**Tech Stack:** TypeScript, Fastify, PostgreSQL, Flutter.
**Spec:** ../specs/2026-10-12-incoming-masana-calls.md

## Global Constraints
Masana only. Preserve ledger/auth/native/group/history implementation. No real provider spend. No check bypass. Main development merge authorized by owner.

## Review Focus
Account changes during async operations; concurrent accept/cancel; duplicate/late push; paid admission failure; process restart before push/expiry.

### Task 1: Backend signaling and persistence
Files: services/gateway/src/incoming_calls/**; packages/agents/migrations/0009_masana_incoming_calls.sql; call_history/service.ts and postgres_repository.ts; live_voice_token.ts; agent_shell_contract.ts.
- [x] Write failing service/HTTP/PostgreSQL tests for transitions, scope, idempotency, missed history and retry delivery.
- [x] Implement repository, service and routes preserving current auth and billing.
- [x] Verify focused tests and changed-file compiler diagnostics.

### Task 2: Mobile destination
Files: apps/mobile/lib/src/calls/incoming_*.dart; call_history.dart; core/mobile_push.dart; core/shell_deep_link.dart; tests/incoming_*.dart.
- [x] Write failing transport/controller/widget tests for ringing, consent, decline, cancellation, expiry and account fencing.
- [x] Implement authoritative invitation refresh, explicit acceptance and existing paid/live voice setup with cleanup.
- [x] Verify Flutter tests and scoped analysis when runner available.

### Task 3: Composition and delivery
Files: Gateway app.ts/main.ts; mobile router/app_router.dart; documentation entry/handoff.
- [x] Wire production persistence, server authority and push recovery; route incoming hints to authenticated destination.
- [x] Run relevant builds and integrated regression suites; review exact final diff independently.
- [ ] Fix findings, commit, push, PR and merge compatible source from fresh main.
- [ ] Publish executed evidence and qualification gaps; provide continuation prompt directly.
