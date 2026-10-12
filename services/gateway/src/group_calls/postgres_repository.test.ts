import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, it, expect } from "vitest";
import { createPostgresPool, type Pool } from "@masanawa/postgres";
import { createPostgresGroupCallRepository } from "./postgres_repository.js";
let admin: Pool;
let pool: Pool;
const name = `group_calls_${randomUUID().replaceAll("-", "")}`;
const actor = { tenantId: "tenant-a", userId: "user-a", characterIds: null };
let repo: ReturnType<typeof createPostgresGroupCallRepository>;
beforeAll(async () => {
  admin = createPostgresPool({
    connectionString: process.env.MASANAWA_TEST_DATABASE_URL!,
    applicationName: "group-test",
  });
  await admin.query(`CREATE DATABASE "${name}"`);
  const url = new URL(process.env.MASANAWA_TEST_DATABASE_URL!);
  url.pathname = `/${name}`;
  pool = createPostgresPool({
    connectionString: url.toString(),
    applicationName: "group-test",
  });
  await pool.query("CREATE SCHEMA agents");
  for (const file of [
    "0002_agent_configurations.sql",
    "0004_platform_agent_preferences.sql",
    "0007_masana_call_history.sql",
    "0008_masana_group_calls.sql",
  ])
    await pool.query(
      await readFile(
        new URL(
          `../../../../packages/agents/migrations/${file}`,
          import.meta.url,
        ),
        "utf8",
      ),
    );
  await pool.query(
    `INSERT INTO agents.agent_presentations (tenant_id,character_id,character_version_id,display_name,role_label) VALUES ('tenant-a','a','v','A','Masana'),('tenant-a','b','v','B','Masana'),('tenant-a','twin','v','Twin','Retired')`,
  );
  await pool.query(
    `INSERT INTO agents.platform_agent_profiles (tenant_id,character_id,voice_provider,voice_name,support_agent) VALUES ('tenant-a','a','gemini','Kore',true),('tenant-a','b','gemini','Kore',true)`,
  );
  repo = createPostgresGroupCallRepository(pool);
});
afterAll(async () => {
  await repo?.drainBackground();
  await pool?.end();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
    await admin.end();
  }
});
it("durable replay, payload conflict, current roster and account isolation", async () => {
  const group = await repo.create({
    ...actor,
    requestId: "replay",
    selected: ["a", "b"],
  });
  expect(
    await repo.create({ ...actor, requestId: "replay", selected: ["a", "b"] }),
  ).toEqual(group);
  await expect(
    repo.create({ ...actor, requestId: "replay", selected: ["a", "twin"] }),
  ).rejects.toMatchObject({ statusCode: 409 });
  await expect(
    repo.create({ ...actor, requestId: "twin", selected: ["a", "twin"] }),
  ).rejects.toMatchObject({ statusCode: 403 });
  await expect(
    repo.get({ ...actor, userId: "foreign", groupId: group.groupId }),
  ).rejects.toMatchObject({ statusCode: 404 });
  await expect(
    repo.get({ ...actor, characterIds: ["a"], groupId: group.groupId }),
  ).rejects.toMatchObject({ statusCode: 404 });
});
it("removal and end serialize against issuance and never resurrect membership", async () => {
  const group = await repo.create({
    ...actor,
    requestId: "race",
    selected: ["a", "b"],
  });
  let enter!: () => void;
  const entered = new Promise<void>((r) => (enter = r));
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const issue = repo.issue(
    { ...actor, groupId: group.groupId, characterId: "a" },
    async () => {
      enter();
      await gate;
      const callId = randomUUID();
      await pool.query(
        `INSERT INTO agents.masana_call_history (tenant_id,user_id,call_id,character_id,display_name,expires_at) VALUES ('tenant-a','user-a',$1,'a','A',clock_timestamp()+interval '30 minutes')`,
        [callId],
      );
      return { callId };
    },
  );
  await entered;
  const remove = repo.remove({
    ...actor,
    groupId: group.groupId,
    characterId: "a",
  });
  release();
  await issue;
  await remove;
  await expect(
    repo.issue(
      { ...actor, groupId: group.groupId, characterId: "a" },
      async () => {
        throw Error("must not mint");
      },
    ),
  ).rejects.toMatchObject({ statusCode: 409 });
  await repo.end({ ...actor, groupId: group.groupId });
  await expect(
    repo.issue(
      { ...actor, groupId: group.groupId, characterId: "b" },
      async () => {
        throw Error("must not mint");
      },
    ),
  ).rejects.toMatchObject({ statusCode: 409 });
});
it("rechecks visibility and rejects unowned child history", async () => {
  const group = await repo.create({
    ...actor,
    requestId: "eligibility",
    selected: ["a", "b"],
  });
  await expect(
    repo.issue(
      { ...actor, groupId: group.groupId, characterId: "a" },
      async () => ({ callId: randomUUID() }),
    ),
  ).rejects.toMatchObject({ statusCode: 503 });
  await pool.query(
    `UPDATE agents.agent_presentations SET visible_in_user_app=false WHERE character_id='b'`,
  );
  await expect(
    repo.issue(
      { ...actor, groupId: group.groupId, characterId: "b" },
      async () => {
        throw Error("must not mint");
      },
    ),
  ).rejects.toMatchObject({ statusCode: 403 });
});
it("concurrent request replay creates exactly one group and end wins before subsequent issuance", async () => {
  await pool.query(
    `UPDATE agents.agent_presentations SET visible_in_user_app=true WHERE character_id='b'`,
  );
  const groups = await Promise.all(
    Array.from({ length: 4 }, () =>
      repo.create({ ...actor, requestId: "concurrent", selected: ["a", "b"] }),
    ),
  );
  expect(new Set(groups.map((g) => g.groupId)).size).toBe(1);
  const groupId = groups[0]!.groupId;
  const ended = await repo.end({ ...actor, groupId });
  expect(ended.state).toBe("ended");
  expect(await repo.end({ ...actor, groupId })).toEqual(ended);
  await expect(
    repo.issue({ ...actor, groupId, characterId: "a" }, async () => {
      throw Error("must not mint");
    }),
  ).rejects.toMatchObject({ statusCode: 409 });
});
it("bounds mint latency, releases termination lock and closes late orphan history", async () => {
  const short = createPostgresGroupCallRepository(pool, { mintTimeoutMs: 20 });
  const group = await repo.create({
    ...actor,
    requestId: "timeout",
    selected: ["a", "b"],
  });
  let finish!: () => void;
  const gate = new Promise<void>((r) => (finish = r));
  const callId = randomUUID();
  const issue = short.issue(
    { ...actor, groupId: group.groupId, characterId: "a" },
    async () => {
      await gate;
      await pool.query(
        `INSERT INTO agents.masana_call_history (tenant_id,user_id,call_id,character_id,display_name,expires_at) VALUES ('tenant-a','user-a',$1,'a','A',clock_timestamp()+interval '30 minutes')`,
        [callId],
      );
      return { callId };
    },
  );
  await expect(issue).rejects.toMatchObject({ statusCode: 504 });
  expect((await repo.end({ ...actor, groupId: group.groupId })).state).toBe(
    "ended",
  );
  finish();
  await expect
    .poll(async () => {
      const r = await pool.query(
        "SELECT ended_at FROM agents.masana_call_history WHERE call_id=$1",
        [callId],
      );
      return r.rows[0]?.ended_at != null;
    })
    .toBe(true);
  await short.drainBackground();
});
it("closes externally inserted child when visibility changes during mint", async () => {
  const group = await repo.create({
    ...actor,
    requestId: "mid-mint",
    selected: ["a", "b"],
  });
  const callId = randomUUID();
  await expect(
    repo.issue(
      { ...actor, groupId: group.groupId, characterId: "a" },
      async () => {
        await pool.query(
          `INSERT INTO agents.masana_call_history (tenant_id,user_id,call_id,character_id,display_name,expires_at) VALUES ('tenant-a','user-a',$1,'a','A',clock_timestamp()+interval '30 minutes')`,
          [callId],
        );
        await pool.query(
          `UPDATE agents.agent_presentations SET visible_in_user_app=false WHERE character_id='a'`,
        );
        return { callId };
      },
    ),
  ).rejects.toMatchObject({ statusCode: 403 });
  expect(
    (
      await pool.query(
        "SELECT ended_at FROM agents.masana_call_history WHERE call_id=$1",
        [callId],
      )
    ).rows[0]?.ended_at,
  ).not.toBeNull();
  await pool.query(
    `UPDATE agents.agent_presentations SET visible_in_user_app=true WHERE character_id='a'`,
  );
});
it("server roster requires strict paid admission for non-support Masana before mint", async () => {
  const group = await repo.create({
    ...actor,
    requestId: "strict-paid",
    selected: ["a", "b"],
  });
  await pool.query(
    `UPDATE agents.platform_agent_profiles SET support_agent=false WHERE character_id='a'`,
  );
  let minted = false;
  const mint = async () => {
    minted = true;
    return { callId: randomUUID() };
  };
  await expect(
    repo.issue({ ...actor, groupId: group.groupId, characterId: "a" }, mint),
  ).rejects.toMatchObject({ statusCode: 503 });
  await expect(
    repo.issue(
      { ...actor, groupId: group.groupId, characterId: "a" },
      mint,
      async (participant) => {
        expect(participant.supportAgent).toBe(false);
        throw Object.assign(new Error("consent required"), { statusCode: 403 });
      },
    ),
  ).rejects.toMatchObject({ statusCode: 403 });
  expect(minted).toBe(false);
  await pool.query(
    `UPDATE agents.platform_agent_profiles SET support_agent=true WHERE character_id='a'`,
  );
});
