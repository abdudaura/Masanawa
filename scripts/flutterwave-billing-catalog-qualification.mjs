#!/usr/bin/env node

/**
 * Read-only Flutterwave bill-service qualification.
 *
 * This script NEVER creates a bill payment. It only performs GET requests for
 * category/biller/item discovery and optional customer validation.
 *
 * Required:
 *   FLUTTERWAVE_SECRET_KEY
 *
 * Fixed-IP relay (deployed Masanawa configuration):
 *   FLUTTERWAVE_RELAY_URL=https://209-38-107-173.sslip.io
 *   FLUTTERWAVE_RELAY_PROTOCOL=dual-header
 *   MASANAWA_FLUTTERWAVE_RELAY_TOKEN=...
 *
 * Optional validation targets:
 *   FLUTTERWAVE_QUALIFICATION_TARGETS_JSON='[
 *     {"categoryCode":"CABLEBILLS","billerCode":"BIL119","itemCode":"CB141","customerId":"..."}
 *   ]'
 *
 * Customer identifiers are never printed.
 */

const PROVIDER_BASE = "https://api.flutterwave.com";
const country = "NG";
const secretKey = process.env.FLUTTERWAVE_SECRET_KEY?.trim() ?? "";
const relayUrl = process.env.FLUTTERWAVE_RELAY_URL?.trim() ?? "";
const relayToken = process.env.MASANAWA_FLUTTERWAVE_RELAY_TOKEN?.trim() ?? "";
const relayProtocol =
  process.env.FLUTTERWAVE_RELAY_PROTOCOL?.trim() === "dual-header"
    ? "dual-header"
    : "bearer";
const timeoutMs = Number(process.env.FLUTTERWAVE_QUALIFICATION_TIMEOUT_MS ?? "15000");

function fail(message) {
  process.stderr.write(`qualification failed: ${message}\n`);
  process.exitCode = 1;
  throw new Error(message);
}

function bounded(value, label, max = 200) {
  if (typeof value !== "string") fail(`${label} must be text`);
  const result = value.trim();
  if (!result || result.length > max || /[\r\n\0]/u.test(result)) {
    fail(`${label} is invalid`);
  }
  return result;
}

function readTargets() {
  const raw = process.env.FLUTTERWAVE_QUALIFICATION_TARGETS_JSON?.trim();
  if (!raw) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail("FLUTTERWAVE_QUALIFICATION_TARGETS_JSON is not valid JSON");
  }
  if (!Array.isArray(parsed) || parsed.length > 100) {
    fail("qualification targets must be an array of at most 100 entries");
  }
  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      fail(`qualification target ${index} is invalid`);
    }
    return Object.freeze({
      index,
      categoryCode: bounded(entry.categoryCode, `target ${index} categoryCode`, 128),
      billerCode: bounded(entry.billerCode, `target ${index} billerCode`, 128),
      itemCode: bounded(entry.itemCode, `target ${index} itemCode`, 128),
      customerId: bounded(entry.customerId, `target ${index} customerId`, 200),
    });
  });
}

if (!secretKey) fail("FLUTTERWAVE_SECRET_KEY is required");
if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) {
  fail("FLUTTERWAVE_QUALIFICATION_TIMEOUT_MS must be 1000..120000");
}
if (Boolean(relayUrl) !== Boolean(relayToken)) {
  fail("relay URL and relay token must be configured together");
}
if (relayUrl && relayProtocol !== "dual-header" && relayProtocol !== "bearer") {
  fail("relay protocol is invalid");
}

const base = new URL(relayUrl || PROVIDER_BASE);
if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) {
  fail("Flutterwave qualification base URL must be credential-free HTTPS");
}
base.pathname = base.pathname.replace(/\/+$/u, "");

function providerHeaders() {
  if (!relayUrl) {
    return {
      authorization: `Bearer ${secretKey}`,
      accept: "application/json",
    };
  }
  if (relayProtocol === "dual-header") {
    return {
      authorization: `Bearer ${secretKey}`,
      "x-masanawa-relay-token": relayToken,
      accept: "application/json",
    };
  }
  return {
    authorization: `Bearer ${relayToken}`,
    accept: "application/json",
  };
}

async function get(path, query = {}) {
  if (!path.startsWith("/v3/")) fail("qualification attempted a non-v3 path");
  const url = new URL(`${base.toString().replace(/\/+$/u, "")}${path}`);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    method: "GET",
    headers: providerHeaders(),
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      fail(`Flutterwave returned non-JSON for GET ${path} (${response.status})`);
    }
  }
  if (!response.ok) {
    const providerMessage =
      body && typeof body === "object" && typeof body.message === "string"
        ? body.message.slice(0, 300)
        : "provider request rejected";
    fail(`GET ${path} returned HTTP ${response.status}: ${providerMessage}`);
  }
  if (!body || typeof body !== "object" || body.status !== "success") {
    fail(`GET ${path} did not return a successful Flutterwave envelope`);
  }
  return body.data;
}

function array(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value;
}

function text(value, label, max = 300) {
  return bounded(value, label, max);
}

function optionalText(value, label, max = 300) {
  if (value === null || value === undefined || value === "") return null;
  return text(value, label, max);
}

function amount(value, label) {
  const candidate =
    typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : text(value, label, 80);
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(candidate)) {
    fail(`${label} is not a non-negative decimal`);
  }
  return candidate;
}

const categoriesRaw = array(
  await get("/v3/top-bill-categories", { country }),
  "Flutterwave categories",
);

const categories = [];
const itemIndex = new Map();

