import {readFileSync} from "node:fs";
import {describe,it,expect,beforeAll,afterAll} from "vitest";
import {createIsolatedPostgresTestDatabase} from "../../../adapters/storage/postgres/src/commerce/isolated-test-database.js";
import {createPostgresMasanaSocialStore} from "../../../adapters/storage/postgres/src/masana_social/repository.js";
import {createPostgresTelegramInbox} from "../../../adapters/storage/postgres/src/masana_social/telegram.js";
import {createPgTelegramAuthorizationStore} from "../../../adapters/storage/postgres/src/masana_social/telegram_admin.js";
import {createMasanaSocialService} from "../../../services/gateway/src/modules/masana_social/service.js";
import {telegramFanHash} from "../../../packages/masana_social/src/telegram.js";

const connectionString=process.env.MASANAWA_TEST_DATABASE_URL;
const suite=connectionString?describe:describe.skip;
// A skipped suite is NOT a passed PostgreSQL result; PG18 fresh/upgrade/restore
// evidence requires MASANAWA_TEST_DATABASE_URL on an isolated disposable database.
suite("J22 real PG18 Telegram consent, event dedupe and social authority",()=>{
 let db:Awaited<ReturnType<typeof createIsolatedPostgresTestDatabase>>;
 let pool:Awaited<ReturnType<typeof createIsolatedPostgresTestDatabase>>["pool"];
 let identityId="";
 const tenant="tenant_telegram_test_a",other="tenant_telegram_test_b";
 const fan="554433",key="long_independent_fan_hmac_key_for_local_tests_012345";
 beforeAll(async()=>{
  db=await createIsolatedPostgresTestDatabase(connectionString!);
  pool=db.pool;
  for(const migration of [
   "../../../packages/identity/migrations/0001_identity_foundation.sql",
   "../../../packages/identity/migrations/0002_character_ownership.sql",
   "../../../packages/events/migrations/0001_event_foundation.sql",
   "../../../packages/masana_social/migrations/0001_social_links.sql",
   "../../../packages/masana_social/migrations/0002_telegram_inbound.sql",
  ])await pool.query(readFileSync(new URL(migration,import.meta.url),"utf8"));
  for(const tenantId of [tenant,other]){
   await pool.query(`INSERT INTO identity.tenants(tenant_id,created_at,updated_at)
    VALUES($1,now(),now())`,[tenantId]);
   await pool.query(`INSERT INTO identity.characters(tenant_id,character_id,created_at,updated_at)
    VALUES($1,'masana_gwani',now(),now())`,[tenantId]);
   await pool.query(`INSERT INTO identity.character_ownership
    (tenant_id,character_id,kind,created_at)
    VALUES($1,'masana_gwani','platform',now())`,[tenantId]);
  }
  const service=createMasanaSocialService(createPostgresMasanaSocialStore(pool),{
   verify:async proof=>proof.evidenceRef==="verified_owner_device"});
  const actor={tenantId:tenant,userId:"staff_gwani",principalType:"staff" as const,
   roles:["ops_admin","content_editor"] as const};
  const created=await service.create(actor,"masana_gwani",{
   provider:"telegram",providerAccountId:"SampleMasanaBot",
   handle:"@SampleMasanaBot",publicUrl:"https://t.me/SampleMasanaBot"});
  identityId=created.identityId;
  const checked=await service.transition(actor,"masana_gwani",identityId,
   "verify",{revision:created.revision,evidenceRef:"verified_owner_device"});
  await service.transition(actor,"masana_gwani",identityId,"publish",{revision:checked.revision});
 });
 afterAll(async()=>{if(db)await db.close();});
 it("only permits verified server vault and official bot-matched, audited activation",async()=>{
  const store=createPgTelegramAuthorizationStore(pool);
  const proof={botId:"123456789",username:"SampleMasanaBot",
   authorizationRef:"vault:telegram/testbot",evidenceRef:"evidence:telegram/testbot",
   checkedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()};
  const denied=await createPostgresTelegramInbox(pool).authorizedBot(identityId);
  expect(denied).toBeNull();
  await expect(store.authorize({tenantId:other,actorId:"staff1",characterId:"masana_gwani",
   identityId,revision:3,bot:proof})).rejects.toMatchObject({code:"SOCIAL_NOT_FOUND"});
  const activated=await store.authorize({tenantId:tenant,actorId:"staff1",
   characterId:"masana_gwani",identityId,revision:3,bot:proof});
  expect(activated.mode).toBe("verified_automation_eligible");
  const record=await pool.query("SELECT action,evidence_ref FROM masana.social_connection_audit WHERE tenant_id=$1 AND identity_id=$2 AND action='telegram_official_authorize'",[tenant,identityId]);
  expect(record.rows).toHaveLength(1);
  expect(JSON.stringify(record.rows)).not.toContain("123456789:");
 });
 it("consent requires an explicit private /agree and a single durable outbox",async()=>{
  const inbox=createPostgresTelegramInbox(pool),bot=await inbox.authorizedBot(identityId);
  expect(bot).not.toBeNull();
  const hash=telegramFanHash(tenant,identityId,fan,key);
  expect(await inbox.isConsented(bot!,hash)).toBe(false);
  expect(await inbox.admit(bot!,{updateId:1,chatId:fan,text:"/start",command:"start"},hash,null))
   .toBe("consent_requested");
  expect(await inbox.admit(bot!,{updateId:2,chatId:fan,text:"hello",command:null},hash,null))
   .toBe("denied");
  expect(await inbox.admit(bot!,{updateId:3,chatId:fan,text:"/agree",command:"agree"},hash,null))
   .toBe("consented");
  expect(await inbox.isConsented(bot!,hash)).toBe(true);
  const event={updateId:4,chatId:fan,text:"private hello",command:null} as const;
  expect(await inbox.admit(bot!,event,hash,"private:encrypted/message_4")).toBe("queued");
  expect(await inbox.admit(bot!,event,hash,"private:encrypted/message_4")).toBe("duplicate");
  const outbox=await pool.query<{payload:Record<string,unknown>}>(`
   SELECT payload FROM events.outbox WHERE tenant_id=$1
    AND destination='masana.social.telegram.inbound'`,[tenant]);
  expect(outbox.rows).toHaveLength(1);
  expect(outbox.rows[0]?.payload.fanHash).toBe(hash);
  expect(JSON.stringify(outbox.rows)).not.toContain(fan);
  expect(JSON.stringify(outbox.rows)).not.toContain("private hello");
  expect(await inbox.admit(bot!,{updateId:5,chatId:fan,text:"/stop",command:"stop"},hash,null))
   .toBe("revoked");
  expect(await inbox.canDispatch(bot!,hash)).toBe(false);
 });
 it("enforces pause before pending-job dispatch and never cross-routes tenants",async()=>{
  const store=createPostgresMasanaSocialStore(pool);
  const me=await store.adminForCharacter(tenant,"masana_gwani");
  const record=me.find(x=>x.identityId===identityId)!;
  await store.transition({tenantId:tenant,characterId:"masana_gwani",
   identityId,actorId:"ops",revision:record.revision,action:"pause"});
  const inbox=createPostgresTelegramInbox(pool);
  expect(await inbox.authorizedBot(identityId)).toBeNull();
  const owned=await pool.query("SELECT count(*)::int AS n FROM masana.telegram_fan_consents WHERE tenant_id=$1",[other]);
  expect(owned.rows[0]?.n).toBe(0);
 });
});
