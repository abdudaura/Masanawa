import type { HostPrepRecord, HostPrepRepository } from "./service.js";

type SqlResult<T> = { rows: T[]; rowCount: number | null };
export interface HostPrepSql {
  query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<SqlResult<T>>;
}
type Row = Record<string, unknown> & {
  prep_id: string; tenant_id: string; host_user_id: string;
  title: string; topic: string; questions: unknown;
  revision: number; phase: "draft" | "publishing" | "published";
  talk_id: string | null; created_at: Date | string; updated_at: Date | string;
};
const cols = "prep_id, tenant_id, host_user_id, title, topic, questions, revision, phase, talk_id, created_at, updated_at";
function map(row: Row): HostPrepRecord {
  if (!Array.isArray(row.questions) || !row.questions.every((v) => typeof v === "string")) {
    throw new TypeError("host prep persistence corrupted");
  }
  return Object.freeze({
    prepId: row.prep_id, tenantId: row.tenant_id, hostUserId: row.host_user_id,
    title: row.title, topic: row.topic, questions: Object.freeze([...row.questions]),
    revision: Number(row.revision), phase: row.phase, talkId: row.talk_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  });
}
export function postgresHostPrepRepository(sql: HostPrepSql): HostPrepRepository {
  return Object.freeze({
    async create(input) {
      const result = await sql.query<Row>(
        `INSERT INTO talks.host_preparations
          (prep_id, tenant_id, host_user_id, title, topic, questions, created_at, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8) RETURNING ${cols}`,
        [input.prepId, input.tenantId, input.hostUserId, input.title, input.topic,
          JSON.stringify(input.questions), input.createdAt, input.updatedAt]);
      return map(result.rows[0]!);
    },
    async list(input) {
      const result = await sql.query<Row>(
        `SELECT ${cols} FROM talks.host_preparations
         WHERE tenant_id=$1 AND host_user_id=$2
         ORDER BY updated_at DESC, prep_id DESC LIMIT $3`,
        [input.tenantId, input.hostUserId, input.limit]);
      return Object.freeze(result.rows.map(map));
    },
    async read(input) {
      const result = await sql.query<Row>(
        `SELECT ${cols} FROM talks.host_preparations
         WHERE tenant_id=$1 AND host_user_id=$2 AND prep_id=$3`,
        [input.tenantId, input.hostUserId, input.prepId]);
      return result.rows[0] ? map(result.rows[0]) : null;
    },
    async edit(input) {
      const result = await sql.query<Row>(
        `UPDATE talks.host_preparations
         SET title=$5,topic=$6,questions=$7::jsonb,revision=revision+1,updated_at=$8
         WHERE tenant_id=$1 AND host_user_id=$2 AND prep_id=$3
           AND revision=$4 AND phase='draft' RETURNING ${cols}`,
        [input.tenantId, input.hostUserId, input.prepId, input.revision,
          input.title, input.topic, JSON.stringify(input.questions), input.now]);
      return result.rows[0] ? map(result.rows[0]) : null;
    },
    async beginPublish(input) {
      const result = await sql.query<Row>(
        `UPDATE talks.host_preparations
         SET phase='publishing',talk_id=$5,revision=revision+1,updated_at=$6
         WHERE tenant_id=$1 AND host_user_id=$2 AND prep_id=$3
           AND revision=$4 AND phase='draft' RETURNING ${cols}`,
        [input.tenantId, input.hostUserId, input.prepId, input.revision, input.talkId, input.now]);
      return result.rows[0] ? map(result.rows[0]) : null;
    },
    async finishPublish(input) {
      const result = await sql.query<Row>(
        `UPDATE talks.host_preparations
         SET phase='published', revision=revision+1, updated_at=$5
         WHERE tenant_id=$1 AND host_user_id=$2 AND prep_id=$3
           AND talk_id=$4 AND phase='publishing' RETURNING ${cols}`,
        [input.tenantId, input.hostUserId, input.prepId, input.talkId, input.now]);
      if (result.rows[0]) return map(result.rows[0]);
      // Concurrent readback may already have completed; return it only if exact ID matches.
      const already = await this.read({
        tenantId: input.tenantId, hostUserId: input.hostUserId, prepId: input.prepId,
      });
      return already?.phase === "published" && already.talkId === input.talkId ? already : null;
    },
  });
}
