# R15 — bounded outbound WhatsApp/Telegram provider responses

Updated UTC: 2026-10-08; window/owner: GPT-6 R15 channel egress safety.
Status: CLAIMED; no verification yet. This is a new non-overlapping continuation after closing R16 bootstrap code scope.
Branch `work/r15-provider-response-bounds-20261008-gpt6`; inherited stale PR #451 head `eb14419a5290c52680fe0896418a199383dd8532` last updated 2026-10-08T06:14:54Z. Reviewed current `main` `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`; inherited parent base is older. New PR must target parent branch `work/r15-channel-webhook-boundaries-20261008`; preserve original source, do not rewrite #451. Lease is five minutes after each repository-visible commit.

Owned paths: `services/gateway/src/customer_channel_routes.ts`, `services/gateway/src/customer_channel_routes.test.ts`, `docs/workstreams/r15-provider-response-bounds-20261008.md`. Shared Gateway composition/migrations/auth/finance/mobile/CI excluded, and other R15 PRs (#443/#446/#450) own distinct Talk safety files.
Requirements R15, Q05/Q08/Q09/Q10, J10/J11; established WhatsApp/Telegram mandatory inbound/return private channel trust.
Deliverable: bound outgoing provider HTTP request time, JSON response bytes and media-stream lifetime; preserve authenticated HMAC/Telegram verification and existing media cap, prevent oversized/unending upstream bytes reaching agent execution or consuming unbounded memory; add real Fastify inject tests for rejected and legitimate media/outbound flows, abort/cancellation and failure recovery. No Flutter UI, database mutation or account auth code applicable to provider transport layer. Existing bridge owns durable idempotency/user settlement. Keep draft until Node tests/provider delivery and downstream retry handling are verified.
Dependencies: CI #457 (zero-job-step failures), actual Telegram/WhatsApp credentials (not available to this window). No production secrets or endpoint modifications.

## Implementation checkpoint and mandatory final Work handoff — 2026-10-08

Status: **IMPLEMENTED_UNVERIFIED for the R15 outbound provider-response budget slice, NOT full R15/channel production completion**. Draft/unmerged. Last source/test SHA `488220f68920d56b4671866066fe550a9788b8c5`; prior source commit `c5f92d830d082939d2af7fe33af9f5cda2234fe3`. Parent unmerged #451 SHA at reclaim `eb14419a5290c52680fe0896418a199383dd8532`, original `main` comparison `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`. Current PR/head reference will be linked below after creation.

### Implemented source by layer
- `services/gateway/src/customer_channel_routes.ts`: **each** Telegram/WhatsApp provider HTTP metadata/send request and authenticated provider media fetch now carries a 15-second AbortSignal deadline. Shared `readProviderBody` uses bounded incremental stream reads, cancels on abort/error/over-limit and limits JSON metadata/ack replies to **256 KiB**, independent of inaccurate Content-Length. Existing media 8 MiB cap retained without a duplicate unchecked `Response.json()` allocation. Provider JSON is accepted only if valid non-array object; errors use static non-secret codes. Existing signature/secret verification, identity, Fastify routing, bridge idempotency and received/delivered states unchanged.
- `services/gateway/src/customer_channel_routes.test.ts`: authored real Fastify-injection regressions: forged small Content-Length with large provider JSON stream gets canceled before bridge processing, valid Telegram voice metadata + 2-byte voice note passes as authenticated media with deadline signals, malformed provider JSON fails without private bridge execution, and oversized outbound send-response never falsely marks delivery. Parent #451's existing webhook/media cap/identity/signed route tests remain in place.
- **API/auth/security**: routes remain protected by HMAC (WhatsApp) or configured Telegram webhook secret plus private sender checks; outbound bearer/bot credentials stay env-configured and are not logged. No public new endpoint, auth bypass, new stored payload or cross-account cache. On provider uncertainty a webhook request fails for retry; no fake delivered acknowledgement.
- **Database/migrations/Flutter**: N/A for this focused network/provider adaptor boundary. Existing bridge owns persistent message idempotency and delivered acknowledgements; this code does not touch finance/ledger, CI, Android shell or user DB.

### Verification actually run vs blocked
- **Executed:** authenticated GitHub connector fetched current parent source, read/reviewed precise diff, created a new isolated branch, pushed explicit claim and two substantive source/test commits. These are source-write confirmations, **NOT** executed Node, Vitest, provider or device acceptance.
- **Unexecuted mandatory:** `pnpm install --frozen-lockfile`, `pnpm --filter @masanawa/gateway-service typecheck`, `pnpm exec vitest run services/gateway/src/customer_channel_routes.test.ts` and full Gateway/channel tests; blocker: no locally authenticated private repository checkout, package dependencies or pnpm available in this connector-only environment. #457 documents current GitHub Actions quota/runner failure before job steps. No CI retries requested.
- **Unexecuted provider tests:** Real signed Telegram private voice/file and WhatsApp media downloads from approved providers; simulate media server hanging >15sec and send response mismatch; verify proxy timeout, retries/dedupe, and receipt settlement with actual configured channels and two real users. Requires owner Work credentials and controlled integration accounts, not a production webhook trial.
- **Source risks to verify:** 15-second per-request deadline can produce legitimate retryable provider failure under slow networks; response body error after a provider **already sent** a message creates uncertain delivery and must reconcile against existing durable bridge idempotency, not blindly resend; outgoing JSON envelope 256 KiB should be qualified with current Telegram/Graph API responses. If a JSON response omits its body, fail-closed instead of claiming success.

### Exact final Work actions
1. Read draft #451 and this stacked child together. Preserve parent HMAC/private Telegram ID/streaming safety fixes; compare current main with any active R15/shared Gateway edits and new CI test failures. Merge/reconcile source in order only after verified proofs.
2. Run Node 24 + pnpm 12 focused typecheck, test and wider channel suites. Fix TypeScript, mocked ReadableStream/AbortSignal semantics or Fastify propagation errors at the exact SHA; **do not** call them passing from source inspection.
3. Run controlled integration with signed test WhatsApp and Telegram webhooks, actual provider media metadata, fast & slow provider errors, cancelled upstream stream, malformed JSON, large JSON and exactly-once delivery receipts. Verify retry policy and no duplicate send after an unknown provider success; preserve the original WhatsApp/Telegram channel requirements and privacy constraints.
4. Restore executable CI through the #457 shared Work owner without bypassing tests. Final integration must deploy and test at known Gateway SHA, prove valid media and send/receipt readback, and document rollback and live monitoring.
5. Keep this PR and parent draft/unmerged until real test/provider evidence, review, and collisions resolved. No DB schema or mobile/Flutter changes are made or required for this independent boundary, but complete platform R15/R16 and J journeys stay open.

### Flags
| Evidence gate | State |
| --- | --- |
| SOURCE_WRITTEN / UNIT_TESTS_WRITTEN | YES / YES |
| LOCAL_TESTED / CI_EXECUTED / INTEGRATION_TESTED | NO / NO / NO |
| ACTUAL_PROVIDER_QUALIFIED / DEPLOYED / MERGED | NO / NO / NO |
| FULL_R15_DONE / WHATSAPP_TELEGRAM_E2E_DONE | NO / NO |

**Rollback:** revert the bounded provider response helper/deadline changes without touching migrations, persistent messages or secrets; failing closed may increase webhook retries until Work confirms provider result semantics. The original provider response cap and webhook identity commitments remain intact.

## Review URL / immutable implementation reference
- New child draft PR **#488**: https://github.com/Baatiku/masanawa/pull/488 (stacked base parent draft **#451**, no direct merge to main). Parent branch at reclaim: `eb14419a5290c52680fe0896418a199383dd8532`.
- Code/test source commit `488220f68920d56b4671866066fe550a9788b8c5`; initial full handoff commit `12314df58d5507a1c8ce1598c2a40442c095294b`. Latest checkpoint is the PR head. Connector verified three changed paths, all within this workstream claim. No other PR source overwritten; no tests executed, no CI retry or production deploy.
