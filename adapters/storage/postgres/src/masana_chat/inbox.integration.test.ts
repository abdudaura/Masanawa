import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Pool, type QueryResultRow } from "pg";
import { describe, expect, it } from "vitest";
import { createMasanaInboxRepository } from "./inbox.js";

/**
 * Requires a disposable localhost PostgreSQL 18 DB ending in _test.
 * The transaction always rolls back. Never point this at production.
 */
const databaseUrl = process.env.MASANAWA_TEST_DATABASE_URL;
function disposable(input: string | undefined): boolean {
  if (!input) return false;
  try {
    const uri = new URL(input);
    return ["localhost", "127.0.0.1"].includes(uri.hostname) &&
      /(?:^|_)test$/.test(uri.pathname.slice(1)) &&
      ["postgres:", "postgresql:"].includes(uri.protocol);
  } catch { return false; }
}
const pgIt = disposable(databaseUrl) ? it : it.skip;
const root = fileURLToPath(new URL("../../../../../", import.meta.url));

describe("C10 PostgreSQL 18 private Masana inbox integration", () => {
  pgIt("keeps one canonical journal, isolates fans and applies pin/read CAS", async () => {
    const db = new Pool({ connectionString: databaseUrl });
    const client = await db.connect();
    const query = <T extends QueryResultRow = QueryResultRow>(
      sql: string, params?: unknown[],
    ) => client.query<T>(sql, params);
    try {
      await query("BEGIN");
      const version = await query<{server_version_num:string}>("SHOW server_version_num");
      expect(Number(version.rows[0]?.server_version_num)).toBeGreaterThanOrEqual(180000);
      expect(Number(version.rows[0]?.server_version_num)).toBeLessThan(190000);
      // Install isolated source only on an empty disposable fixture.
      for (const [table, migration] of [
        ["identity.characters", "packages/identity/migrations/0001_identity_foundation.sql"],
        ["identity.character_ownership", "packages/identity/migrations/0002_character_ownership.sql"],
        ["masana.character_revisions", "packages/masana/migrations/0001_masana_profiles.sql"],
        ["agents.character_sessions", "packages/agents/migrations/0001_character_sessions.sql"],
        ["agents.mobile_turn_commands", "packages/agents/migrations/0006_mobile_shell.sql"],
        ["masana.fan_chat_preferences", "packages/masana/migrations/0002_chat_inbox.sql"],
      ] as const) {
        const present = await query<{name:string|null}>(
          "SELECT to_regclass($1)::text AS name", [table]);
        if (!present.rows[0]?.name) {
          await query(await readFile(root + migration, "utf8"));
        }
      }
      const slug = randomUUID().replace(/-/g, "").slice(0, 16);
      const tenant = "tenant_c10_test_" + slug;
      const fan = "fan_c10_" + slug;
      const other = "fan_c10_other_" + slug;
      const character = "character_" + randomUUID();
      const human = "character_" + randomUUID();
      const session = "character-session_" + randomUUID();
      await query("INSERT INTO identity.tenants(tenant_id,created_at,updated_at) VALUES($1,now(),now())", [tenant]);
      for (const id of [fan,other]) {
        await query("INSERT INTO identity.users(tenant_id,user_id,created_at,updated_at) VALUES($1,$2,now(),now())", [tenant,id]);
      }
      for (const id of [character,human]) {
        await query("INSERT INTO identity.characters(tenant_id,character_id,created_at,updated_at) VALUES($1,$2,now(),now())", [tenant,id]);
      }
      await query("INSERT INTO identity.character_ownership(tenant_id,character_id,kind,created_at) VALUES($1,$2,'platform',now())", [tenant,character]);
      await query("INSERT INTO identity.character_ownership(tenant_id,character_id,kind,owner_user_id,created_at) VALUES($1,$2,'personal-clone',$3,now())", [tenant,human,other]);
      const bible = {
        handle:"c10-" + slug, displayName:"Test Teacher", profession:"Educator",
        portraitMediaId:"portrait-"+slug, bannerMediaId:"banner-"+slug,
      };
      await query("INSERT INTO masana.character_revisions(tenant_id,character_id,revision,profile) VALUES($1,$2,1,$3::jsonb)",
        [tenant,character,JSON.stringify(bible)]);
      for (const kind of ["portrait","banner"] as const) {
        const media = kind === "portrait" ? bible.portraitMediaId : bible.bannerMediaId;
        await query(`INSERT INTO masana.character_media
          (tenant_id,media_id,character_id,kind,object_key,rights_note,approved_by)
          VALUES($1,$2,$3,$4,$5,'Original artwork licensed to platform','staff')`,
          [tenant,media,character,kind,"masana/"+media]);
      }
      await query(`UPDATE masana.character_revisions
        SET state='approved',approved_by='staff',approved_at=now()
        WHERE tenant_id=$1 AND character_id=$2 AND revision=1`,[tenant,character]);
      const insertSession = async (userId:string, characterId:string, sid:string) => {
        await query(`INSERT INTO agents.character_sessions
          (tenant_id,character_session_id,user_id,character_id,relationship_id,
           character_version_id,bindings,admission_hash,created_at,updated_at,expires_at)
          VALUES($1,$2,$3,$4,$5,$6,'{}'::jsonb,$7,
                 now()-interval '2 minutes',now()-interval '2 minutes',
                 now()+interval '1 day')`,
          [tenant,sid,userId,characterId,"relation_"+sid,"version_"+sid,"a".repeat(64)]);
      };
      await insertSession(fan, character, session);
      await insertSession(fan, human, "character-session_"+randomUUID());
      await query(`INSERT INTO agents.mobile_turn_commands
        (tenant_id,user_id,character_id,relationship_id,character_session_id,request_id,
         kind,user_text,payload_hash,state,reply,created_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,'text','Hello',$7,'completed','Teacher reply',
               now()-interval '1 minute',now()-interval '1 minute')`,
        [tenant,fan,character,"relation_"+session,session,
          "request_"+randomUUID(),"b".repeat(64)]);
      const inbox = createMasanaInboxRepository(client as unknown as Pick<Pool,"query">);
      const scope = {tenantId:tenant,fanUserId:fan};
      const first = await inbox.list(scope);
      expect(first).toHaveLength(1);
      expect(first[0]?.characterId).toBe(character);
      expect(first[0]?.displayName).toBe("Test Teacher");
      expect(first[0]?.lastMessage).toBe("Teacher reply");
      expect(first[0]?.unreadCount).toBe(1);
      expect(await inbox.list({tenantId:tenant,fanUserId:other})).toEqual([]);
      expect(await inbox.list({tenantId:"tenant-other",fanUserId:fan})).toEqual([]);
      expect(await inbox.setPinned(scope,human,true,0)).toBeNull();
      expect(await inbox.setPinned(scope,character,true,0)).toBe(1);
      expect(await inbox.setPinned(scope,character,false,0)).toBeNull();
      expect((await inbox.list(scope))[0]?.pinned).toBe(true);
      expect(await inbox.markRead(scope,character)).toBe(2);
      expect((await inbox.list(scope))[0]?.unreadCount).toBe(0);
      await query(`UPDATE masana.character_revisions SET state='retired'
        WHERE tenant_id=$1 AND character_id=$2 AND revision=1`,[tenant,character]);
      expect(await inbox.list(scope)).toEqual([]);
      expect(await inbox.markRead(scope,character)).toBeNull();
    } finally {
      try { await query("ROLLBACK"); }
      finally { client.release(); await db.end(); }
    }
  }, 30000);
});
