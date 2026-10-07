import type {
  TalkPollOptionDraft,
  TalkPollOptionView,
  TalkPollRepository,
  TalkPollView,
} from "./model.js";

interface SqlResult<Row> {
  readonly rows: Row[];
  readonly rowCount: number | null;
}

export interface TalkPollSqlPool {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<SqlResult<Row>>;
}

interface TalkRow extends Record<string, unknown> {
  host_user_id: string;
  state: "draft" | "live" | "reconnecting" | "ended";
}
interface RuntimeRow extends Record<string, unknown> {
  state: "live" | "ended";
}
interface PollRow extends Record<string, unknown> {
  poll_id: string;
  question: string;
  options_json: unknown;
  status: "open" | "closed";
  created_at: string | Date;
  closed_at: string | Date | null;
}
interface CountRow extends Record<string, unknown> {
  option_id: string;
  vote_count: number | string;
}
interface VoteRow extends Record<string, unknown> {
  option_id: string;
}

function instant(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function options(value: unknown): readonly TalkPollOptionDraft[] {
  const parsed =
    typeof value === "string" ? JSON.parse(value) as unknown : value;
  if (!Array.isArray(parsed)) throw new TypeError("Invalid Talk poll options");
  return Object.freeze(parsed.map((entry) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("optionId" in entry) ||
      !("label" in entry) ||
      typeof (entry as { optionId?: unknown }).optionId !== "string" ||
      typeof (entry as { label?: unknown }).label !== "string"
    ) {
      throw new TypeError("Invalid Talk poll option");
    }
    return Object.freeze({
      optionId: (entry as { optionId: string }).optionId,
      label: (entry as { label: string }).label,
    });
  }));
}

async function view(
  pool: TalkPollSqlPool,
  tenantId: string,
  talkId: string,
  row: PollRow,
  userId: string,
): Promise<TalkPollView> {
  const [countsResult, voteResult] = await Promise.all([
    pool.query<CountRow>(
      `SELECT option_id,count(*)::integer AS vote_count
         FROM talks.poll_votes
        WHERE tenant_id=$1 AND talk_id=$2 AND poll_id=$3
        GROUP BY option_id`,
      [tenantId, talkId, row.poll_id],
    ),
    pool.query<VoteRow>(
      `SELECT option_id
         FROM talks.poll_votes
        WHERE tenant_id=$1 AND talk_id=$2 AND poll_id=$3 AND user_id=$4
        LIMIT 1`,
      [tenantId, talkId, row.poll_id, userId],
    ),
  ]);
  const counts = new Map(
    countsResult.rows.map((item) => [item.option_id, Number(item.vote_count)]),
  );
  const optionViews: readonly TalkPollOptionView[] = Object.freeze(
    options(row.options_json).map((item) => Object.freeze({
      optionId: item.optionId,
      label: item.label,
      voteCount: counts.get(item.optionId) ?? 0,
    })),
  );
  return Object.freeze({
    pollId: row.poll_id,
    question: row.question,
    status: row.status,
    options: optionViews,
    totalVotes: optionViews.reduce((sum, item) => sum + item.voteCount, 0),
    ...(voteResult.rows[0]?.option_id
      ? { myOptionId: voteResult.rows[0].option_id }
      : {}),
    createdAt: instant(row.created_at),
    ...(row.closed_at === null ? {} : { closedAt: instant(row.closed_at) }),
  });
}

async function talk(
  pool: TalkPollSqlPool,
  tenantId: string,
  talkId: string,
): Promise<TalkRow | null> {
  const result = await pool.query<TalkRow>(
    `SELECT host_user_id,state
       FROM talks.talks
      WHERE tenant_id=$1 AND talk_id=$2
      LIMIT 1`,
    [tenantId, talkId],
  );
  return result.rows[0] ?? null;
}

async function requireHostLive(
  pool: TalkPollSqlPool,
  tenantId: string,
  talkId: string,
  hostUserId: string,
): Promise<void> {
  const current = await talk(pool, tenantId, talkId);
  if (!current) throw new Error("talks.not_found");
  if (current.host_user_id !== hostUserId) throw new Error("talks.host_forbidden");
  if (current.state !== "live") throw new Error("talks.not_live");
  const runtime = await pool.query<RuntimeRow>(
    `SELECT state
       FROM talks.live_runtime
      WHERE tenant_id=$1 AND talk_id=$2 AND state='live'
      LIMIT 1`,
    [tenantId, talkId],
  );
  if (!runtime.rows[0]) throw new Error("talks.not_live");
}

