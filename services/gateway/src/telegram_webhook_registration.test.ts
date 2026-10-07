import { describe, expect, it, vi } from "vitest";
import { registerAndVerifyTelegramWebhook } from "./telegram_webhook_registration.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Telegram webhook registration", () => {
  it("registers the canonical webhook and verifies Telegram reports the same URL", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ ok: true, result: true }))
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          result: {
            url: "https://gateway.masanawa.com/channels/telegram/webhook",
            pending_update_count: 2,
          },
        }),
      );

    const result = await registerAndVerifyTelegramWebhook(
      {
        botToken: "123456:token",
        webhookSecret: "secret_token_123",
        webhookUrl: "https://gateway.masanawa.com/channels/telegram/webhook",
      },
      { fetchImpl },
    );

    expect(result.url).toBe(
      "https://gateway.masanawa.com/channels/telegram/webhook",
    );
    expect(result.pendingUpdateCount).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const setWebhook = fetchImpl.mock.calls[0]!;
    expect(setWebhook[0]).toContain("/setWebhook");
    expect(JSON.parse(String(setWebhook[1]?.body))).toEqual({
      url: "https://gateway.masanawa.com/channels/telegram/webhook",
      secret_token: "secret_token_123",
      allowed_updates: ["message"],
      drop_pending_updates: false,
    });
  });

  it("fails closed when Telegram reports a different active webhook URL", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ ok: true, result: true }))
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          result: {
            url: "https://wrong.example/webhook",
            pending_update_count: 0,
          },
        }),
      );

    await expect(
      registerAndVerifyTelegramWebhook(
        {
          botToken: "123456:token",
          webhookSecret: "secret_token_123",
          webhookUrl: "https://gateway.masanawa.com/channels/telegram/webhook",
        },
        { fetchImpl },
      ),
    ).rejects.toThrow("channels.telegram_webhook_url_mismatch");
  });

  it("rejects non-HTTPS webhook URLs before calling Telegram", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(
      registerAndVerifyTelegramWebhook(
        {
          botToken: "123456:token",
          webhookSecret: "secret_token_123",
          webhookUrl: "http://localhost/channels/telegram/webhook",
        },
        { fetchImpl },
      ),
    ).rejects.toThrow("Telegram webhook URL must use HTTPS");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
