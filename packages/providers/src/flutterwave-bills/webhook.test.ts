import { describe, expect, it } from "vitest";
import { verifyFlutterwaveV3Webhook } from "./webhook.js";

function body(value: unknown): Uint8Array {
  return Buffer.from(JSON.stringify(value), "utf8");
}

describe("verifyFlutterwaveV3Webhook", () => {
  it("accepts exact v3 verif-hash evidence and fingerprints the raw body", () => {
    const evidence = verifyFlutterwaveV3Webhook({
      rawBody: body({ event: "bill.completed", data: { status: "successful" } }),
      verifHash: "random-secret-hash",
      expectedSecretHash: "random-secret-hash",
    });
    expect(evidence.version).toBe("v3-secret-hash");
    expect(evidence.event).toBe("bill.completed");
    expect(evidence.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });

  it("rejects a missing or mismatched signature before payload use", () => {
    expect(() =>
      verifyFlutterwaveV3Webhook({
        rawBody: body({ event: "bill.completed" }),
        verifHash: "wrong",
        expectedSecretHash: "right",
      }),
    ).toThrow("Flutterwave webhook signature is invalid");
  });

  it("does not interpret webhook success as settlement authority", () => {
    const evidence = verifyFlutterwaveV3Webhook({
      rawBody: body({
        event: "bill.completed",
        data: {
          status: "successful",
          amount: "999999",
          customer_id: "attacker-controlled",
        },
      }),
      verifHash: "secret",
      expectedSecretHash: "secret",
    });
    expect(evidence.payload).toMatchObject({
      data: {
        status: "successful",
        amount: "999999",
      },
    });
    expect("settled" in evidence).toBe(false);
  });

  it("rejects oversized webhook bodies", () => {
    expect(() =>
      verifyFlutterwaveV3Webhook({
        rawBody: new Uint8Array(1_048_577),
        verifHash: "secret",
        expectedSecretHash: "secret",
      }),
    ).toThrow("Flutterwave webhook body is too large");
  });
});
