import type {
  AtomicChannelIngressStore,
  ChannelIngressCustodyObservation,
  ChannelIngressRecord,
} from "@masanawa/messaging-channels";
import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../transaction.js";

interface IngressRow {
  dedupe_key: string;
  evidence_hash: string;
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

function normalizeRecord(record: ChannelIngressRecord): ChannelIngressRecord {
  if (record.schemaVersion !== 1) {
    throw new TypeError("Unsupported channel ingress schema");
  }
  if (record.channel !== "whatsapp" && record.channel !== "telegram") {
    throw new TypeError("channel is invalid");
  }
  const dedupeKey = bounded(record.dedupeKey, "dedupeKey", 256);
  const evidenceHash = bounded(record.evidenceHash, "evidenceHash", 256);
  const externalEventId = bounded(
    record.externalEventId,
    "externalEventId",
    512,
  );
  const accountId = bounded(record.accountId, "accountId", 256) as typeof record.accountId;
  const receivedAt = new Date(record.receivedAt);
  if (Number.isNaN(receivedAt.getTime())) {
    throw new TypeError("receivedAt is invalid");
  }
  if (
    record.event === null ||
    typeof record.event !== "object" ||
    Array.isArray(record.event)
  ) {
    throw new TypeError("event is invalid");
  }

  return Object.freeze({
    ...record,
    accountId,
    externalEventId,
    dedupeKey,
    evidenceHash,
  });
}

function normalizeBatch(
  input: readonly ChannelIngressRecord[],
): readonly ChannelIngressRecord[] {
  if (!Array.isArray(input) || input.length > 128) {
    throw new RangeError("channel ingress batch is invalid");
  }

  const seen = new Map<string, ChannelIngressRecord>();
  for (const value of input) {
    const record = normalizeRecord(value);
    const existing = seen.get(record.dedupeKey);
    if (existing) {
      if (existing.evidenceHash !== record.evidenceHash) {
        throw new Error(
          "Channel ingress batch contains conflicting evidence for one dedupe key",
        );
      }
      continue;
    }
    seen.set(record.dedupeKey, record);
  }
  return Object.freeze([...seen.values()]);
}

async function readExisting(
  client: PoolClient,
  dedupeKey: string,
): Promise<IngressRow | null> {
  const result = await client.query<IngressRow>(
    `SELECT dedupe_key, evidence_hash
       FROM channels.ingress_events
      WHERE dedupe_key=$1
      FOR UPDATE`,
    [dedupeKey],
  );
  return result.rows[0] ?? null;
}

function duplicateObservation(
  record: ChannelIngressRecord,
): ChannelIngressCustodyObservation {
  return Object.freeze({
    dedupeKey: record.dedupeKey,
    evidenceHash: record.evidenceHash,
    outcome: "duplicate" as const,
  });
}

function storedObservation(
  record: ChannelIngressRecord,
): ChannelIngressCustodyObservation {
  return Object.freeze({
    dedupeKey: record.dedupeKey,
    evidenceHash: record.evidenceHash,
    outcome: "stored" as const,
  });
}

function assertSameEvidence(
  existing: IngressRow,
  record: ChannelIngressRecord,
): void {
  if (
    existing.dedupe_key !== record.dedupeKey ||
    existing.evidence_hash !== record.evidenceHash
  ) {
    throw new Error(
      "Channel ingress replay key is already bound to different evidence",
    );
  }
}

async function admitOne(
  client: PoolClient,
  record: ChannelIngressRecord,
): Promise<ChannelIngressCustodyObservation> {
  const existing = await readExisting(client, record.dedupeKey);
  if (existing) {
    assertSameEvidence(existing, record);
    return duplicateObservation(record);
  }

  const inserted = await client.query<IngressRow>(
    `INSERT INTO channels.ingress_events(
       dedupe_key, evidence_hash, channel, account_id, external_event_id,
       received_at, event
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
     ON CONFLICT (dedupe_key) DO NOTHING
     RETURNING dedupe_key, evidence_hash`,
    [
      record.dedupeKey,
      record.evidenceHash,
      record.channel,
      record.accountId,
      record.externalEventId,
      record.receivedAt,
      JSON.stringify(record.event),
    ],
  );

  if (inserted.rows[0]) {
    assertSameEvidence(inserted.rows[0], record);
    return storedObservation(record);
  }

  // Concurrent writer won the replay identity. Re-read and compare inside
  // this serializable transaction; a changed hash aborts the complete batch.
  const raced = await readExisting(client, record.dedupeKey);
  if (!raced) {
    throw new Error(
      "Channel ingress replay conflict could not be reconciled",
    );
  }
  assertSameEvidence(raced, record);
  return duplicateObservation(record);
}

export function createPostgresAtomicChannelIngressStore(
  pool: Pool,
): AtomicChannelIngressStore {
  return Object.freeze<AtomicChannelIngressStore>({
    async admitAtomic(recordsInput) {
      const records = normalizeBatch(recordsInput);
      if (records.length === 0) return Object.freeze([]);

      return withTransaction(
        pool,
        async (client) => {
          const observations: ChannelIngressCustodyObservation[] = [];
          for (const record of records) {
            observations.push(await admitOne(client, record));
          }
          return Object.freeze(observations);
        },
        { isolation: "serializable" },
      );
    },
  });
}
