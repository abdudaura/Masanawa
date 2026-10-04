import type { ChannelIngressRecord, DurableChannelAdmission, WebhookResult } from "./model.js";
import { fail } from "./validation.js";

export async function admit(
  admission: DurableChannelAdmission, records: readonly ChannelIngressRecord[], ignoredEvents: number,
): Promise<WebhookResult> {
  if (records.length > 128) fail("event_limit");
  // Validate the full batch before the first persistence call. Partial batch durability
  // must be reconciled by the injected Gateway owner with stable per-event keys.
  const unique = new Map<string, ChannelIngressRecord>();
  for (const record of records) {
    const existing = unique.get(record.dedupeKey);
    if (existing && existing.evidenceHash !== record.evidenceHash) fail("event_conflict");
    unique.set(record.dedupeKey, existing ?? record);
  }
  const batch = Object.freeze([...unique.values()]);
  if (batch.length > 0) {
    try {
      const result = await admission.admitBatch(batch);
      if (result?.outcome !== "persisted" && result?.outcome !== "duplicate") fail("persistence_unavailable", "unavailable");
    } catch {
      // Do not leak database/provider errors or private evidence in the HTTP surface.
      fail("persistence_unavailable", "unavailable");
    }
  }
  return Object.freeze({ statusCode: 200, admittedRecords: batch.length, ignoredEvents });
}
