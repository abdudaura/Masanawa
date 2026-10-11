import type { Pool } from "pg";

export const deliveryKinds = [
  "comment_reply", "room_answer", "followed_post", "subscription", "wallet", "case_update",
] as const;
export type DeliveryKind = typeof deliveryKinds[number];
export interface DeliveryActor { tenantId: string; fanUserId: string }
export interface DeliveryChoice { kind: DeliveryKind; enabled: boolean }
export interface DeliveryPreferences {
  list(actor: DeliveryActor): Promise<DeliveryChoice[]>;
  set(actor: DeliveryActor, choice: DeliveryChoice): Promise<DeliveryChoice>;
  pushEnabled(actor: DeliveryActor, kind: DeliveryKind): Promise<boolean>;
}
const validId = (v: unknown): v is string =>
  typeof v === "string" && /^[a-zA-Z0-9_:\-.]{1,128}$/.test(v);
export const isDeliveryKind = (v: unknown): v is DeliveryKind =>
  typeof v === "string" && (deliveryKinds as readonly string[]).includes(v);
function verified(actor: DeliveryActor): void {
  if (!validId(actor.tenantId) || !validId(actor.fanUserId)) {
    throw new TypeError("Canonical session identity required");
  }
}
/** Uses the existing PostgreSQL pool and notifications namespace, not a second journal. */
export function createPgDeliveryPreferences(pool: Pick<Pool, "query">): DeliveryPreferences {
  return {
    async list(actor) {
      verified(actor);
      const res = await pool.query(
        `SELECT kind, enabled FROM notifications.fan_delivery_preferences
          WHERE tenant_id=$1 AND fan_user_id=$2`, [actor.tenantId, actor.fanUserId]);
      const values = new Map<string, boolean>();
      for (const row of res.rows as Array<{ kind: unknown; enabled: unknown }>) {
        if (isDeliveryKind(row.kind) && typeof row.enabled === "boolean") values.set(row.kind, row.enabled);
      }
      return deliveryKinds.map(kind => ({kind, enabled: values.get(kind) === true}));
    },
    async set(actor, choice) {
      verified(actor);
      if (!isDeliveryKind(choice.kind) || typeof choice.enabled !== "boolean") {
        throw new RangeError("Invalid delivery choice");
      }
      const result = await pool.query(
        `INSERT INTO notifications.fan_delivery_preferences
          (tenant_id,fan_user_id,kind,enabled) VALUES ($1,$2,$3,$4)
          ON CONFLICT (tenant_id,fan_user_id,kind)
          DO UPDATE SET enabled=EXCLUDED.enabled,
                        updated_at=CASE WHEN notifications.fan_delivery_preferences.enabled
                         IS DISTINCT FROM EXCLUDED.enabled THEN clock_timestamp()
                         ELSE notifications.fan_delivery_preferences.updated_at END
          RETURNING kind, enabled`,
        [actor.tenantId, actor.fanUserId, choice.kind, choice.enabled]);
      const row = result.rows[0] as {kind: unknown;enabled: unknown}|undefined;
      if (row?.kind !== choice.kind || row.enabled !== choice.enabled) throw new Error("Missing authoritative readback");
      return choice;
    },
    async pushEnabled(actor, kind) {
      verified(actor);
      if (!isDeliveryKind(kind)) throw new RangeError("Unknown notification kind");
      const result = await pool.query(
        `SELECT enabled FROM notifications.fan_delivery_preferences
          WHERE tenant_id=$1 AND fan_user_id=$2 AND kind=$3`,
        [actor.tenantId, actor.fanUserId, kind]);
      return result.rows[0]?.enabled === true;
    },
  };
}
