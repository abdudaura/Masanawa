import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Pool } from "pg";

/** Runs only on a local, disposable PostgreSQL 18 test database.
 * Uses one transaction and rolls back all schema/data changes. No live ledger touched.
 */
const url = process.env.MASANAWA_TEST_DATABASE_URL;
function isDisposable(uri: string | undefined): boolean {
  if (!uri) return false;
  try {
    const u = new URL(uri);
    return (u.hostname === "127.0.0.1" || u.hostname === "localhost")
      && /(?:^|_)test$/.test(u.pathname.replace(/^\//, ""))
      && ["postgresql:","postgres:"].includes(u.protocol);
  } catch { return false; }
}
const pgTest = isDisposable(url) ? it : it.skip;
const root = fileURLToPath(new URL("../../../../../", import.meta.url));
describe("Masana fresh PG18 migration and authority guards", () => {
  pgTest("installs fresh, rejects clone/draft follows, enforces approved media and immutable revisions", async () => {
    const pool = new Pool({ connectionString: url });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const version = await client.query<{server_version_num:string}>("SHOW server_version_num");
      const n = Number(version.rows[0]?.server_version_num);
      expect(n).toBeGreaterThanOrEqual(180000);
      expect(n).toBeLessThan(190000);
      for (const file of [
        "packages/identity/migrations/0001_identity_foundation.sql",
        "packages/identity/migrations/0002_character_ownership.sql",
      ]) {
        // Disposable-only: on an empty DB, create existing identity authority.
        // On an already migrated DB, do not reapply immutable historical SQL.
        if ((await client.query<{name:string|null}>(
          "SELECT to_regclass('identity.characters')::text AS name")).rows[0]?.name
          && file.endsWith("0001_identity_foundation.sql")) continue;
        if ((await client.query<{name:string|null}>(
          "SELECT to_regclass('identity.character_ownership')::text AS name")).rows[0]?.name
          && file.endsWith("0002_character_ownership.sql")) continue;
        await client.query(await readFile(root + file, "utf8"));
      }
      await client.query(await readFile(root + "packages/masana/migrations/0001_masana_profiles.sql", "utf8"));
      const uid = randomUUID().replace(/-/g, "").slice(0,16);
      const tenant = "tenant_masana_test_" + uid;
      const character = "masana-test-" + uid;
      const fan = "fan-test-" + uid;
      await client.query("INSERT INTO identity.tenants(tenant_id,created_at,updated_at) VALUES($1,now(),now())",[tenant]);
      await client.query("INSERT INTO identity.users(tenant_id,user_id,created_at,updated_at) VALUES($1,$2,now(),now())",[tenant,fan]);
      await client.query("INSERT INTO identity.characters(tenant_id,character_id,created_at,updated_at) VALUES($1,$2,now(),now())",[tenant,character]);
      await client.query("INSERT INTO identity.character_ownership(tenant_id,character_id,kind,created_at) VALUES($1,$2,'platform',now())",[tenant,character]);
      const bible={
        handle:"test-"+uid,displayName:"Test Masana",profession:"Teaching",biography:"Fictional teacher",
        lifeStory:"Fictional story",languages:["en"],talents:["math"],goals:["help"],
        roomId:null,portraitMediaId:"media-portrait-"+uid,bannerMediaId:"media-banner-"+uid,
      };
      await client.query("INSERT INTO masana.character_revisions(tenant_id,character_id,revision,state,profile) VALUES($1,$2,1,'draft',$3::jsonb)",[tenant,character,JSON.stringify(bible)]);
      const rollbackDenied = async (statement:string,args:unknown[],code:string) => {
        await client.query("SAVEPOINT denied");
        await expect(client.query(statement,args)).rejects.toMatchObject({code});
        await client.query("ROLLBACK TO SAVEPOINT denied");
        await client.query("RELEASE SAVEPOINT denied");
      };
      await rollbackDenied(
        "INSERT INTO masana.follows(tenant_id,fan_user_id,character_id) VALUES($1,$2,$3)",
        [tenant,fan,character],"23514");
      await rollbackDenied(
        "UPDATE masana.character_revisions SET state='approved',approved_by='staff',approved_at=now() WHERE tenant_id=$1 AND character_id=$2 AND revision=1",
        [tenant,character],"23514");
      for (const [kind,media] of [["portrait",bible.portraitMediaId],["banner",bible.bannerMediaId]]) {
        await client.query("INSERT INTO masana.character_media(tenant_id,media_id,character_id,kind,object_key,rights_note,approved_by) VALUES($1,$2,$3,$4,$5,'Original artwork licensed to platform','staff')",[tenant,media,character,kind,"masana/"+media]);
      }
      await client.query("UPDATE masana.character_revisions SET state='approved',approved_by='staff',approved_at=now() WHERE tenant_id=$1 AND character_id=$2 AND revision=1",[tenant,character]);
      await client.query("INSERT INTO masana.follows(tenant_id,fan_user_id,character_id) VALUES($1,$2,$3)",[tenant,fan,character]);
      await client.query("INSERT INTO masana.follows(tenant_id,fan_user_id,character_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",[tenant,fan,character]);
      const count = await client.query<{n:string}>("SELECT count(*)::text AS n FROM masana.follows WHERE tenant_id=$1 AND character_id=$2",[tenant,character]);
      expect(count.rows[0]?.n).toBe("1");
      await rollbackDenied(
        "UPDATE masana.character_revisions SET profile='{}'::jsonb WHERE tenant_id=$1 AND character_id=$2 AND revision=1",
        [tenant,character],"23514");
      // Historical finance and current tenants remain unaffected after rollback.
    } finally {
      try {await client.query("ROLLBACK");} finally {client.release(); await pool.end();}
    }
  }, 30000);
});
