const baseUrl = (process.env.NOWPAYMENTS_BASE_URL ?? "https://api.nowpayments.io/v1").replace(/\/+$/, "");
const apiKey = process.env.NOWPAYMENTS_API_KEY?.trim();

if (!apiKey) {
  console.error("[nowpayments-smoke] missing_api_key");
  process.exit(1);
}

async function request(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        accept: "application/json",
      },
      signal: controller.signal,
    });
    const text = await response.text();
    let body = null;
    try { body = JSON.parse(text); } catch {}
    if (!response.ok) {
      console.error(`[nowpayments-smoke] ${path} http=${response.status}`);
      process.exitCode = 1;
      return { ok: false, status: response.status, body: null };
    }
    console.log(`[nowpayments-smoke] ${path} http=${response.status}`);
    return { ok: true, status: response.status, body };
  } catch (error) {
    console.error(`[nowpayments-smoke] ${path} transport=${error instanceof Error ? error.name : "unknown"}`);
    process.exitCode = 1;
    return { ok: false, status: 0, body: null };
  } finally {
    clearTimeout(timer);
  }
}

const status = await request("/status");
if (status.ok) {
  const providerMessage =
    status.body && typeof status.body === "object" && typeof status.body.message === "string"
      ? status.body.message.slice(0, 80)
      : "ok";
  console.log(`[nowpayments-smoke] provider_status=${providerMessage}`);
}

const currencies = await request("/currencies");
if (currencies.ok) {
  const list = Array.isArray(currencies.body?.currencies) ? currencies.body.currencies : null;
  if (!list || !list.every((value) => typeof value === "string")) {
    console.error("[nowpayments-smoke] currencies invalid_shape");
    process.exitCode = 1;
  } else {
    const hasErc20 = list.some((value) => /erc20$/i.test(value));
    const hasUsdtTrc20 = list.some((value) => /^usdttrc20$/i.test(value));
    console.log(`[nowpayments-smoke] currencies_count=${list.length} has_usdttrc20=${hasUsdtTrc20} provider_lists_erc20=${hasErc20}`);
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log("[nowpayments-smoke] success");
