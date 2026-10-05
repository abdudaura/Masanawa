import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import { runMigrations } from "../migrations.js";
import { createPostgresTwinRuntimeRepository } from "./twin-economy.js";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describeDatabase = connectionString ? describe : describe.skip;

describeDatabase("Twin economy PostgreSQL acceptance", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    await runMigrations(pool, [{
      owner: "commerce",
      directory: fileURLToPath(
        new URL("../../../../../packages/commerce/migrations", import.meta.url),
      ),
    }]);
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("persists one immutable Credit transfer receipt and accepts only exact replay", async () => {
    const repository = createPostgresTwinRuntimeRepository(pool);
    const tenantId = createCanonicalId("tenant");
    const otherTenantId = createCanonicalId("tenant");
    const senderUserId = createCanonicalId("user");
    const recipientUserId = createCanonicalId("user");
    const ledgerEntryId = createCanonicalId("ledger-entry");
    const requestId = "twin-transfer-postgres-1";
    const completedAt = "2026-10-05T17:30:00.000Z";

    const receipt = await repository.recordCreditOperation({
      tenantId,
      requestId,
      kind: "transfer",
      senderUserId,
      recipientUserId,
      characterId: null,
      amountCredits: 250,
      ledgerEntryId,
      completedAt,
    });

    expect(receipt).toMatchObject({
      tenantId,
      requestId,
      kind: "transfer",
      senderUserId,
      recipientUserId,
      characterId: null,
      amountCredits: 250,
      ledgerEntryId,
    });

    await expect(repository.recordCreditOperation({
      tenantId,
      requestId,
      kind: "transfer",
      senderUserId,
      recipientUserId,
      characterId: null,
      amountCredits: 250,
      ledgerEntryId,
      completedAt,
    })).resolves.toEqual(receipt);

    await expect(repository.recordCreditOperation({
      tenantId,
      requestId,
      kind: "transfer",
      senderUserId,
      recipientUserId,
      characterId: null,
      amountCredits: 251,
      ledgerEntryId,
      completedAt,
    })).rejects.toThrow("replay conflict");

    await expect(repository.readCreditOperation({
      tenantId: otherTenantId,
      requestId,
    })).resolves.toBeNull();

    await expect(pool.query(
      `UPDATE commerce.twin_credit_operations
          SET amount_credits = amount_credits + 1
        WHERE tenant_id=$1 AND request_id=$2`,
      [tenantId, requestId],
    )).rejects.toThrow("Twin economy history is immutable");
  });

  it("returns only the latest owner request for the authenticated requester and Twin", async () => {
    const repository = createPostgresTwinRuntimeRepository(pool);
    const tenantId = createCanonicalId("tenant");
    const requesterUserId = createCanonicalId("user");
    const otherRequesterUserId = createCanonicalId("user");
    const ownerUserId = createCanonicalId("user");
    const characterId = createCanonicalId("character");
    const otherCharacterId = createCanonicalId("character");

    const put = async (
      requestId: string,
      targetCharacterId: typeof characterId,
      requestedAt: string,
    ) => repository.putOwnerAccessRequest({
      tenantId,
      request: {
        requestId,
        requesterUserId,
        ownerUserId,
        originatingCharacterId: targetCharacterId,
        modality: "voice",
        durationMinutes: 15,
        priceCredits: 0,
        platformFeeCredits: 0,
        ownerEarningCredits: 0,
        chargeMode: "trial",
        trialPolicyRevision: 1,
        state: "requested",
        requestedAt,
        acceptBy: new Date(Date.parse(requestedAt) + 60 * 60 * 1000).toISOString(),
        scheduledFor: null,
        startedAt: null,
        completedAt: null,
      },
      reservationId: null,
      reservedCredits: 0,
    });

    await put(
      "owner-request-postgres-older",
      characterId,
      "2026-10-05T10:00:00.000Z",
    );
    await put(
      "owner-request-postgres-latest",
      characterId,
      "2026-10-05T11:00:00.000Z",
    );
    await put(
      "owner-request-postgres-other-twin",
      otherCharacterId,
      "2026-10-05T12:00:00.000Z",
    );

    await expect(
      repository.readLatestOwnerAccessRequestForRequester({
        tenantId,
        requesterUserId,
        characterId,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        requestId: "owner-request-postgres-latest",
        requesterUserId,
        originatingCharacterId: characterId,
      }),
    );

    await expect(
      repository.readLatestOwnerAccessRequestForRequester({
        tenantId,
        requesterUserId: otherRequesterUserId,
        characterId,
      }),
    ).resolves.toBeNull();
  });

  it("converges concurrent exact replays onto one durable receipt", async () => {
    const repository = createPostgresTwinRuntimeRepository(pool);
    const tenantId = createCanonicalId("tenant");
    const senderUserId = createCanonicalId("user");
    const recipientUserId = createCanonicalId("user");
    const ledgerEntryId = createCanonicalId("ledger-entry");
    const input = {
      tenantId,
      requestId: "twin-transfer-postgres-race-1",
      kind: "transfer" as const,
      senderUserId,
      recipientUserId,
      characterId: null,
      amountCredits: 75,
      ledgerEntryId,
      completedAt: "2026-10-05T17:31:00.000Z",
    };

    const results = await Promise.all([
      repository.recordCreditOperation(input),
      repository.recordCreditOperation(input),
    ]);

    expect(results[0]).toEqual(results[1]);

    const persisted = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM commerce.twin_credit_operations
        WHERE tenant_id=$1 AND request_id=$2`,
      [tenantId, input.requestId],
    );
    expect(persisted.rows[0]?.count).toBe("1");
  });
});
