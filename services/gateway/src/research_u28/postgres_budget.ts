import type { ResearchBudget, ResearchActor } from "./model.js";

interface SqlClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string, args?: unknown[],
  ): Promise<{ rows: Row[]; rowCount: number | null }>;
  release(): void;
}
export interface ResearchPool {
  connect(): Promise<SqlClient>;
}
/**
 * Daily provider request quota (not a financial wallet debit).
 * Transactional PostgreSQL CAS prevents multi-Gateway races and duplicate refunds.
 * Migration in this module must be registered by the elected schema owner.
 */
export function postgresResearchBudget(input: Readonly<{
  pool: ResearchPool;
  dailyLimit: number;
}>): ResearchBudget {
  if (!Number.isSafeInteger(input.dailyLimit) || input.dailyLimit < 1 || input.dailyLimit > 1000) {
    throw new TypeError("Invalid research daily limit");
  }
  return Object.freeze<ResearchBudget>({
    async reserve({ actor, requestId, units }) {
      if (!Number.isSafeInteger(units) || units < 1 || units > input.dailyLimit ||
          !/^[a-f0-9-]{36}$/iu.test(requestId)) return false;
      const client = await input.pool.connect();
      try {
        await client.query("BEGIN");
        const today = new Date().toISOString().slice(0, 10);
        await client.query(
          "INSERT INTO research_u28.daily_budget (tenant_id, user_id, budget_day, used_units) VALUES ($1,$2,$3,0) ON CONFLICT DO NOTHING",
          [actor.tenantId, actor.userId, today],
        );
        const claimed = await client.query(
          "UPDATE research_u28.daily_budget SET used_units=used_units+$4 WHERE tenant_id=$1 AND user_id=$2 AND budget_day=$3 AND used_units+$4 <= $5 RETURNING used_units",
          [actor.tenantId, actor.userId, today, units, input.dailyLimit],
        );
        if (claimed.rows.length === 0) {
          await client.query("ROLLBACK");
          return false;
        }
        await client.query(
          "INSERT INTO research_u28.reservations (tenant_id,user_id,request_id,budget_day,units,status) VALUES ($1,$2,$3,$4,$5,'reserved')",
          [actor.tenantId, actor.userId, requestId, today, units],
        );
        await client.query("COMMIT");
        return true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    async settle({ actor, requestId, consumed }) {
      const client = await input.pool.connect();
      try {
        await client.query("BEGIN");
        const updated = await client.query<{ units: number; budget_day: string }>(
          "UPDATE research_u28.reservations SET status=$4 WHERE tenant_id=$1 AND user_id=$2 AND request_id=$3 AND status='reserved' RETURNING units,budget_day",
          [actor.tenantId, actor.userId, requestId, consumed ? "charged" : "refunded"],
        );
        if (!consumed && updated.rows.length > 0) {
          const row = updated.rows[0]!;
          await client.query(
            "UPDATE research_u28.daily_budget SET used_units=GREATEST(0,used_units-$4) WHERE tenant_id=$1 AND user_id=$2 AND budget_day=$3",
            [actor.tenantId, actor.userId, row.budget_day, row.units],
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
  });
}
