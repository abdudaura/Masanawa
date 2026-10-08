import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import { runMigrations } from "../migrations.js";
import { createPostgresPlatformSessionRepository } from "./platform-session.js";
import { createPostgresCustomerChannelRepository } from "./customer-channel.js";
import { createPostgresMobilePushRepository } from "../agents/mobile-shell.js";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describeDatabase = connectionString ? describe : describe.skip;

describeDatabase("R12 account disabled write barriers", () => {
  let pool: Pool;
  const tenantId = createCanonicalId("tenant");
  let userId = createCanonicalId("user");
  let profile: Awaited<ReturnType<ReturnType<typeof createPostgresPlatformSessionRepository>["createProfile"]>>;
  const createdAt = new Date().toISOString();

  const accessHash = () => randomUUID().replace(/-/gu,"").padEnd(64,"a");
  const refreshHash = () => randomUUID().replace(/-/gu,"").padEnd(64,"b");

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    const root = (name: string) =>
      fileURLToPath(new URL(`../../../../../packages/${name}/migrations`, import.meta.url));
    await runMigrations(pool, [
      { owner: "events", directory: root("events") },
      { owner: "agents", directory: root("agents") },
      { owner: "identity", directory: root("identity") },
      { owner: "security", directory: root("security") },
    ]);
    profile = await createPostgresPlatformSessionRepository(pool).createProfile({
      tenantId,channel:"email",
      identifier:`r12-guards-${randomUUID()}@example.com`,
      name:"Guards Customer",locale:"en",createdAt,
    });
    userId = profile.userId;
  });
  afterAll(async () => { await pool?.end(); });

  function session() {
    return {
      identity: { tenantId,userId,profile },
      accessHash: accessHash(),
      refreshHash: refreshHash(),
      accessExpiresAt: new Date(Date.parse(createdAt) + 3600_000).toISOString(),
      refreshExpiresAt: new Date(Date.parse(createdAt) + 86400_000).toISOString(),
      issuedAt: createdAt,
    };
  }
  function link() {
    return {
      channel: "telegram" as const,
      externalUserId: `r12-${randomUUID()}`,
      chatId: `chat-${randomUUID()}`,
      tenantId,
      userId,
      characterId: createCanonicalId("character"),
      characterSessionId: null,
      updatedAt: createdAt,
    };
  }
  function installation() {
    return {
      tenantId,userId,
      installationId: `installation-${randomUUID()}`,
      platform: "android" as const,
      token: `token-${randomUUID()}`,
    };
  }

  it("preserves normal issuance/linking/push registration for active users", async () => {
    const sessions = createPostgresPlatformSessionRepository(pool);
    const channels = createPostgresCustomerChannelRepository(pool);
    const push = createPostgresMobilePushRepository(pool);
    const created = session();
    await sessions.issueSession(created);
    expect((await sessions.resolveAccess({
      accessHash: created.accessHash, at: createdAt,
    }))?.userId).toBe(userId);
    const customerLink = link();
    await channels.putLink(customerLink);
    expect((await channels.readLink({
      channel: customerLink.channel, externalUserId: customerLink.externalUserId,
    }))?.userId).toBe(userId);
    const device = await push.register(installation());
    expect(device.userId).toBe(userId);
  });

  it("serializes concurrent writes against canonical User disable and rejects each", async () => {
    const holder = await pool.connect();
    let committed = false;
    try {
      await holder.query("BEGIN");
      await holder.query(
        `SELECT state FROM identity.users
          WHERE tenant_id=$1 AND user_id=$2 FOR UPDATE`,
        [tenantId,userId],
      );
      // Requests are launched while the user row is locked, so they cannot
      // write until this transaction has resolved the new canonical state.
      const pending = Promise.allSettled([
        createPostgresPlatformSessionRepository(pool).issueSession(session()),
        createPostgresCustomerChannelRepository(pool).putLink(link()),
        createPostgresMobilePushRepository(pool).register(installation()),
      ]);
      await new Promise<void>((resolve) => setTimeout(resolve, 35));
      await holder.query(
        `UPDATE identity.users
            SET state='disabled',revision=revision+1,updated_at=$3
          WHERE tenant_id=$1 AND user_id=$2`,
        [tenantId,userId,createdAt],
      );
      await holder.query("COMMIT");
      committed = true;
      const results = await pending;
      expect(results).toHaveLength(3);
      for (const result of results) {
        expect(result.status).toBe("rejected");
        if (result.status === "rejected") {
          expect(String(result.reason)).toMatch(/account_inactive/);
        }
      }
    } finally {
      if (!committed) await holder.query("ROLLBACK").catch(() => undefined);
      holder.release();
    }
  });

  it("also fails closed for later writes without a race", async () => {
    await expect(createPostgresPlatformSessionRepository(pool).issueSession(session()))
      .rejects.toThrow("auth.account_inactive");
    await expect(createPostgresCustomerChannelRepository(pool).putLink(link()))
      .rejects.toThrow("customer_channel.account_inactive");
    await expect(createPostgresMobilePushRepository(pool).register(installation()))
      .rejects.toThrow("push.account_inactive");
  });
});
