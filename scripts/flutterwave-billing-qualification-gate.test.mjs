import test from "node:test";
import assert from "node:assert/strict";
import { evaluateBillingQualification } from "./flutterwave-billing-qualification-gate.mjs";

function item(itemCode) {
  return { itemCode, name: itemCode, amount: "100", currency: "NGN", labelName: null };
}

function category(code) {
  return {
    code,
    name: code,
    validationPolicy:
      code === "AIRTIME" || code === "MOBILEDATA"
        ? "phone-format"
        : "provider-customer-validation",
    billers: [{ billerCode: `B-${code}`, name: code, items: [item(`I-${code}`)] }],
  };
}

function report(overrides = {}) {
  return {
    schemaVersion: 1,
    checkedAt: "2026-10-06T09:00:00.000Z",
    provider: "flutterwave",
    country: "NG",
    relay: { enabled: true, protocol: "dual-header", host: "relay.example" },
    categories: [
      category("AIRTIME"),
      category("MOBILEDATA"),
      category("CABLEBILLS"),
      category("UTILITYBILLS"),
    ],
    validationResults: [
      {
        target: 0,
        categoryCode: "CABLEBILLS",
        billerCode: "B-CABLEBILLS",
        itemCode: "I-CABLEBILLS",
        catalogMatch: true,
        valid: true,
        responseCode: "00",
      },
      {
        target: 1,
        categoryCode: "UTILITYBILLS",
        billerCode: "B-UTILITYBILLS",
        itemCode: "I-UTILITYBILLS",
        catalogMatch: true,
        valid: true,
        responseCode: "00",
      },
    ],
    ...overrides,
  };
}

test("accepts launch billing only with all four live families and validation evidence", () => {
  const result = evaluateBillingQualification(report());
  assert.equal(result.accepted, true);
  assert.deepEqual(result.missingCategories, []);
  assert.deepEqual(result.missingValidation, []);
  assert.equal(result.counts.categoryCount, 4);
  assert.equal(result.counts.itemCount, 4);
});

test("rejects a missing launch category", () => {
  const result = evaluateBillingQualification(
    report({ categories: [category("AIRTIME"), category("MOBILEDATA"), category("CABLEBILLS")] }),
  );
  assert.equal(result.accepted, false);
  assert.deepEqual(result.missingCategories, ["UTILITYBILLS"]);
});

test("rejects missing real recipient-validation evidence", () => {
  const result = evaluateBillingQualification(
    report({
      validationResults: [
        {
          target: 0,
          categoryCode: "CABLEBILLS",
          billerCode: "B-CABLEBILLS",
          itemCode: "I-CABLEBILLS",
          catalogMatch: true,
          valid: true,
          responseCode: "00",
        },
      ],
    }),
  );
  assert.equal(result.accepted, false);
  assert.deepEqual(result.missingValidation, ["UTILITYBILLS"]);
});

test("does not count invalid or non-catalog validation targets", () => {
  const result = evaluateBillingQualification(
    report({
      validationResults: [
        {
          target: 0,
          categoryCode: "CABLEBILLS",
          billerCode: "B-CABLEBILLS",
          itemCode: "I-CABLEBILLS",
          catalogMatch: false,
          valid: true,
        },
        {
          target: 1,
          categoryCode: "UTILITYBILLS",
          billerCode: "B-UTILITYBILLS",
          itemCode: "I-UTILITYBILLS",
          catalogMatch: true,
          valid: false,
        },
      ],
    }),
  );
  assert.equal(result.accepted, false);
  assert.deepEqual(result.missingValidation, ["CABLEBILLS", "UTILITYBILLS"]);
});

test("rejects malformed or duplicate provider catalog evidence", () => {
  assert.throws(
    () =>
      evaluateBillingQualification(
        report({
          categories: [category("AIRTIME"), category("AIRTIME")],
        }),
      ),
    /duplicate category AIRTIME/u,
  );
});

test("supports a narrower explicit acceptance policy without changing the report", () => {
  const result = evaluateBillingQualification(
    report({
      categories: [category("AIRTIME"), category("MOBILEDATA")],
      validationResults: [],
    }),
    {
      requiredCategories: "AIRTIME,MOBILEDATA",
      validationRequiredCategories: "",
    },
  );
  assert.equal(result.accepted, true);
});
