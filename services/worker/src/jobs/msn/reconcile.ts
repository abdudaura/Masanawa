/**
 * Worker-facing adapter for the read-only staged reconciliation scan.
 * Deliberately NOT registered into production worker startup. Deploy only
 * after the 0112 migration, tenancy and provider custody gates are approved.
 */
export interface MsnScanResult {
  readonly state: "funding_pending" | "backing_pending" |
    "issued_accounting_consistent" | "anomaly";
  readonly reasons: readonly string[];
  readonly custodyQualified: false;
}
export interface MsnStagedScanner {
  scan(tenantId: string, limit: number): Promise<{
    readonly scanned: number;
    readonly results: readonly MsnScanResult[];
    readonly truncated: boolean;
  }>;
}
export async function runMsnStagedReconciliation(
  scanner: MsnStagedScanner,
  input: Readonly<{ tenantId: string; limit?: number }>,
): Promise<Readonly<{
  scanned: number; anomalous: number; awaitingBacking: number;
  truncated: boolean; custodyQualified: false;
}>> {
  if (!/^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/.test(input.tenantId))
    throw new Error("msn.reconcile.tenant_invalid");
  const limit = input.limit ?? 50;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw new Error("msn.reconcile.limit_invalid");
  const report = await scanner.scan(input.tenantId, limit);
  if (report.scanned !== report.results.length || report.scanned > limit ||
      typeof report.truncated !== "boolean")
    throw new Error("msn.reconcile.report_invalid");
  const anomalous = report.results.filter(x => x.state === "anomaly").length;
  if (report.results.some(x => x.custodyQualified !== false ||
      (x.state === "anomaly" && x.reasons.length === 0) ||
      (x.state !== "anomaly" && x.reasons.length !== 0)))
    throw new Error("msn.reconcile.report_invalid");
  return Object.freeze({
    scanned: report.scanned,
    anomalous,
    awaitingBacking: report.results.filter(x => x.state === "backing_pending").length,
    truncated: report.truncated,
    custodyQualified: false as const,
  });
}
