# R15 — Private channel webhook identity and request boundaries

- **Window:** ChatGPT R15 independent channel-security window, 2026-10-08.
- **Branch:** `work/r15-channel-webhook-boundaries-20261008`; **base main:** `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`.
- **Exact owned files:** `services/gateway/src/customer_channel_routes.ts`, `services/gateway/src/customer_channel_routes.test.ts`, this file.
- **Excluded active work:** R15 AI Seat safety PR #443, R15 gift safety PR #446, R02/R19 PR #448, R07 PR #447, R05 funding PR #440, all shared runtime configuration and financial providers.
- **Commits:** `77ca2ca` claim; `bc334489` identity/webhook controls; `dd2103bc` regressions; `494e858` bounded streaming; `6f972e2` streamed-media regression.
- **State:** IMPLEMENTED ON BRANCH, NOT EXECUTABLY VERIFIED, NOT MERGED, NOT DEPLOYED.

## Implemented

- WhatsApp signed POSTs now set a bounded, explicit 1 MiB Fastify route body limit. Raw signature bytes are accumulated only while under that limit; on overflow the temporary chunk array is emptied. Existing exact-provider-signature verification and message identity are unchanged. Attachment bytes are retrieved separately through the existing authenticated media endpoint.
- Telegram signed updates require `chat.type === "private"`, positive safe-integer provider sender ID, identical private chat/sender ID, and positive safe-integer message ID. Invalid/mismatched private identities are acknowledged without resolving or linking an account, downloading files, or invoking the assistant.
- Telegram contact linking only accepts a number when the contact's **numeric** `user_id` equals the authenticated message sender's provider ID. Textual lookalikes no longer count. These checks are *in addition to*, not substitutes for, the existing configured Telegram webhook secret.
- Download of WhatsApp or Telegram attachment bytes now reads the response stream incrementally, enforces the 8 MiB cap before buffering more data, and cancels the reader when the server exceeds the advertised or unadvertised size. The old `arrayBuffer()` allocation could exceed the limit before rejecting. Provider media errors still require product-level permanent/retryable handling.
- Updated prior happy-path fixtures to include real Telegram private chat identities rather than fictional mismatched/missing types. Added a signed oversize-WhatsApp 413 assertion, four malformed Telegram cases, invalid-text contact and genuine numeric contact acceptance and untruthful Content-Length media streaming cases.

## Verification and release gates

- **Source review:** only the three claimed paths changed; #443/#446 other R15 workstreams own disjoint `talk_ai_seats`, `talk_gifts` and safety paths.
- **CI evidence:** PR #451 run `37736364387` failed before runner allocation (job `113176693906`, runner_id=0, zero steps), so this is neither source-test failure nor success.
- **Executable tests:** NOT RUN; no pnpm/Vitest dependency graph or GitHub clone connectivity is available here. Run `pnpm exec vitest run services/gateway/src/customer_channel_routes.test.ts`, `pnpm --filter @masanawa/gateway-service typecheck`, the wider channels suite and required CI; check media stream cancellation and Fastify error mapping.
- **Provider check:** Telegram private `message.chat.id === message.from.id` and `message.chat.type` should be qualified with an actual Telegram delivery and contact-share event; WhatsApp oversized request must yield 413 behind the production proxy without reaching the bridge. No webhook secrets, real customer messages or production channels were used in this change.
- **Deployment:** NOT ATTEMPTED; integration owner coordinates canonical main and production configuration.
- **Retry note:** Oversized provider media is still returned as a transport error, so Telegram may retry; an authorized user-facing terminal oversized-media reply and permanent-error acknowledgement need explicit idempotent design and provider tests, not an unverified 200 shortcut.
- **Still open R15:** authenticated channel link **and unlink** user journeys, privacy-safe receipt delivery, revoked/deleted-account sessions, webhook retries and delivery dedupe, user/device qualification. This patch neither implements nor declares those complete.
- **Handoff:** Keep PR draft until executable tests, provider contract review and a conflict-free integration. If Actions fails with zero runner steps, record it as infrastructure evidence, never as passing source tests.
