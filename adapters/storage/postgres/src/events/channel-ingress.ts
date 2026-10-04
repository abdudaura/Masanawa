import type { Pool } from "pg";
import { withTransaction } from "../transaction.js";

export interface ChannelIngressRecordLike {
  readonly schemaVersion: number;
  readonly channel: "whatsapp" | "telegram";
  readonly accountId: string;
  readonly externalEventId: string;
  readonly dedupeKey: string;
  readonly evidenceHash: string;
  readonly receivedAt: string;
  readonly event: unknown;
}

export interface PostgresChannelAdmission {
  admitBatch(records: readonly ChannelIngressRecordLike[]): Promise<{
    readonly outcome: "persisted" | "duplicate";
  }>;
}

export function createPostgresChannelAdmission(pool: Pool): PostgresChannelAdmission {
  return Object.freeze({
    async admitBatch(records: readonly ChannelIngressRecordLike[]) {
      if (records.length === 0) return Object.freeze({ outcome: "duplicate" as const });
      return withTransaction(pool, async (client) => {
        let inserted = 0;
        for (const record of records) {
          await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
            `channel-ingress:${record.dedupeKey}`,
          ]);
          const existing = await client.query<{ evidence_hash: string }>(
            "SELECT evidence_hash FROM events.channel_ingress WHERE dedupe_key=$1",
            [record.dedupeKey],
          );
          if (existing.rows[0]) {
            if (existing.rows[0].evidence_hash !== record.evidenceHash) {
              throw new Error("channel.ingress.replay_conflict");
            }
            continue;
          }
          const external = await client.query<{ dedupe_key: string; evidence_hash: string }>(
            `SELECT dedupe_key,evidence_hash FROM events.channel_ingress
              WHERE channel=$1 AND account_id=$2 AND external_event_id=$3`,
            [record.channel, record.accountId, record.externalEventId],
          );
          if (external.rows[0]) {
            if (
              external.rows[0].dedupe_key !== record.dedupeKey ||
              external.rows[0].evidence_hash !== record.evidenceHash
            ) {
              throw new Error("channel.ingress.external_identity_conflict");
            }
            continue;
          }
          await client.query(
            `INSERT INTO events.channel_ingress(
               dedupe_key,evidence_hash,channel,account_id,external_event_id,
               received_at,definition
             ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
            [
              record.dedupeKey,
              record.evidenceHash,
              record.channel,
              record.accountId,
              record.externalEventId,
              record.receivedAt,
              JSON.stringify(record),
            ],
          );
          inserted += 1;
        }
        return Object.freeze({
          outcome: inserted > 0 ? ("persisted" as const) : ("duplicate" as const),
        });
      });
    },
  });
}
