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
