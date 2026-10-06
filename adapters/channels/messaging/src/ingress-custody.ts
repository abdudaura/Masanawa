import type {
  ChannelIngressRecord,
  DurableChannelAdmission,
} from "./model.js";

export interface ChannelIngressCustodyObservation {
  readonly dedupeKey: string;
  readonly evidenceHash: string;
  readonly outcome: "stored" | "duplicate";
}

export interface AtomicChannelIngressStore {
  /**
   * Atomically admit the complete batch.
   *
   * Implementations must compare every dedupeKey against durable state before
   * committing any new row:
   * - missing key -> stored;
   * - same key + same evidenceHash -> duplicate;
   * - same key + different evidenceHash -> conflict and rollback the whole batch.
   *
   * The returned observations must cover every requested record exactly once.
   */
  admitAtomic(
    records: readonly ChannelIngressRecord[],
  ): Promise<readonly ChannelIngressCustodyObservation[]>;
}

function bounded(value: string, name: string, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (
    normalized.length < 1 ||
    normalized.length > max ||
    normalized.includes("\u0000")
  ) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function canonicalBatch(
  records: readonly ChannelIngressRecord[],
): readonly ChannelIngressRecord[] {
  if (!Array.isArray(records) || records.length > 128) {
    throw new RangeError("channel ingress batch is invalid");
  }

  const seen = new Map<string, ChannelIngressRecord>();
  for (const record of records) {
    const dedupeKey = bounded(record.dedupeKey, "dedupeKey", 256);
    const evidenceHash = bounded(record.evidenceHash, "evidenceHash", 256);
    const existing = seen.get(dedupeKey);
    if (existing !== undefined) {
      if (existing.evidenceHash !== evidenceHash) {
        throw new Error(
          "Channel ingress batch contains conflicting evidence for one dedupe key",
        );
      }
      continue;
    }
    seen.set(dedupeKey, record);
  }

  return Object.freeze([...seen.values()]);
}

function verifyObservations(input: {
  readonly records: readonly ChannelIngressRecord[];
  readonly observations: readonly ChannelIngressCustodyObservation[];
}): {
  readonly storedCount: number;
  readonly duplicateCount: number;
} {
  if (
    !Array.isArray(input.observations) ||
    input.observations.length !== input.records.length
  ) {
    throw new Error(
      "Channel ingress custody store returned incomplete admission evidence",
    );
  }

  const expected = new Map(
    input.records.map((record) => [
      record.dedupeKey,
      record.evidenceHash,
    ] as const),
  );
  const seen = new Set<string>();
  let storedCount = 0;
  let duplicateCount = 0;

  for (const observation of input.observations) {
    const dedupeKey = bounded(observation.dedupeKey, "dedupeKey", 256);
    const evidenceHash = bounded(
      observation.evidenceHash,
      "evidenceHash",
      256,
    );
    if (seen.has(dedupeKey)) {
      throw new Error(
        "Channel ingress custody store returned duplicate observation rows",
      );
    }
    seen.add(dedupeKey);

    const expectedHash = expected.get(dedupeKey);
    if (expectedHash === undefined || expectedHash !== evidenceHash) {
      throw new Error(
        "Channel ingress custody store returned mismatched admission evidence",
      );
    }
    if (
      observation.outcome !== "stored" &&
      observation.outcome !== "duplicate"
    ) {
      throw new Error(
        "Channel ingress custody store returned invalid admission outcome",
      );
    }
    if (observation.outcome === "stored") storedCount += 1;
    else duplicateCount += 1;
  }

  if (seen.size !== expected.size) {
    throw new Error(
      "Channel ingress custody store did not cover the exact requested batch",
    );
  }

  return { storedCount, duplicateCount };
}

export function createDurableChannelIngressAdmission(input: {
  readonly store: AtomicChannelIngressStore;
}): DurableChannelAdmission {
  return Object.freeze({
    async admitBatch(
      recordsInput: readonly ChannelIngressRecord[],
    ): Promise<{ readonly outcome: "persisted" | "duplicate" }> {
      const records = canonicalBatch(recordsInput);
      if (records.length === 0) {
        return Object.freeze({ outcome: "duplicate" as const });
      }

      const observations = await input.store.admitAtomic(records);
      const result = verifyObservations({
        records,
        observations,
      });

      return Object.freeze({
        outcome:
          result.storedCount > 0
            ? ("persisted" as const)
            : ("duplicate" as const),
      });
    },
  });
}
