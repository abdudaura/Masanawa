export interface TelegramWebhookRegistrationConfig {
  readonly botToken: string;
  readonly webhookSecret: string;
  readonly webhookUrl: string;
}

export interface TelegramWebhookInfo {
  readonly url: string;
  readonly pendingUpdateCount: number;
  readonly lastErrorDate: number | null;
  readonly lastErrorMessage: string | null;
}

type FetchLike = typeof fetch;

function telegramApi(botToken: string, method: string): string {
  return `https://api.telegram.org/bot${encodeURIComponent(botToken)}/${method}`;
}

function validate(config: TelegramWebhookRegistrationConfig): void {
  const url = new URL(config.webhookUrl);
  if (url.protocol !== "https:") {
    throw new TypeError("Telegram webhook URL must use HTTPS");
  }
  if (!config.botToken.trim()) {
    throw new TypeError("Telegram bot token is required");
  }
  if (!/^[A-Za-z0-9_-]{1,256}$/u.test(config.webhookSecret)) {
    throw new TypeError("Telegram webhook secret is invalid");
  }
}

async function apiJson(
  fetchImpl: FetchLike,
  url: string,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  const response = await fetchImpl(url, init);
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || body.ok !== true) {
    throw new Error(`channels.telegram_webhook_http_${response.status}`);
  }
  return body;
}

export async function registerAndVerifyTelegramWebhook(
  config: TelegramWebhookRegistrationConfig,
  options: Readonly<{ fetchImpl?: FetchLike }> = {},
): Promise<TelegramWebhookInfo> {
  validate(config);
  const fetchImpl = options.fetchImpl ?? fetch;

  const registration = await apiJson(
    fetchImpl,
    telegramApi(config.botToken, "setWebhook"),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: config.webhookUrl,
        secret_token: config.webhookSecret,
        allowed_updates: ["message"],
        drop_pending_updates: false,
      }),
    },
  );
  if (registration.result !== true) {
    throw new Error("channels.telegram_webhook_registration_rejected");
  }

  const infoBody = await apiJson(
    fetchImpl,
    telegramApi(config.botToken, "getWebhookInfo"),
    { method: "GET" },
  );
  const result = infoBody.result;
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("channels.telegram_webhook_info_missing");
  }
  const row = result as Record<string, unknown>;
  const url = typeof row.url === "string" ? row.url : "";
  if (url !== config.webhookUrl) {
    throw new Error("channels.telegram_webhook_url_mismatch");
  }

  return Object.freeze({
    url,
    pendingUpdateCount:
      typeof row.pending_update_count === "number" &&
      Number.isSafeInteger(row.pending_update_count)
        ? row.pending_update_count
        : 0,
    lastErrorDate:
      typeof row.last_error_date === "number" &&
      Number.isSafeInteger(row.last_error_date)
        ? row.last_error_date
        : null,
    lastErrorMessage:
      typeof row.last_error_message === "string"
        ? row.last_error_message
        : null,
  });
}
