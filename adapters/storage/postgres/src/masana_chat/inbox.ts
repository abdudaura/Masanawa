import type { Pool } from "pg";

/** The original agent journal is the sole message/session authority. */
export interface FanInboxScope {
  readonly tenantId: string;
  readonly fanUserId: string;
}
export interface FanInboxItem {
  readonly characterId: string;
  readonly displayName: string;
  readonly profession: string;
  readonly lastMessage: string;
  readonly lastActivityAt: string;
  readonly pinned: boolean;
  readonly unreadCount: number;
  readonly revision: number;
}
type Row = Record<string, unknown>;
const eligibleSession = `EXISTS (
  SELECT 1 FROM agents.character_sessions s
  JOIN masana.character_revisions r ON r.tenant_id=s.tenant_id
    AND r.character_id=s.character_id AND r.state='approved'
  JOIN identity.characters c ON c.tenant_id=s.tenant_id
    AND c.character_id=s.character_id AND c.state='active'
  JOIN identity.character_ownership o ON o.tenant_id=s.tenant_id
    AND o.character_id=s.character_id AND o.kind='platform'
  JOIN identity.users u ON u.tenant_id=s.tenant_id
    AND u.user_id=s.user_id AND u.state='active'
  WHERE s.tenant_id=$1 AND s.user_id=$2 AND s.character_id=$3
    AND lower(r.profile->>'handle') <> 'gwani'
)`;
function boundedScope(scope: FanInboxScope): void {
  if (!scope.tenantId || !scope.fanUserId ||
      scope.tenantId.length > 128 || scope.fanUserId.length > 128)
    throw new TypeError("invalid_inbox_scope");
}
function mapped(row: Row): FanInboxItem {
  const n = Number(row.revision ?? 0);
  const unread = Number(row.unread_count ?? 0);
  if (!Number.isSafeInteger(n) || n < 0 ||
      !Number.isSafeInteger(unread) || unread < 0)
    throw new Error("inbox_projection_invalid");
  return {
    characterId: String(row.character_id),
    displayName: String(row.display_name),
    profession: String(row.profession),
    lastMessage: String(row.last_message ?? "").slice(0, 240),
    lastActivityAt: String(row.last_activity_at),
    pinned: row.pinned === true,
    unreadCount: Math.min(99, unread),
    revision: n,
  };
}

