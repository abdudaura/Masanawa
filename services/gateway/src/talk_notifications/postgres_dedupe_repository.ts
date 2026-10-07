import type { TalkPushDedupeRepository } from "./delivery.js";

interface SqlResult<Row> {
  readonly rows: Row[];
  readonly rowCount: number | null;
}

export interface TalkPushDedupeSqlPool {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<SqlResult<Row>>;
}

export function createPostgresTalkPushDedupeRepository(
  pool: TalkPushDedupeSqlPool,
): TalkPushDedupeRepository {
  return Object.freeze({
    async claim(input) {
      const result = await pool.query(
        `INSERT INTO talks.push_dedupe (
           tenant_id, user_id, dedupe_key, created_at
         ) VALUES ($1,$2,$3,$4)
         ON CONFLICT (tenant_id, user_id, dedupe_key) DO NOTHING
         RETURNING dedupe_key`,
        [
          input.tenantId,
          input.userId,
          input.dedupeKey,
          input.createdAt,
        ],
      );
      return (result.rowCount ?? 0) === 1;
    },
  });
}
