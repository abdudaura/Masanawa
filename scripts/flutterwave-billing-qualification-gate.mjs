#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const DEFAULT_REQUIRED_CATEGORIES = Object.freeze([
  "AIRTIME",
  "MOBILEDATA",
  "CABLEBILLS",
  "UTILITYBILLS",
]);

function fail(message) {
  throw new Error(message);
}

function parseCsv(value, fallback = []) {
  if (value === undefined || value === null) return [...fallback];
  if (value.trim() === "") return [];
  return [...new Set(value.split(",").map((part) => part.trim()).filter(Boolean))];
}

function boundedText(value, label, max = 300) {
  if (typeof value !== "string") fail(`${label} must be text`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max || /[\r\n\0]/u.test(trimmed)) {
    fail(`${label} is invalid`);
  }
  return trimmed;
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value;
}

export function evaluateBillingQualification(report, options = {}) {
  const root = requireObject(report, "qualification report");
  if (root.schemaVersion !== 1) fail("qualification schemaVersion must be 1");
  if (root.provider !== "flutterwave") fail("qualification provider must be flutterwave");
  if (root.country !== "NG") fail("qualification country must be NG");

  const requiredCategories = parseCsv(
    options.requiredCategories,
    DEFAULT_REQUIRED_CATEGORIES,
  );
  const validationRequiredCategories = parseCsv(
    options.validationRequiredCategories,
    ["CABLEBILLS", "UTILITYBILLS"],
  );

  const categories = requireArray(root.categories, "categories");
  const categoryMap = new Map();

  for (const [index, rawCategory] of categories.entries()) {
    const category = requireObject(rawCategory, `category ${index}`);
    const code = boundedText(category.code, `category ${index} code`, 128);
    if (categoryMap.has(code)) fail(`duplicate category ${code}`);

    const billers = requireArray(category.billers, `${code} billers`);
    if (billers.length === 0) fail(`${code} has no enabled billers`);

    let itemCount = 0;
    const billerCodes = new Set();
    for (const [billerIndex, rawBiller] of billers.entries()) {
      const biller = requireObject(rawBiller, `${code} biller ${billerIndex}`);
      const billerCode = boundedText(
        biller.billerCode,
        `${code} biller ${billerIndex} code`,
        128,
      );
      if (billerCodes.has(billerCode)) fail(`duplicate biller ${code}/${billerCode}`);
      billerCodes.add(billerCode);

      const items = requireArray(biller.items, `${code}/${billerCode} items`);
      if (items.length === 0) fail(`${code}/${billerCode} has no enabled items`);
      const itemCodes = new Set();
      for (const [itemIndex, rawItem] of items.entries()) {
        const item = requireObject(rawItem, `${code}/${billerCode} item ${itemIndex}`);
        const itemCode = boundedText(
          item.itemCode,
          `${code}/${billerCode} item ${itemIndex} code`,
          128,
        );
        if (itemCodes.has(itemCode)) {
          fail(`duplicate item ${code}/${billerCode}/${itemCode}`);
        }
        itemCodes.add(itemCode);
        if (item.currency !== "NGN") {
          fail(`${code}/${billerCode}/${itemCode} is not NGN`);
        }
        itemCount += 1;
      }
    }

    categoryMap.set(code, Object.freeze({ code, billerCount: billers.length, itemCount }));
  }

  const missingCategories = requiredCategories.filter((code) => !categoryMap.has(code));

  const validationResults = requireArray(
    root.validationResults ?? [],
    "validationResults",
  );
  const validValidationCategories = new Set();
  for (const [index, rawResult] of validationResults.entries()) {
    const result = requireObject(rawResult, `validation result ${index}`);
    const code = boundedText(
      result.categoryCode,
      `validation result ${index} categoryCode`,
      128,
    );
    if (result.catalogMatch === true && result.valid === true) {
      validValidationCategories.add(code);
    }
  }
  const missingValidation = validationRequiredCategories.filter(
    (code) => !validValidationCategories.has(code),
  );

  const accepted = missingCategories.length === 0 && missingValidation.length === 0;

  return Object.freeze({
    schemaVersion: 1,
    accepted,
    provider: "flutterwave",
    country: "NG",
    checkedAt: typeof root.checkedAt === "string" ? root.checkedAt : null,
    requiredCategories: Object.freeze(requiredCategories),
    qualifiedCategories: Object.freeze(
      requiredCategories.filter((code) => categoryMap.has(code)),
    ),
    missingCategories: Object.freeze(missingCategories),
    validationRequiredCategories: Object.freeze(validationRequiredCategories),
    validatedCategories: Object.freeze(
      validationRequiredCategories.filter((code) => validValidationCategories.has(code)),
    ),
    missingValidation: Object.freeze(missingValidation),
    counts: Object.freeze({
      categoryCount: categories.length,
      billerCount: [...categoryMap.values()].reduce((sum, entry) => sum + entry.billerCount, 0),
      itemCount: [...categoryMap.values()].reduce((sum, entry) => sum + entry.itemCount, 0),
      validationEvidenceCount: validationResults.filter(
        (entry) => entry && typeof entry === "object" && entry.catalogMatch === true && entry.valid === true,
      ).length,
    }),
  });
}

async function readInput(path) {
  if (path && path !== "-") return JSON.parse(await readFile(path, "utf8"));
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  if (!data.trim()) fail("qualification report JSON is required on stdin or as a file path");
  return JSON.parse(data);
}

async function main(argv) {
  const args = [...argv];
  let requiredCategories;
  let validationRequiredCategories;
  let path;

  while (args.length > 0) {
    const arg = args.shift();
    if (arg === "--required-categories") {
      requiredCategories = args.shift();
      if (requiredCategories === undefined) fail("--required-categories needs a value");
    } else if (arg === "--require-validation") {
      validationRequiredCategories = args.shift();
      if (validationRequiredCategories === undefined) fail("--require-validation needs a value");
    } else if (arg?.startsWith("--")) {
      fail(`unknown option ${arg}`);
    } else if (path === undefined) {
      path = arg;
    } else {
      fail("only one report path may be supplied");
    }
  }

  const report = await readInput(path);
  const result = evaluateBillingQualification(report, {
    requiredCategories,
    validationRequiredCategories,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.accepted) process.exitCode = 2;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`billing qualification gate failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
