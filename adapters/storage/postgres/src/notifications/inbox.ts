import type { Pool } from "pg";

export type InboxKind =
  | "comment_reply" | "room_answer" | "followed_post"
  | "subscription" | "wallet" | "case_update";
export type InboxTarget = "post" | "comment" | "room" | "subscription" | "wallet" | "case";

export interface InboxActor { tenantId: string; fanUserId: string }
export interface InboxItem {
  id: string; kind: InboxKind; targetKind: InboxTarget; targetId: string;
  title: string; body: string; createdAt: string; readAt: string | null;
}
export interface InboxPage { items: InboxItem[]; nextCursor: string | null }
export interface NewInboxItem extends InboxActor {
  eventId: string; kind: InboxKind; targetKind: InboxTarget; targetId: string;
  title: string; body: string;
}
export interface InboxRepository {
  list(actor: InboxActor, limit: number, cursor?: string): Promise<InboxPage>;
  acknowledge(actor: InboxActor, id: string): Promise<boolean>;
  deliver(input: NewInboxItem): Promise<void>;
}

const safeId = (s: string) => typeof s === "string" && s.length > 0 &&
  s.length <= 128 && /^[a-zA-Z0-9_:\-.]+$/.test(s);
function assertActor(actor: InboxActor) {
  if (!safeId(actor.tenantId) || !safeId(actor.fanUserId)) {
    throw new TypeError("A verified tenant and fan identity are required");
  }
}
function asIso(value: unknown): string {
  const d = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(d.getTime())) throw new Error("Invalid notification timestamp");
  return d.toISOString();
}
function decodeCursor(raw?: string): [string, string] | null {
  if (!raw) return null;
  if (raw.length > 512 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new RangeError("Invalid cursor");
  try {
    const value: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== "string" ||
      typeof value[1] !== "string" || !safeId(value[1]) ||
      !Number.isFinite(Date.parse(value[0])) || value[0] !== new Date(value[0]).toISOString()) {
      throw new Error("Invalid shape");
    }
    return [value[0], value[1]];
  } catch { throw new RangeError("Invalid cursor"); }
}
function rowToItem(row: Record<string, unknown>): InboxItem {
  return {
    id: String(row.notification_id), kind: row.kind as InboxKind,
    targetKind: row.target_kind as InboxTarget, targetId: String(row.target_id),
    title: String(row.title), body: String(row.body), createdAt: asIso(row.created_at),
    readAt: row.read_at == null ? null : asIso(row.read_at),
  };
}

export function createPostgresInboxRepository(pool: Pick<Pool, "query">): InboxRepository {
  return {
    async list(actor, limit, cursor) {
      assertActor(actor);
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new RangeError("Invalid page size");
      const after = decodeCursor(cursor);
      const result = await pool.query(
        `SELECT notification_id, kind, target_kind, target_id, title, body, created_at, read_at
           FROM notifications.fan_inbox
          WHERE tenant_id = $1 AND fan_user_id = $2
            AND ($3::timestamptz IS NULL OR (created_at, notification_id) < ($3::timestamptz, $4::text))
          ORDER BY created_at DESC, notification_id DESC LIMIT $5`,
        [actor.tenantId, actor.fanUserId, after?.[0] ?? null, after?.[1] ?? null, limit + 1],
      );
      const rows = result.rows as Array<Record<string, unknown>>;
      const more = rows.length > limit;
      const items = rows.slice(0, limit).map(rowToItem);
      const last = items.at(-1);
      return { items, nextCursor: more && last
        ? Buffer.from(JSON.stringify([last.createdAt, last.id])).toString("base64url")
        : null };
    },
    async acknowledge(actor, id) {
      assertActor(actor);
      if (!safeId(id)) throw new RangeError("Invalid notification id");
      const result = await pool.query(
        `UPDATE notifications.fan_inbox
             SET read_at = COALESCE(read_at, clock_timestamp())
           WHERE tenant_id = $1 AND fan_user_id = $2 AND notification_id = $3
           RETURNING notification_id`,
        [actor.tenantId, actor.fanUserId, id],
      );
      return result.rowCount === 1;
    },
    async deliver(input) {
      assertActor(input);
      if (![input.eventId, input.targetId].every(safeId) ||
        !["comment_reply","room_answer","followed_post","subscription","wallet","case_update"].includes(input.kind) ||
        !["post","comment","room","subscription","wallet","case"].includes(input.targetKind) ||
        input.title.length < 1 || input.title.length > 120 ||
        input.body.length < 1 || input.body.length > 240) {
        throw new RangeError("Invalid inbox event");
      }
      await pool.query(
        `INSERT INTO notifications.fan_inbox
          (tenant_id, fan_user_id, notification_id, source_event_id, kind,
           target_kind, target_id, title, body)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT (tenant_id, fan_user_id, source_event_id) DO NOTHING`,
        [input.tenantId, input.fanUserId, input.eventId, input.eventId, input.kind,
          input.targetKind, input.targetId, input.title, input.body],
      );
    },
  };
}
