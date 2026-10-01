import { describe, expect, it } from "vitest";
import { assertIdempotencyMatch } from "./idempotency.js";

describe("idempotency binding", () => {
  it("accepts the same canonical request fingerprint", () => {
    expect(() =>
      assertIdempotencyMatch({ requestFingerprint: "abc" }, "abc"),
    ).not.toThrow();
  });

  it("rejects same key semantics when canonical request changed", () => {
    expect(() =>
      assertIdempotencyMatch({ requestFingerprint: "abc" }, "def"),
    ).toThrow(/different canonical request/);
  });
});
