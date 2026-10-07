# Telegram webhook autoregistration workstream

Owner/window: current ChatGPT window
Branch: `work/telegram-webhook-autoregistration-20261007`
Base: `main` @ `6d0ff3316603df5d91da892e043c16ee6c209abf`
Started: 2026-10-07

## Scope

Remove the manual Telegram Bot API `setWebhook` deployment step.

Owned paths:
- `services/gateway/src/telegram_webhook_registration.ts`
- Gateway startup/config/docs/tests directly required for Telegram registration

## Acceptance

- Telegram-enabled Gateway derives or accepts one HTTPS webhook URL.
- Startup registers the webhook with Telegram using the configured secret token.
- Registration is verified with `getWebhookInfo`.
- Startup fails closed when Telegram reports a mismatched URL or registration failure.
- Bot token and webhook secret remain server-side only.
- No message processing/runtime duplication is introduced.


## Completed implementation

- Added deterministic Telegram `setWebhook` registration and `getWebhookInfo` verification.
- Uses an explicit `MASANAWA_TELEGRAM_WEBHOOK_URL` or derives the canonical endpoint from `MASANAWA_PUBLIC_BASE_URL`.
- HTTPS is mandatory.
- Webhook secret is registered as Telegram's secret token.
- Only message updates are requested and pending updates are not discarded.
- Gateway startup fails closed if registration fails or Telegram reports a different URL.
- Added focused registration tests for success, URL mismatch and non-HTTPS rejection.

Remaining external evidence: deploy with a real bot token and confirm Telegram delivery to the production Gateway.
