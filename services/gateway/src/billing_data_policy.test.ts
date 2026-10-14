import { describe, expect, it } from "vitest";
import { isDataBundleCategory, requireDataBundleCategory } from "./billing_data_policy.js";
describe("new bill purchase whitelist", () => {
  it.each(["MOBILEDATA", "mobile_data", "mobile-data", "DATA", "INTERNET"])("permits data %s", (code) => {
    expect(isDataBundleCategory(code)).toBe(true);
    expect(() => requireDataBundleCategory(code)).not.toThrow();
  });
  it.each(["AIRTIME", "ELECTRICITY", "TV", "CABLE", "airtime-data", "", "MOBILEDATAEXTRA"])("rejects non-data %s", (code) => {
    expect(isDataBundleCategory(code)).toBe(false);
    expect(() => requireDataBundleCategory(code)).toThrow("financial.billing.data_only");
  });
});