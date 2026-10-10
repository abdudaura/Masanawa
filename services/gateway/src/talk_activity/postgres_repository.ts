import type {
  TalkActivityFilter,
  TalkActivityKind,
  TalkActivityRecord,
  TalkActivityRepository,
} from "./model.js";

interface SqlResult<Row> {
  readonly rows: Row[];
  readonly rowCount: number | null;
}

export interface TalkActivitySqlPool {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<SqlResult<Row>>;
}

interface ActivityRow extends Record<string, unknown> {
  tenant_id: string;
  activity_id: string;
  user_id: string;
  kind: TalkActivityKind;
  title: string;
  detail: string;
  created_at: string | Date;
  talk_id: string | null;
  profile_public_id: string | null;
  persona_id: string | null;
  transaction_id: string | null;
  amount_label: string | null;
  requires_action: boolean;
  action_label: string | null;
  unread: boolean;
}

function iso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapRow(row: ActivityRow): TalkActivityRecord {
  return Object.freeze({
    tenantId: row.tenant_id,
    activityId: row.activity_id,
    userId: row.user_id,
    kind: row.kind,
    title: row.title,
    detail: row.detail,
    createdAt: iso(row.created_at),
    talkId: row.talk_id,
    profilePublicId: row.profile_public_id,
    personaId: row.persona_id,
    transactionId: row.transaction_id,
    amountLabel: row.amount_label,
    requiresAction: row.requires_action,
    actionLabel: row.action_label,
    unread: row.unread,
  });
}

const columns = `
  tenant_id, activity_id, user_id, kind, title, detail, created_at,
  talk_id, profile_public_id, persona_id, transaction_id, amount_label,
  requires_action, action_label, unread
`;

function categoryPredicate(filter: TalkActivityFilter): readonly string[] {
  switch (filter) {
    case "all":
      return [];
    case "talks":
      return [
        "talk_invitation",
        "raise_hand_accepted",
        "raise_hand_declined",
        "ai_seat_sponsored",
        "ai_seat_accepted",
        "ai_seat_declined",
        "replay_milestone",
      ];
    case "money":
      return ["gift", "twin_hired", "earning"];
    case "social":
      return ["follow"];
  }
}

export function createPostgresTalkActivityRepository(
  pool: TalkActivitySqlPool,
): TalkActivityRepository {
  return Object.freeze<TalkActivityRepository>({
    async markRead(input) {
      // One tenant+recipient-fenced write; repeated calls are idempotent.
      // No prior unscoped existence read or activity ownership inference.
      const result = await pool.query<{ activity_id: string }>(
        `UPDATE talks.activity
            SET unread = false
          WHERE tenant_id = $1
            AND user_id = $2
            AND activity_id = $3
        RETURNING activity_id`,
        [input.tenantId, input.userId, input.activityId],
      );
      return result.rows.length > 0;
    },

    async list(input) {
      const kinds = categoryPredicate(input.filter);
      const result = await pool.query<ActivityRow>(
        `SELECT ${columns}
           FROM talks.activity
          WHERE tenant_id = $1
            AND user_id = $2
            AND ($3::text[] = '{}'::text[] OR kind = ANY($3::text[]))
          ORDER BY created_at DESC, activity_id DESC
          LIMIT $4`,
        [input.tenantId, input.userId, [...kinds], input.limit],
      );
      return Object.freeze(result.rows.map(mapRow));
    },

    async append(input) {
      const result = await pool.query<ActivityRow>(
        `INSERT INTO talks.activity (
          tenant_id, activity_id, user_id, kind, title, detail, created_at,
          talk_id, profile_public_id, persona_id, transaction_id, amount_label,
          requires_action, action_label, unread
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
        )
        ON CONFLICT (tenant_id, activity_id) DO UPDATE
          SET title = EXCLUDED.title,
              detail = EXCLUDED.detail,
              talk_id = EXCLUDED.talk_id,
              profile_public_id = EXCLUDED.profile_public_id,
              persona_id = EXCLUDED.persona_id,
              transaction_id = EXCLUDED.transaction_id,
              amount_label = EXCLUDED.amount_label,
              requires_action = EXCLUDED.requires_action,
              action_label = EXCLUDED.action_label,
              -- Replayed delivery must not resurrect an acknowledged read.
              unread = talks.activity.unread AND EXCLUDED.unread
        WHERE talks.activity.user_id = EXCLUDED.user_id
          AND talks.activity.kind = EXCLUDED.kind
        RETURNING ${columns}`,
        [
          input.tenantId,
          input.activityId,
          input.userId,
          input.kind,
          input.title,
          input.detail,
          input.createdAt,
          input.talkId ?? null,
          input.profilePublicId ?? null,
          input.personaId ?? null,
          input.transactionId ?? null,
          input.amountLabel ?? null,
          input.requiresAction ?? false,
          input.actionLabel ?? null,
          input.unread ?? true,
        ],
      );
      const row = result.rows[0];
      if (!row) throw new Error("talks.activity_idempotency_conflict");
      return mapRow(row);
    },
  });
}