for (const rawCategory of categoriesRaw) {
  if (!rawCategory || typeof rawCategory !== "object" || Array.isArray(rawCategory)) {
    fail("Flutterwave returned an invalid category");
  }
  if (text(rawCategory.country_code, "category country", 2) !== country) {
    fail("Flutterwave returned a non-Nigerian category");
  }
  const categoryCode = text(rawCategory.code, "category code", 128);
  const categoryName = text(rawCategory.name, "category name", 300);

  const billersRaw = array(
    await get(`/v3/bills/${encodeURIComponent(categoryCode)}/billers`, { country }),
    `billers for ${categoryCode}`,
  );
  const uniqueBillers = new Map();
  for (const rawBiller of billersRaw) {
    if (!rawBiller || typeof rawBiller !== "object" || Array.isArray(rawBiller)) {
      fail(`invalid biller in ${categoryCode}`);
    }
    const billerCode = text(
      rawBiller.biller_code ?? rawBiller.code,
      `${categoryCode} biller code`,
      128,
    );
    if (!uniqueBillers.has(billerCode)) {
      uniqueBillers.set(billerCode, {
        billerCode,
        name: text(rawBiller.name, `${categoryCode} biller name`, 300),
      });
    }
  }

  const billers = [];
  for (const biller of uniqueBillers.values()) {
    const itemsRaw = array(
      await get(`/v3/billers/${encodeURIComponent(biller.billerCode)}/items`),
      `items for ${biller.billerCode}`,
    );
    const items = itemsRaw.map((rawItem) => {
      if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) {
        fail(`invalid item for ${biller.billerCode}`);
      }
      const currency = optionalText(rawItem.currency, "item currency", 3) ?? "NGN";
      if (currency !== "NGN") {
        fail(`non-NGN item returned for ${biller.billerCode}`);
      }
      const item = Object.freeze({
        itemCode: text(rawItem.item_code, "item code", 128),
        name: text(rawItem.name, "item name", 300),
        amount: amount(rawItem.amount, "item amount"),
        currency: "NGN",
        labelName: optionalText(rawItem.label_name, "item label", 200),
      });
      itemIndex.set(
        `${categoryCode}\0${biller.billerCode}\0${item.itemCode}`,
        item,
      );
      return item;
    });
    billers.push(Object.freeze({ ...biller, items: Object.freeze(items) }));
  }

  categories.push(
    Object.freeze({
      code: categoryCode,
      name: categoryName,
      validationPolicy:
        categoryCode === "AIRTIME" || categoryCode === "MOBILEDATA"
          ? "phone-format"
          : "provider-customer-validation",
      billers: Object.freeze(billers),
    }),
  );
}

const validationResults = [];
for (const target of readTargets()) {
  const item = itemIndex.get(
    `${target.categoryCode}\0${target.billerCode}\0${target.itemCode}`,
  );
  if (!item) {
    validationResults.push(
      Object.freeze({
        target: target.index,
        categoryCode: target.categoryCode,
        billerCode: target.billerCode,
        itemCode: target.itemCode,
        catalogMatch: false,
        valid: false,
        reason: "target-not-in-live-catalog",
      }),
    );
    continue;
  }

  if (target.categoryCode === "AIRTIME" || target.categoryCode === "MOBILEDATA") {
    const validPhone = /^(?:0[789]\d{9}|\+?234[789]\d{9})$/u.test(target.customerId);
    validationResults.push(
      Object.freeze({
        target: target.index,
        categoryCode: target.categoryCode,
        billerCode: target.billerCode,
        itemCode: target.itemCode,
        catalogMatch: true,
        valid: validPhone,
        reason: validPhone ? "phone-format-qualified" : "phone-format-invalid",
      }),
    );
    continue;
  }

  const data = await get(
    `/v3/bill-items/${encodeURIComponent(target.itemCode)}/validate`,
    { customer: target.customerId },
  );
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    fail(`validation target ${target.index} returned invalid evidence`);
  }
  const responseCode = text(data.response_code, "validation response code", 32);
  validationResults.push(
    Object.freeze({
      target: target.index,
      categoryCode: target.categoryCode,
      billerCode: target.billerCode,
      itemCode: target.itemCode,
      catalogMatch: true,
      valid:
        responseCode === "00" &&
        optionalText(data.biller_code, "validated biller", 128) === target.billerCode &&
        (optionalText(data.customer, "validated customer", 200) ?? target.customerId) ===
          target.customerId,
      responseCode,
      // Deliberately omit customer ID/name/address from output.
      minimum:
        data.minimum === null || data.minimum === undefined || data.minimum === ""
          ? null
          : amount(data.minimum, "validation minimum"),
      maximum:
        data.maximum === null || data.maximum === undefined || data.maximum === ""
          ? null
          : amount(data.maximum, "validation maximum"),
    }),
  );
}

const output = Object.freeze({
  schemaVersion: 1,
  checkedAt: new Date().toISOString(),
  provider: "flutterwave",
  country,
  relay: relayUrl
    ? { enabled: true, protocol: relayProtocol, host: base.hostname }
    : { enabled: false, protocol: null, host: base.hostname },
  // This report contains provider catalog data only; never credentials or customer identifiers.
  categories: Object.freeze(categories),
  validationResults: Object.freeze(validationResults),
  summary: Object.freeze({
    categoryCount: categories.length,
    billerCount: categories.reduce((count, category) => count + category.billers.length, 0),
    itemCount: categories.reduce(
      (count, category) =>
        count +
        category.billers.reduce((subtotal, biller) => subtotal + biller.items.length, 0),
      0,
    ),
    validationTargetCount: validationResults.length,
    validTargetCount: validationResults.filter((entry) => entry.valid).length,
  }),
});

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