/** Never project another fan, unapproved Masana, or unpublished biography. */
export function createMasanaInboxRepository(
  db: Pick<Pool, "query">,
  options: { readonly hiddenTurnsReady?: boolean } = {},
) {
  // A missing 0006 migration must never break the pre-existing J03/C10 inbox.
  // AF00 enables this SQL only after a verified migration and before enabling
  // the C13 hide endpoint. The normal (pre-migration) query remains unchanged.
  const unreadHideFence = options.hiddenTurnsReady === true ? `
              AND NOT EXISTS (SELECT 1 FROM masana.fan_hidden_turns h
                WHERE h.tenant_id=u.tenant_id AND h.fan_user_id=u.user_id
                  AND h.character_id=u.character_id AND h.request_id=u.request_id)` : "";
  const previewHideFence = options.hiddenTurnsReady === true ? `
            AND NOT EXISTS (SELECT 1 FROM masana.fan_hidden_turns h
              WHERE h.tenant_id=t.tenant_id AND h.fan_user_id=t.user_id
                AND h.character_id=t.character_id AND h.request_id=t.request_id)` : "";
  return Object.freeze({
    async list(scope: FanInboxScope, query = ""): Promise<readonly FanInboxItem[]> {
      boundedScope(scope);
      if (query.length > 80) throw new TypeError("invalid_inbox_query");
      const result = await db.query<Row>(`
        WITH latest AS (
          SELECT DISTINCT ON (s.character_id)
            s.character_id, s.updated_at AS session_at
          FROM agents.character_sessions s
          WHERE s.tenant_id=$1 AND s.user_id=$2
          ORDER BY s.character_id, s.updated_at DESC,
            s.character_session_id DESC
        )
        SELECT l.character_id,
          r.profile->>'displayName' AS display_name,
          r.profile->>'profession' AS profession,
          COALESCE(t.reply, t.user_text, '') AS last_message,
          COALESCE(t.updated_at, l.session_at)::text AS last_activity_at,
          COALESCE(p.pinned, false) AS pinned,
          COALESCE(p.revision, 0)::text AS revision,
          (SELECT count(*) FROM agents.mobile_turn_commands u
            WHERE u.tenant_id=$1 AND u.user_id=$2
              AND u.character_id=l.character_id
              AND u.state='completed' AND u.reply IS NOT NULL
              AND u.updated_at > COALESCE(p.last_read_at,to_timestamp(0))
${unreadHideFence}
          )::text AS unread_count
        FROM latest l
        JOIN identity.users u ON u.tenant_id=$1
          AND u.user_id=$2 AND u.state='active'
        JOIN masana.character_revisions r ON r.tenant_id=$1
          AND r.character_id=l.character_id AND r.state='approved'
        JOIN identity.characters c ON c.tenant_id=$1
          AND c.character_id=l.character_id AND c.state='active'
        JOIN identity.character_ownership o ON o.tenant_id=$1
          AND o.character_id=l.character_id AND o.kind='platform'
        LEFT JOIN masana.fan_chat_preferences p ON p.tenant_id=$1
          AND p.fan_user_id=$2 AND p.character_id=l.character_id
        LEFT JOIN LATERAL (
          SELECT user_text, reply, updated_at
          FROM agents.mobile_turn_commands t
          WHERE t.tenant_id=$1 AND t.user_id=$2
            AND t.character_id=l.character_id
${previewHideFence}
          ORDER BY t.updated_at DESC, t.request_id DESC
          LIMIT 1
        ) t ON TRUE
        WHERE lower(r.profile->>'handle') <> 'gwani'
          AND ($3='' OR position(lower($3) in
            lower(r.profile->>'displayName' || ' ' || r.profile->>'profession'))>0)
        ORDER BY COALESCE(p.pinned,false) DESC,
          COALESCE(t.updated_at,l.session_at) DESC, l.character_id
        LIMIT 50
      `, [scope.tenantId, scope.fanUserId, query.trim()]);
      return result.rows.map(mapped);
    },
    /** CAS pin update: revision 0 means the preference does not yet exist. */
    async setPinned(scope: FanInboxScope, characterId: string,
      pinned: boolean, expectedRevision: number): Promise<number | null> {
      boundedScope(scope);
      if (!/^character_[0-9a-f-]{36}$/i.test(characterId) ||
          typeof pinned !== "boolean" ||
          !Number.isSafeInteger(expectedRevision) ||
          expectedRevision < 0 || expectedRevision >= Number.MAX_SAFE_INTEGER)
        throw new TypeError("invalid_inbox_mutation");
      const params = [scope.tenantId, scope.fanUserId,
        characterId, pinned, expectedRevision];
      const sql = expectedRevision === 0
        ? `INSERT INTO masana.fan_chat_preferences
            (tenant_id,fan_user_id,character_id,pinned)
           SELECT $1,$2,$3,$4 WHERE ${eligibleSession}
           ON CONFLICT (tenant_id,fan_user_id,character_id) DO NOTHING
           RETURNING revision::text AS revision`
        : `UPDATE masana.fan_chat_preferences p
           SET pinned=$4, revision=p.revision+1, updated_at=clock_timestamp()
           WHERE p.tenant_id=$1 AND p.fan_user_id=$2 AND p.character_id=$3
             AND p.revision=$5 AND ${eligibleSession}
           RETURNING p.revision::text AS revision`;
      const result = await db.query<{revision: string}>(sql, params);
      const value = result.rows[0]?.revision;
      return value === undefined ? null : Number(value);
    },
    async markRead(scope: FanInboxScope, characterId: string): Promise<number | null> {
      boundedScope(scope);
      if (!/^character_[0-9a-f-]{36}$/i.test(characterId))
        throw new TypeError("invalid_character_id");
      const result = await db.query<{revision: string}>(`
        INSERT INTO masana.fan_chat_preferences
          (tenant_id,fan_user_id,character_id,last_read_at)
        SELECT $1,$2,$3,clock_timestamp() WHERE ${eligibleSession}
        ON CONFLICT (tenant_id,fan_user_id,character_id) DO UPDATE
          SET last_read_at=GREATEST(
                masana.fan_chat_preferences.last_read_at,clock_timestamp()),
              revision=masana.fan_chat_preferences.revision+1,
              updated_at=clock_timestamp()
        RETURNING revision::text AS revision
      `, [scope.tenantId, scope.fanUserId, characterId]);
      const value = result.rows[0]?.revision;
      return value === undefined ? null : Number(value);
    },
  });
}
