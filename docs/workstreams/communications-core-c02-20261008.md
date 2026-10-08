# C02 — Durable human-to-human messaging (2026-10-08)

**Owner:** independent C02 implementation window. Branch `work/c02-durable-human-messages-20261008`, based on canonical main `5d19afc952b3dcabd18ee8f8d1c3ad13b72e6762`.
**Lease:** claim effective at this repository-visible commit under the five-minute fresh-activity rule of `docs/MULTI-WINDOW-WORK.md`.

## Claimed exact files (no shared composer/router)
- `packages/talks/migrations/0017_human_dm_conversations.sql`
- `services/gateway/src/human_messages/model.ts`
- `services/gateway/src/human_messages/postgres_repository.ts`
- `services/gateway/src/human_messages/service.ts`
- `services/gateway/src/human_messages/routes.ts`
- `services/gateway/src/human_messages/service.test.ts`
- `services/gateway/src/human_messages/postgres_repository.test.ts`
- `apps/mobile/lib/src/messages/human_messages_transport.dart`
- `apps/mobile/lib/src/messages/human_messages_controller.dart`
- `apps/mobile/lib/src/messages/human_conversation_screen.dart`
- `apps/mobile/test/human_messages_transport_test.dart`
- `apps/mobile/test/human_messages_controller_test.dart`
- `docs/workstreams/communications-core-c02-20261008.md`

## Owner & API boundaries
C02 depends on C01 contact policy tables from **draft #468**, not on AI/private character threads. Migration 0016 is reserved by C01, migration 0015 by R18 #435; C02 exclusively uses 0017. **Do not edit** shared `services/gateway/src/app.ts`, `main.ts` (conflicts between #468/#435), session infrastructure, R14 event fan-out, finance, or Flutter shared shell. Composition/route activation must be coordinated with C01 and R18 owner after verified migrations and tests; root Chats navigation with R17/C08 only. This C02 branch is NOT production-wired without those gates.

Trace IDs: M01, M02, M05, M10, P03, P05; journeys J03, J10/J11. Negative tests: cross-tenant, nonmember, reciprocal blocks and withdrawn permission on each send, duplicate client ID after retry, rate limits, sorted paging, sender-only edits/deletes, account-change isolation.

**Status at claim: IN_PROGRESS; no application tests, Postgres or Android evidence yet.** #457 exhausts Actions minutes; Work owns deferred CI and merge validation.
