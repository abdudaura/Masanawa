import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import { hashPlatformSessionToken, mintPlatformSessionToken } from "@masanawa/security";
import { runMigrations } from "../migrations.js";
import { createPostgresPlatformSessionRepository } from "../security/platform-session.js";
import { createPgFanDeviceSessionStore } from "./device_sessions.js";

const connectionString=process.env.MASANAWA_TEST_DATABASE_URL;
const describeDb=connectionString?describe:describe.skip;
describeDb("C09 canonical device session PostgreSQL acceptance",()=>{
  let pool:Pool;
  beforeAll(async()=>{
    pool=new Pool({connectionString});
    await runMigrations(pool,[
      {owner:"events",directory:fileURLToPath(new URL("../../../../../packages/events/migrations",import.meta.url))},
      {owner:"security",directory:fileURLToPath(new URL("../../../../../packages/security/migrations",import.meta.url))},
      {owner:"identity",directory:fileURLToPath(new URL("../../../../../packages/identity/migrations",import.meta.url))},
    ]);
  });
  afterAll(async()=>{await pool?.end();});

  it("lists only own devices and denies revoked or cross-fan bearer",async()=>{
    const auth=createPostgresPlatformSessionRepository(pool);
    const store=createPgFanDeviceSessionStore(pool);
    const tenantId=createCanonicalId("tenant"),now=new Date().toISOString();
    const a=await auth.createProfile({tenantId,channel:"email",identifier:`c09-a-${tenantId.slice(-8)}@example.test`,name:"A",locale:"en",createdAt:now});
    const b=await auth.createProfile({tenantId,channel:"email",identifier:`c09-b-${tenantId.slice(-8)}@example.test`,name:"B",locale:"en",createdAt:now});
    const expires=new Date(Date.parse(now)+15*60_000).toISOString();
    const refreshExpires=new Date(Date.parse(now)+24*60*60_000).toISOString();
    async function issue(user:typeof a) {
      const access=mintPlatformSessionToken("access");
      const refresh=mintPlatformSessionToken("refresh");
      await auth.issueSession({identity:{tenantId,userId:user.userId,profile:user},
        accessHash:hashPlatformSessionToken(access),refreshHash:hashPlatformSessionToken(refresh),
        accessExpiresAt:expires,refreshExpiresAt:refreshExpires,issuedAt:now});
      return {accessHash:hashPlatformSessionToken(access),access,refresh};
    }
    const current=await issue(a),remote=await issue(a),foreign=await issue(b);
    const actorA={tenantId,fanUserId:a.userId},actorB={tenantId,fanUserId:b.userId};
    const devices=await store.list(actorA,current.accessHash);
    expect(devices).toHaveLength(2);
    expect(devices?.filter(d=>d.current)).toHaveLength(1);
    const other=devices?.find(d=>!d.current);
    expect(other?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(devices)).not.toContain(current.accessHash);
    expect(await store.list(actorB,current.accessHash)).toBeNull();
    expect(await store.revoke(actorB,foreign.accessHash,other!.id,"cross-fan-001")).toBe("not_found");
    expect(await store.revoke(actorA,current.accessHash,
      devices!.find(d=>d.current)!.id,"current-deny-001")).toBe("current");
    // Existing OTP sign-in issued this session moments ago: step-up satisfied.
    expect(await store.revoke(actorA,current.accessHash,other!.id,"stable-key-001")).toBe("revoked");
    expect(await store.revoke(actorA,current.accessHash,other!.id,"stable-key-001")).toBe("already");
    expect(await store.revoke(actorA,current.accessHash,
      devices!.find(d=>d.current)!.id,"same-key-other-device")).toBe("current");
    expect(await store.list(actorA,remote.accessHash)).toBeNull();
    expect(await auth.resolveAccess({accessHash:remote.accessHash,at:new Date().toISOString()})).toBeNull();
    expect(await auth.rotateRefresh({
      refreshHash:hashPlatformSessionToken(remote.refresh),
      nextAccessHash:hashPlatformSessionToken(mintPlatformSessionToken("access")),
      nextRefreshHash:hashPlatformSessionToken(mintPlatformSessionToken("refresh")),
      accessExpiresAt:expires,refreshExpiresAt:refreshExpires,rotatedAt:new Date().toISOString(),
    })).toBeNull();
    const audits=await pool.query<{n:string}>(`
      SELECT count(*)::text AS n FROM security.fan_session_revocation_audit
      WHERE tenant_id=$1 AND fan_user_id=$2 AND device_id=$3::uuid`,
      [tenantId,a.userId,other!.id]);
    expect(audits.rows[0]?.n).toBe("1");
    const after=await store.list(actorA,current.accessHash);
    expect(after).toHaveLength(1);
    expect(after?.[0]?.current).toBe(true);
  });
  it("requires a fresh OTP-authenticated platform session for a destructive revoke",async()=>{
    const auth=createPostgresPlatformSessionRepository(pool);
    const store=createPgFanDeviceSessionStore(pool);
    const tenantId=createCanonicalId("tenant");
    const issuedAt=new Date(Date.now()-90*60_000).toISOString();
    const future=new Date(Date.now()+15*60_000).toISOString();
    const refreshFuture=new Date(Date.now()+24*60*60_000).toISOString();
    const profile=await auth.createProfile({tenantId,channel:"email",
      identifier:`c09-stale-${tenantId.slice(-8)}@example.test`,
      name:"Old OTP",locale:"en",createdAt:issuedAt});
    const tokens=Array.from({length:2},()=>({
      access:mintPlatformSessionToken("access"),refresh:mintPlatformSessionToken("refresh")
    }));
    for(const token of tokens) {
      await auth.issueSession({identity:{tenantId,userId:profile.userId,profile},
        accessHash:hashPlatformSessionToken(token.access),
        refreshHash:hashPlatformSessionToken(token.refresh),
        accessExpiresAt:future,refreshExpiresAt:refreshFuture,issuedAt});
    }
    const owner={tenantId,fanUserId:profile.userId},access=hashPlatformSessionToken(tokens[0]!.access);
    const remote=(await store.list(owner,access))!.find(d=>!d.current)!;
    expect(await store.revoke(owner,access,remote.id,"revoke-stale-001")).toBe("step_up_required");
    expect(await auth.resolveAccess({
      accessHash:hashPlatformSessionToken(tokens[1]!.access),at:new Date().toISOString()
    })).not.toBeNull();
    const count=await pool.query<{n:string}>(`
      SELECT count(*)::text AS n FROM security.fan_session_revocation_audit
      WHERE tenant_id=$1 AND fan_user_id=$2`,[tenantId,profile.userId]);
    expect(count.rows[0]?.n).toBe("0");
  });
});
