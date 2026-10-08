# R15 — Private channel webhook identity and size boundaries

- **Owner/window:** ChatGPT channel webhook safety, 2026-10-08.
- **Branch:** `work/r15-channel-webhook-boundaries-20261008`; **base main:** `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`.
- **Readiness:** R15 P1 (secure WhatsApp/Telegram gateway boundary), following isolated PR #448.
- **Exact owned files:** `services/gateway/src/customer_channel_routes.ts`, `services/gateway/src/customer_channel_routes.test.ts`, `docs/workstreams/r15-channel-webhook-boundaries-20261008.md`.
- **Current activity:** Claim published on branch; recheck PR paths before editing.
- **Neighboring PRs:** #443 R15 covers `talk_ai_seats` and `talk_safety` only; #440 finance, #436 Firebase, #448 `talk_ai_worker`. Do not edit these.
- **Task:** Enforce Telegram sender/private-chat identity consistency before linking/conversation, bound WhatsApp raw signature buffer and webhook request size, and add executable Fastify regression tests.
- **Implementation/verification/deployment:** NOT STARTED / NOT RUN / NOT DEPLOYED at claim. No provider or account mutation intended.
- **Handoff:** Pending tests, diff audit and draft PR; review actual Telegram/WhatsApp API payloads before merging.
