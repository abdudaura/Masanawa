import type { InvitationQuota } from "./service.js";

export interface InviteSql {
  query<T extends Record<string, unknown>>(sql: string, values: readonly unknown[]):
    Promise<Readonly<{ rows: T[] }>>;
}

/** Durable per-tenant/user UTC daily budget with atomic cross-node enforcement. */
export class PostgresInvitationQuota implements InvitationQuota {
  constructor(private readonly db: InviteSql, private readonly limit = 20) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new TypeError("Invalid invite quota");
    }
  }

  async consume(input: Readonly<{ tenantId: string; userId: string; now: Date }>): Promise<boolean> {
    if (!Number.isFinite(input.now.getTime())) throw new TypeError("Invalid clock");
    const day = input.now.toISOString().slice(0, 10);
    const sql = "INSERT INTO masanawa_invite_daily_quota " +
      "(tenant_id, user_id, utc_day, uses) VALUES ($1, $2, $3::date, 1) " +
      "ON CONFLICT (tenant_id, user_id, utc_day) " +
      "DO UPDATE SET uses = masanawa_invite_daily_quota.uses + 1 " +
      "WHERE masanawa_invite_daily_quota.uses < $4 RETURNING uses";
    const result = await this.db.query<{ uses: number }>(
      sql, [input.tenantId, input.userId, day, this.limit],
    );
    return result.rows.length === 1;
  }
}

