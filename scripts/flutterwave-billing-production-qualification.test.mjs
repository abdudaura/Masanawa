import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateProductionQualificationInputs } from "./flutterwave-billing-production-qualification.mjs";

test("importing the production qualifier is side-effect free, while CLI preflight still fails closed", () => {
  const moduleUrl = new URL(
    "./flutterwave-billing-production-qualification.mjs",
    import.meta.url,
  );
  const env = { FLUTTERWAVE_QUALIFICATION_TARGETS_JSON: "" };
  const imported = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", `await import(${JSON.stringify(moduleUrl.href)})`],
    { encoding: "utf8", env, timeout: 5000 },
  );
  assert.equal(imported.status, 0, imported.stderr);
  assert.equal(imported.stdout, "");
  assert.equal(imported.stderr, "");

  // An explicit CLI call without real Cable/Electricity targets must still
  // block production qualification before contacting any provider.
  const executed = spawnSync(
    process.execPath,
    [fileURLToPath(moduleUrl)],
    { encoding: "utf8", env, timeout: 5000 },
  );
  assert.equal(executed.status, 2, executed.stderr);
  assert.match(executed.stderr, /FLUTTERWAVE_QUALIFICATION_TARGETS_JSON is required/u);
});

test("production runner never invokes payment or refund scripts", async () => {
  const source = await readFile(
    new URL("./flutterwave-billing-production-qualification.mjs", import.meta.url),
    "utf8",
  );
  assert.match(source, /flutterwave-billing-catalog-qualification\.mjs/u);
  assert.match(source, /flutterwave-billing-qualification-gate\.mjs/u);
  assert.doesNotMatch(source, /createPayment|refund|purchase|checkout/u);
});

test("production runner stores temporary report with owner-only mode and deletes it", async () => {
  const source = await readFile(
    new URL("./flutterwave-billing-production-qualification.mjs", import.meta.url),
    "utf8",
  );
  assert.match(source, /mode:\s*0o600/u);
  assert.match(source, /rm\(dir, \{ recursive: true, force: true \}\)/u);
});

test("production runner preserves incomplete-evidence exit code 2", async () => {
  const source = await readFile(
    new URL("./flutterwave-billing-production-qualification.mjs", import.meta.url),
    "utf8",
  );
  assert.match(source, /gate\.code === 2/u);
  assert.match(source, /billing must remain disabled/u);
});


test("production preflight requires both Cable and Electricity validation targets", () => {
  assert.throws(
    () => validateProductionQualificationInputs({}),
    /FLUTTERWAVE_QUALIFICATION_TARGETS_JSON is required/u,
  );
  assert.throws(
    () =>
      validateProductionQualificationInputs({
        FLUTTERWAVE_QUALIFICATION_TARGETS_JSON: JSON.stringify([
          { categoryCode: "CABLEBILLS" },
        ]),
      }),
    /UTILITYBILLS/u,
  );

  const result = validateProductionQualificationInputs({
    FLUTTERWAVE_QUALIFICATION_TARGETS_JSON: JSON.stringify([
      { categoryCode: "CABLEBILLS" },
      { categoryCode: "UTILITYBILLS" },
    ]),
  });
  assert.equal(result.targetCount, 2);
  assert.deepEqual(result.requiredValidationCategories, [
    "CABLEBILLS",
    "UTILITYBILLS",
  ]);
});

test("production preflight rejects malformed qualification target JSON", () => {
  assert.throws(
    () =>
      validateProductionQualificationInputs({
        FLUTTERWAVE_QUALIFICATION_TARGETS_JSON: "{not-json",
      }),
    /not valid JSON/u,
  );
});
