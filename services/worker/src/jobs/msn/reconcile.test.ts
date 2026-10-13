import { describe, expect, it, vi } from "vitest";
import { runMsnStagedReconciliation } from "./reconcile.js";

describe("MSN accounting worker adapter", () => {
  it("reports only bounded counts and never releases issuance", async () => {
    const scan = vi.fn(async () => ({
      scanned: 3, truncated: false,
      results: [
        { state: "funding_pending" as const, reasons: [], custodyQualified: false as const },
        { state: "backing_pending" as const, reasons: [], custodyQualified: false as const },
        { state: "anomaly" as const, reasons: ["double_entry_mismatch"],
          custodyQualified: false as const },
      ],
    }));
    expect(await runMsnStagedReconciliation({ scan }, { tenantId: "tenant1" }))
      .toEqual({ scanned: 3, anomalous: 1, awaitingBacking: 1,
        truncated: false, custodyQualified: false });
    expect(scan).toHaveBeenCalledWith("tenant1", 50);
  });
  it("rejects invalid tenant, limit and dishonest custody status", async () => {
    const scan = vi.fn(async () => ({
      scanned: 1, truncated: false,
      results: [{ state: "backing_pending" as const, reasons: [],
        custodyQualified: true as unknown as false }],
    }));
    await expect(runMsnStagedReconciliation({ scan }, { tenantId: "x y" }))
      .rejects.toThrow("tenant_invalid");
    await expect(runMsnStagedReconciliation({ scan }, { tenantId: "t1", limit: 101 }))
      .rejects.toThrow("limit_invalid");
    expect(scan).not.toHaveBeenCalled();
    await expect(runMsnStagedReconciliation({ scan }, { tenantId: "t1" }))
      .rejects.toThrow("report_invalid");
  });
});
