const apiKey = process.env.NOWPAYMENTS_API_KEY?.trim();
const email = process.env.NOWPAYMENTS_PAYOUT_EMAIL?.trim();
const password = process.env.NOWPAYMENTS_PAYOUT_PASSWORD?.trim();

if (!apiKey || !email || !password) {
  console.error("[nowpayments-custody-smoke] required credentials missing");
  process.exit(1);
}

async function request(path, init) {
  let response;
  try {
    response = await fetch(`https://api.nowpayments.io/v1${path}`, {
      ...init,
      headers: {
        "x-api-key": apiKey,
        accept: "application/json",
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error("provider_unreachable");
  }
  if (!response.ok) throw new Error(`http_${response.status}`);
  return response;
}

try {
  const auth = await request("/auth", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const authBody = await auth.json();
  const token =
    typeof authBody?.token === "string" ? authBody.token.trim() :
    typeof authBody?.jwt === "string" ? authBody.jwt.trim() : "";
  if (!token) throw new Error("auth_token_missing");

  const balance = await request("/balance", { method: "GET" });
  const body = await balance.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("balance_invalid");
  }
  const currencyCount = Object.keys(body).length;
  console.info(`[nowpayments-custody-smoke] success authenticated=true balance_readable=true currencies=${currencyCount}`);
} catch (error) {
  console.error(`[nowpayments-custody-smoke] failed code=${error instanceof Error ? error.message : "unknown"}`);
  process.exit(1);
}
