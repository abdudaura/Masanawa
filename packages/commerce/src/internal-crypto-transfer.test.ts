import { describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import { createTransferConsent, validateInternalTransfer, verifyTransferConsent } from "./internal-crypto-transfer.js";

function terms() {
  return {
    tenantId: createCanonicalId("tenant"), senderUserId: createCanonicalId("user"),
    recipientUserId: createCanonicalId("user"), requestId: createCanonicalId("request"),
    recipientLabel: "receiver@example.com", asset: "USDTTRC20",
    network: "tron", amount: "1.000000000000000001",
  };
}
describe("C06 immutable book-transfer terms and one-use consent", () => {
  it("keeps exact 18-place decimal quantity and canonical role identity", () => {
    expect(validateInternalTransfer(terms()).amount).toBe("1.000000000000000001");
  });
  it("rejects self transfer even if caller provides a valid request id", () => {
    const source=terms();
    expect(() => validateInternalTransfer({...source,recipientUserId:source.senderUserId}))
      .toThrow("crypto.transfer.self_forbidden");
  });
  it("rejects negative and unbounded precision", () => {
    expect(() => validateInternalTransfer({...terms(),amount:"-1"})).toThrow();
    expect(() => validateInternalTransfer({...terms(),amount:"1.1234567890123456789"})).toThrow();
  });
  it("binds a cryptographically random token to only its hash", () => {
    const a=createTransferConsent();
    const b=createTransferConsent();
    expect(a.token).not.toEqual(b.token);
    expect(a.hash).not.toEqual(a.token);
    expect(verifyTransferConsent(a.token,a.hash)).toBe(true);
    expect(verifyTransferConsent(b.token,a.hash)).toBe(false);
    expect(verifyTransferConsent("zz",a.hash)).toBe(false);
  });
});
