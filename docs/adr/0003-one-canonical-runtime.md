# ADR-0003: One Canonical Runtime

Status: accepted

## Decision

Masanawa has one canonical character runtime, one identity system, one memory service, one skill system, one tool registry, one decision fabric, one workflow engine and one provider registry.

WhatsApp, web, Telegram, voice calls, avatars and future clients are channels/surfaces over the same platform state.

## Implication

It is forbidden to introduce a "temporary" donor runtime that persists its own identity/memory/task truth. Adapters may bridge external libraries but all durable platform semantics resolve into Masanawa contracts.