async function readById(
  pool: TalkPollSqlPool,
  tenantId: string,
  userId: string,
  talkId: string,
  pollId: string,
): Promise<TalkPollView | null> {
  const result = await pool.query<PollRow>(
    `SELECT poll_id,question,options_json,status,created_at,closed_at
       FROM talks.polls
      WHERE tenant_id=$1 AND talk_id=$2 AND poll_id=$3
      LIMIT 1`,
    [tenantId, talkId, pollId],
  );
  return result.rows[0]
    ? view(pool, tenantId, talkId, result.rows[0], userId)
    : null;
}

export function createPostgresTalkPollRepository(
  pool: TalkPollSqlPool,
): TalkPollRepository {
  return Object.freeze<TalkPollRepository>({
    async current(input) {
      const result = await pool.query<PollRow>(
        `SELECT p.poll_id,p.question,p.options_json,p.status,p.created_at,p.closed_at
           FROM talks.polls p
           JOIN talks.talks t
             ON t.tenant_id=p.tenant_id AND t.talk_id=p.talk_id
          WHERE p.tenant_id=$1
            AND p.talk_id=$2
            AND p.status='open'
            AND t.state IN ('live','reconnecting')
            AND NOT EXISTS (
              SELECT 1
                FROM talks.safety_enforcement se
               WHERE se.tenant_id=p.tenant_id
                 AND se.target_kind='talk'
                 AND se.target_id=p.talk_id
                 AND se.visibility IN ('restricted','blocked')
            )
          ORDER BY p.created_at DESC
          LIMIT 1`,
        [input.tenantId, input.talkId],
      );
      return result.rows[0]
        ? view(pool, input.tenantId, input.talkId, result.rows[0], input.userId)
        : null;
    },

    async create(input) {
      await requireHostLive(
        pool,
        input.tenantId,
        input.talkId,
        input.hostUserId,
      );
      const result = await pool.query<PollRow>(
        `INSERT INTO talks.polls(
           tenant_id,talk_id,poll_id,question,options_json,status,created_at
         )
         VALUES($1,$2,$3,$4,$5::jsonb,'open',$6)
         RETURNING poll_id,question,options_json,status,created_at,closed_at`,
        [
          input.tenantId,
          input.talkId,
          input.pollId,
          input.question,
          JSON.stringify(input.options),
          input.now,
        ],
      );
      return result.rows[0]
        ? view(
            pool,
            input.tenantId,
            input.talkId,
            result.rows[0],
            input.hostUserId,
          )
        : null;
    },

    async vote(input) {
      const result = await pool.query<VoteRow>(
        `INSERT INTO talks.poll_votes(
           tenant_id,talk_id,poll_id,user_id,option_id,updated_at
         )
         SELECT $1,$2,$3,$4,$5,$6
           FROM talks.polls p
           JOIN talks.talks t
             ON t.tenant_id=p.tenant_id AND t.talk_id=p.talk_id
          WHERE p.tenant_id=$1
            AND p.talk_id=$2
            AND p.poll_id=$3
            AND p.status='open'
            AND t.state='live'
            AND EXISTS (
              SELECT 1
                FROM talks.live_runtime lr
               WHERE lr.tenant_id=p.tenant_id
                 AND lr.talk_id=p.talk_id
                 AND lr.state='live'
            )
            AND EXISTS (
              SELECT 1
                FROM jsonb_array_elements(p.options_json) option
               WHERE option->>'optionId'=$5
            )
            AND NOT EXISTS (
              SELECT 1
                FROM talks.safety_enforcement se
               WHERE se.tenant_id=p.tenant_id
                 AND se.target_kind='talk'
                 AND se.target_id=p.talk_id
                 AND se.visibility IN ('restricted','blocked')
            )
         ON CONFLICT(tenant_id,talk_id,poll_id,user_id) DO UPDATE
           SET option_id=EXCLUDED.option_id,updated_at=EXCLUDED.updated_at
         RETURNING option_id`,
        [
          input.tenantId,
          input.talkId,
          input.pollId,
          input.userId,
          input.optionId,
          input.now,
        ],
      );
      if (!result.rows[0]) return null;
      return readById(
        pool,
        input.tenantId,
        input.userId,
        input.talkId,
        input.pollId,
      );
    },

    async close(input) {
      const currentTalk = await talk(pool, input.tenantId, input.talkId);
      if (!currentTalk) throw new Error("talks.not_found");
      if (currentTalk.host_user_id !== input.hostUserId) {
        throw new Error("talks.host_forbidden");
      }
      const result = await pool.query<PollRow>(
        `UPDATE talks.polls
            SET status='closed',closed_at=$4
          WHERE tenant_id=$1
            AND talk_id=$2
            AND poll_id=$3
            AND status='open'
          RETURNING poll_id,question,options_json,status,created_at,closed_at`,
        [
          input.tenantId,
          input.talkId,
          input.pollId,
          input.now,
        ],
      );
      return result.rows[0]
        ? view(
            pool,
            input.tenantId,
            input.talkId,
            result.rows[0],
            input.hostUserId,
          )
        : null;
    },
  });
}
