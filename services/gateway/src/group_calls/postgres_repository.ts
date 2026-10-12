import { createCanonicalId } from "@masanawa/contracts";
import {
  GroupCallError,
  type GroupCall,
  type GroupCallRepository,
  type GroupScope,
} from "./service.js";
export interface GroupSqlClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: Row[]; rowCount: number | null }>;
  release(): void;
}
export interface GroupSqlPool {
  connect(): Promise<GroupSqlClient>;
}
const fail = (code: string, status: number): never => {
  throw new GroupCallError(`calls.${code}`, status);
};
export function createPostgresGroupCallRepository(
  pool: GroupSqlPool,
  options: { mintTimeoutMs?: number } = {},
): GroupCallRepository & { drainBackground(): Promise<void> } {
  const pending = new Set<Promise<unknown>>();
  async function transaction<T>(
    fn: (c: GroupSqlClient) => Promise<T>,
  ): Promise<T> {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const result = await fn(c);
      await c.query("COMMIT");
      return result;
    } catch (error) {
      await c.query("ROLLBACK");
      throw error;
    } finally {
      c.release();
    }
  }
  async function lock(c: GroupSqlClient, s: GroupScope) {
    const r = await c.query(
      `SELECT * FROM agents.masana_call_groups WHERE tenant_id=$1 AND user_id=$2 AND group_id=$3 FOR UPDATE`,
      [s.tenantId, s.userId, s.groupId],
    );
    const g = r.rows[0];
    if (
      !g ||
      (s.characterIds !== null &&
        (g.selected_ids as string[]).some(
          (id) => !s.characterIds!.includes(id),
        ))
    )
      fail("group_not_found", 404);
    return g!;
  }
  async function detail(c: GroupSqlClient, s: GroupScope): Promise<GroupCall> {
    const g = await lock(c, s);
    const p = await c.query(
      `SELECT p.*,h.connected_at,h.ended_at,h.expires_at FROM agents.masana_call_group_participants p LEFT JOIN agents.masana_call_history h USING(tenant_id,user_id,call_id) WHERE p.tenant_id=$1 AND p.user_id=$2 AND p.group_id=$3 ORDER BY p.character_id`,
      [s.tenantId, s.userId, s.groupId],
    );
    const participants = p.rows.map((r) => ({
      characterId: r.character_id as string,
      displayName: r.display_name as string,
      callId: r.call_id as string | null,
      state:
        r.left_at || g.ended_at
          ? ("left" as const)
          : r.ended_at ||
              (r.expires_at &&
                new Date(r.expires_at as string).getTime() <= Date.now())
            ? ("failed" as const)
            : r.connected_at
              ? ("active" as const)
              : r.call_id
                ? ("connecting" as const)
                : ("selected" as const),
    }));
    return {
      groupId: s.groupId,
      state: g.ended_at
        ? "ended"
        : participants.some((p) => p.state === "active")
          ? "active"
          : "connecting",
      createdAt: (g.created_at as Date).toISOString(),
      endedAt: g.ended_at ? (g.ended_at as Date).toISOString() : null,
      participants,
    };
  }
  async function eligible(c: GroupSqlClient, s: GroupScope, ids: string[]) {
    if (
      s.characterIds !== null &&
      ids.some((id) => !s.characterIds!.includes(id))
    )
      fail("masana_unavailable", 403);
    const r = await c.query(
      `SELECT p.character_id,p.support_agent,a.display_name FROM agents.platform_agent_profiles p JOIN agents.agent_presentations a USING(tenant_id,character_id) WHERE p.tenant_id=$1 AND p.character_id=ANY($2::text[]) AND a.visible_in_user_app`,
      [s.tenantId, ids],
    );
    if (r.rows.length !== ids.length) fail("masana_unavailable", 403);
    return r.rows;
  }
  async function closeHistory(
    c: GroupSqlClient,
    s: GroupScope,
    characterId: string | null,
  ) {
    await c.query(
      `UPDATE agents.masana_call_history h SET ended_at=COALESCE(h.ended_at,clock_timestamp()) FROM agents.masana_call_group_participants p WHERE p.tenant_id=$1 AND p.user_id=$2 AND p.group_id=$3 AND ($4::text IS NULL OR p.character_id=$4) AND h.tenant_id=p.tenant_id AND h.user_id=p.user_id AND h.call_id=p.call_id`,
      [s.tenantId, s.userId, s.groupId, characterId],
    );
  }
  return {
    async drainBackground() {
      await Promise.allSettled([...pending]);
    },
    async create(s) {
      return transaction(async (c) => {
        if (
          s.selected.length < 2 ||
          s.selected.length > 4 ||
          new Set(s.selected).size !== s.selected.length
        )
          fail("group_invalid", 400);
        const groupId = createCanonicalId("request").slice("request_".length);
        const inserted = await c.query(
          `INSERT INTO agents.masana_call_groups(tenant_id,user_id,group_id,request_id,selected_ids) VALUES($1,$2,$3,$4,$5) ON CONFLICT(tenant_id,user_id,request_id) DO NOTHING RETURNING group_id`,
          [s.tenantId, s.userId, groupId, s.requestId, s.selected],
        );
        const existing = await c.query(
          `SELECT group_id,selected_ids FROM agents.masana_call_groups WHERE tenant_id=$1 AND user_id=$2 AND request_id=$3 FOR UPDATE`,
          [s.tenantId, s.userId, s.requestId],
        );
        const row = existing.rows[0]!;
        if (JSON.stringify(row.selected_ids) !== JSON.stringify(s.selected))
          fail("group_request_conflict", 409);
        const gs = { ...s, groupId: row.group_id as string };
        if (inserted.rowCount) {
          const roster = await eligible(c, gs, s.selected);
          for (const p of roster)
            await c.query(
              `INSERT INTO agents.masana_call_group_participants(tenant_id,user_id,group_id,character_id,display_name) VALUES($1,$2,$3,$4,$5)`,
              [
                s.tenantId,
                s.userId,
                gs.groupId,
                p.character_id,
                p.display_name,
              ],
            );
        }
        return detail(c, gs);
      });
    },
    async get(s) {
      return transaction((c) => detail(c, s));
    },
    async remove(s) {
      return transaction(async (c) => {
        await lock(c, s);
        const r = await c.query(
          `UPDATE agents.masana_call_group_participants SET left_at=COALESCE(left_at,clock_timestamp()) WHERE tenant_id=$1 AND user_id=$2 AND group_id=$3 AND character_id=$4 RETURNING character_id`,
          [s.tenantId, s.userId, s.groupId, s.characterId],
        );
        if (!r.rowCount) fail("group_participant_not_found", 404);
        await closeHistory(c, s, s.characterId);
        return detail(c, s);
      });
    },
    async end(s) {
      return transaction(async (c) => {
        await lock(c, s);
        await c.query(
          `UPDATE agents.masana_call_groups SET ended_at=COALESCE(ended_at,clock_timestamp()) WHERE tenant_id=$1 AND user_id=$2 AND group_id=$3`,
          [s.tenantId, s.userId, s.groupId],
        );
        await closeHistory(c, s, null);
        return detail(c, s);
      });
    },
    async issue(s, mint, validateParticipant) {
      let mintedCallId: string | undefined;
      let timedOut = false;
      async function closeOrphan(callId: string | undefined) {
        if (!callId) return;
        try {
          await transaction(async (c) => {
            await c.query(
              `UPDATE agents.masana_call_history h SET ended_at=COALESCE(h.ended_at,clock_timestamp())
              WHERE h.tenant_id=$1 AND h.user_id=$2 AND h.call_id=$3 AND h.character_id=$4
              AND NOT EXISTS (SELECT 1 FROM agents.masana_call_group_participants p
                WHERE p.tenant_id=h.tenant_id AND p.user_id=h.user_id AND p.call_id=h.call_id)`,
              [s.tenantId, s.userId, callId, s.characterId],
            );
          });
        } catch {
          /* Informational cleanup only; never exposes an abandoned grant. */
        }
      }
      try {
        return await transaction(async (c) => {
          const g = await lock(c, s);
          const p = await c.query(
            `SELECT * FROM agents.masana_call_group_participants WHERE tenant_id=$1 AND user_id=$2 AND group_id=$3 AND character_id=$4`,
            [s.tenantId, s.userId, s.groupId, s.characterId],
          );
          const member = p.rows[0];
          if (!member) fail("group_participant_not_found", 404);
          if (g.ended_at || member!.left_at) fail("group_closed", 409);
          if (member!.call_id) fail("group_token_already_issued", 409);
          const roster = await eligible(c, s, [s.characterId]);
          const supportAgent = roster[0]!.support_agent === true;
          if (!supportAgent && !validateParticipant)
            fail("paid_admission_unavailable", 503);
          await validateParticipant?.({ supportAgent });
          // Hold the group row lock through admission/mint/binding. Bound provider
          // latency so a hung provider cannot prevent removal or termination.
          let timer: ReturnType<typeof setTimeout> | undefined;
          const mintPromise = mint().then(async (grant) => {
            mintedCallId = grant.callId;
            if (timedOut) await closeOrphan(grant.callId);
            return grant;
          });
          pending.add(mintPromise);
          void mintPromise.then(
            () => pending.delete(mintPromise),
            () => pending.delete(mintPromise),
          );
          const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              timedOut = true;
              reject(new GroupCallError("calls.group_token_timeout", 504));
            }, options.mintTimeoutMs ?? 30_000);
          });
          const grant = await Promise.race([mintPromise, timeout]).finally(
            () => {
              if (timer) clearTimeout(timer);
            },
          );
          await eligible(c, s, [s.characterId]);
          if (!grant.callId) fail("group_history_unavailable", 503);
          const child = await c.query(
            `SELECT call_id FROM agents.masana_call_history WHERE tenant_id=$1 AND user_id=$2 AND call_id=$3 AND character_id=$4 AND ended_at IS NULL AND expires_at>clock_timestamp()`,
            [s.tenantId, s.userId, grant.callId, s.characterId],
          );
          if (!child.rowCount) fail("group_history_unavailable", 503);
          await c.query(
            `UPDATE agents.masana_call_group_participants SET call_id=$5 WHERE tenant_id=$1 AND user_id=$2 AND group_id=$3 AND character_id=$4`,
            [s.tenantId, s.userId, s.groupId, s.characterId, grant.callId],
          );
          return {
            ...grant,
            callId: grant.callId!,
            groupId: s.groupId,
            characterId: s.characterId,
            displayName: roster[0]!.display_name as string,
          };
        });
      } catch (error) {
        await closeOrphan(mintedCallId);
        throw error;
      }
    },
  };
}
