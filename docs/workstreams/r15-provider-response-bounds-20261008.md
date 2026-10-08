# R15 — bounded outbound WhatsApp/Telegram provider responses

Updated UTC: 2026-10-08; window/owner: GPT-6 R15 channel egress safety.
Status: CLAIMED; no verification yet. This is a new non-overlapping continuation after closing R16 bootstrap code scope.
Branch `work/r15-provider-response-bounds-20261008-gpt6`; inherited stale PR #451 head `eb14419a5290c52680fe0896418a199383dd8532` last updated 2026-10-08T06:14:54Z. Reviewed current `main` `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`; inherited parent base is older. New PR must target parent branch `work/r15-channel-webhook-boundaries-20261008`; preserve original source, do not rewrite #451. Lease is five minutes after each repository-visible commit.

Owned paths: `services/gateway/src/customer_channel_routes.ts`, `services/gateway/src/customer_channel_routes.test.ts`, `docs/workstreams/r15-provider-response-bounds-20261008.md`. Shared Gateway composition/migrations/auth/finance/mobile/CI excluded, and other R15 PRs (#443/#446/#450) own distinct Talk safety files.
Requirements R15, Q05/Q08/Q09/Q10, J10/J11; established WhatsApp/Telegram mandatory inbound/return private channel trust.
Deliverable: bound outgoing provider HTTP request time, JSON response bytes and media-stream lifetime; preserve authenticated HMAC/Telegram verification and existing media cap, prevent oversized/unending upstream bytes reaching agent execution or consuming unbounded memory; add real Fastify inject tests for rejected and legitimate media/outbound flows, abort/cancellation and failure recovery. No Flutter UI, database mutation or account auth code applicable to provider transport layer. Existing bridge owns durable idempotency/user settlement. Keep draft until Node tests/provider delivery and downstream retry handling are verified.
Dependencies: CI #457 (zero-job-step failures), actual Telegram/WhatsApp credentials (not available to this window). No production secrets or endpoint modifications.
