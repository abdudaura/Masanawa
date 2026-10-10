import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { createPostgresVideoStore } from "./repository.js";

const database = process.env.MASANAWA_TEST_DATABASE_URL;
const testWithDb = database ? describe : describe.skip;

testWithDb("J15 external videos PG18 — audited, tenant-fenced manual approval", () => {
  const pool = new Pool({ connectionString: database });
  const repo = createPostgresVideoStore(pool);
  const tenantId = "video-test-" + randomUUID();
  const otherTenant = "video-test-" + randomUUID();
  const actorId = "staff-" + randomUUID();
  const id = randomUUID();
  beforeAll(async () => {
    const url = new URL("../../../../../packages/external-videos/migrations/0001_external_videos.sql", import.meta.url);
    await pool.query(await readFile(url, "utf8"));
  });
  afterAll(async () => { await pool.end(); });

  it("does not show pending videos, verifies on approve, hides on revoke and audits all transitions", async () => {
    const original = {
      id, tenantId, provider: "youtube" as const, providerVideoId: "abcDE12_-34",
      sourceUrl: "https://www.youtube.com/watch?v=abcDE12_-34",
      title: "Algebra", channelName: "Tutor", reviewState: "pending" as const,
      verifiedAt: null, createdAt: new Date().toISOString(),
    };
    const saved = await repo.submit(original, actorId);
    expect(saved.id).toBe(id);
    const duplicate = await repo.submit({ ...original, id: randomUUID() }, actorId);
    expect(duplicate.id).toBe(id);
    expect(await repo.list({tenantId,publicOnly:true,limit:10})).toEqual([]);
    expect(await repo.list({tenantId:otherTenant,publicOnly:false,limit:10})).toEqual([]);

    const approved = await repo.review({
      tenantId, id, actorId, expectedState:"pending", state:"approved",
      verificationReference:"verified-official-provider-player-123",
    });
    expect(approved?.reviewState).toBe("approved");
    expect(await repo.list({tenantId,publicOnly:true,limit:10})).toHaveLength(1);
    expect(await repo.review({tenantId:otherTenant,id,actorId,expectedState:"approved",state:"hidden",verificationReference:null})).toBeNull();
    const hidden = await repo.review({tenantId,id,actorId,expectedState:"approved",state:"hidden",verificationReference:null});
    expect(hidden?.reviewState).toBe("hidden");
    expect(await repo.list({tenantId,publicOnly:true,limit:10})).toHaveLength(0);

    const audit = await pool.query<{action:string}>(
      "SELECT action FROM external_videos.review_audit WHERE tenant_id=$1 AND item_id=$2 ORDER BY occurred_at",
      [tenantId,id],
    );
    expect(audit.rows.map(x => x.action)).toEqual(["submit","approve","hide"]);
  });

  it("database itself blocks forged approved state without eligibility evidence", async () => {
    await expect(pool.query(
      "INSERT INTO external_videos.items(tenant_id,item_id,provider,provider_video_id,source_url,title,channel_name,review_state) "+
      "VALUES($1,$2,'tiktok',$3,$4,'Test','Teacher','approved')",
      [tenantId, randomUUID(),randomUUID(),"https://www.tiktok.com/@teacher/video/7234567890123456789"],
    )).rejects.toThrow();
  });
});
