# Durable channel ingress custody — Task 097 — 2026-10-06

Status: active reclaimed channel slice
Owner/window: ChatGPT continuation window
Branch: `work/channel-ingress-custody-20261006`
Base: stale PR #92 head `f6e8dbd1115ec1ceaf803826dc4ff24f44eecdef`

## Task

Production Master Task 097 — durable ingress admission/dedupe and normalized subject envelope.

PR #92 already implements authenticated WhatsApp/Telegram ingress normalization and a
minimal `DurableChannelAdmission` interface. This slice tightens the missing durable
custody semantics without choosing a database schema.

## Exact owned paths

- `adapters/channels/messaging/src/ingress-custody.ts` (new)
- `adapters/channels/messaging/src/ingress-custody.test.ts` (new)
- `adapters/channels/messaging/src/index.ts` (custody export only)
- `docs/CHANNEL-INGRESS-CUSTODY.md` (new)
- `docs/workstreams/channel-ingress-custody-20261006.md`

## Boundaries

- no Gateway app/main/routes;
- no PostgreSQL package, migrations or migration-root registration;
- no Identity/Commerce/mobile/production changes;
- normalized `ChannelIngressRecord` remains the transport evidence authority;
- this contract does not turn transport subjects into canonical Users.

## Goal

Define and enforce durable atomic batch admission where:
- `dedupeKey` is the replay identity;
- same key + same evidence hash is an exact duplicate;
- same key + changed evidence hash is a conflict;
- mixed stored/duplicate batches are accepted;
- any conflict aborts the entire batch;
- store responses must echo the exact requested identity/evidence;
- admission returns `persisted` when any row is new, otherwise `duplicate`;
- storage failures remain retryable/redacted at the existing webhook boundary.
