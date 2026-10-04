import type { Pool } from "pg";
import type {
  ChannelIngressRecord,
  DurableChannelAdmission,
} from "@masanawa/messaging-channels";
import { canonicalJson } from "@masanawa/security";
import { withTransaction } from "../transaction.js";

function bounded(value: string, label: string, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${label} is invalid`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) {
    throw new TypeError(`${label} is invalid`);
  }
  return normalized;
}

export function createPostgresChannelAdmission(
  pool: Pool,
): DurableChannelAdmission {
  return Object.freeze({
    async admitBatch(records: readonly ChannelIngressRecord[]) {
      if (records.length === 0) return Object.freeze({ outcome: "duplicate" as const });
      return withTransaction(pool, async (client) => {
        let inserted = 0;
        for (const input of records) {
          const channel =
            input.channel === "whatsapp"
              ? "whatsapp"
              : input.channel === "telegram"
                ? "telegram"
                : (() => { throw new TypeError("channel is invalid"); })();
          const accountId = bounded(input.accountId, "accountId", 160);
          const dedupeKey = bounded(input.dedupeKey, "dedupeKey", 512);
          const externalEventId = bounded(input.externalEventId, "externalEventId", 512);
          const evidenceHash = bounded(input.evidenceHash, "evidenceHash", 160);
          const receivedAt = new Date(Date.parse(input.receivedAt)).toISOString();

          const existing = await client.query<{ evidence_hash: string }>(
            `SELECT evidence_hash
               FROM commerce.channel_ingress_events
              WHERE channel=$1 AND account_id=$2 AND dedupe_key=$3
              FOR UPDATE`,
            [channel, accountId, dedupeKey],
          );
          if (existing.rows[0]) {
            if (existing.rows[0].evidence_hash !== evidenceHash) {
              throw new Error("channel.ingress.event_conflict");
            }
            continue;
          }

          await client.query(
            `INSERT INTO commerce.channel_ingress_events(
               channel,account_id,dedupe_key,external_event_id,
               evidence_hash,received_at,definition
             ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
            [
              channel,
              accountId,
              dedupeKey,
              externalEventId,
              evidenceHash,
              receivedAt,
              canonicalJson(input),
            ],
          );
          inserted += 1;
        }
        return Object.freeze({
          outcome: inserted === 0 ? ("duplicate" as const) : ("persisted" as const),
        });
      });
    },
  });
}
