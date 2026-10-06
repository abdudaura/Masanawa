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

  it("allows exactly one concurrent owner-request state transition", async () => {
    const repository = createPostgresTwinRuntimeRepository(pool);
    const tenantId = createCanonicalId("tenant");
    const requesterUserId = createCanonicalId("user");
    const ownerUserId = createCanonicalId("user");
    const characterId = createCanonicalId("character");
    const requestId = "owner-request-cas-race";
    const base = {
      requestId,
      requesterUserId,
      ownerUserId,
      originatingCharacterId: characterId,
      modality: "voice" as const,
      durationMinutes: 15,
      priceCredits: 0,
      platformFeeCredits: 0,
      ownerEarningCredits: 0,
      chargeMode: "trial" as const,
      trialPolicyRevision: 1,
      state: "requested" as const,
      requestedAt: "2026-10-05T12:00:00.000Z",
      acceptBy: "2026-10-05T13:00:00.000Z",
      scheduledFor: null,
      startedAt: null,
      completedAt: null,
    };
    await repository.putOwnerAccessRequest({
      tenantId,
      request: base,
      reservationId: null,
      reservedCredits: 0,
    });

    const [accepted, cancelled] = await Promise.all([
      repository.transitionOwnerAccessRequest({
        tenantId,
        expectedState: "requested",
        request: { ...base, state: "accepted" },
        reservationId: null,
        reservedCredits: 0,
      }),
      repository.transitionOwnerAccessRequest({
        tenantId,
        expectedState: "requested",
        request: { ...base, state: "cancelled" },
        reservationId: null,
        reservedCredits: 0,
      }),
    ]);

    expect([accepted.applied, cancelled.applied].filter(Boolean)).toHaveLength(1);
    const persisted = await repository.readOwnerAccessRequest({
      tenantId,
      requestId,
    });
    expect(["accepted", "cancelled"]).toContain(persisted?.state);
    expect(persisted?.state).toBe(
      accepted.applied ? "accepted" : "cancelled",
    );
  });

  it("finds only due or recoverable owner-access lifecycle work", async () => {
    const repository = createPostgresTwinRuntimeRepository(pool);
    const tenantId = createCanonicalId("tenant");
    const requesterUserId = createCanonicalId("user");
    const ownerUserId = createCanonicalId("user");
    const characterId = createCanonicalId("character");
    const at = "2026-10-05T14:00:00.000Z";

    const put = async (input: {
      requestId: string;
      state: "requested" | "scheduled" | "active" | "expired" | "completed";
      acceptBy?: string;
      scheduledFor?: string | null;
    }) => {
      await repository.putOwnerAccessRequest({
        tenantId,
        request: {
          requestId: input.requestId,
          requesterUserId,
          ownerUserId,
          originatingCharacterId: characterId,
          modality: "voice",
          durationMinutes: 15,
          priceCredits: 0,
          platformFeeCredits: 0,
          ownerEarningCredits: 0,
          chargeMode: "trial",
          trialPolicyRevision: 1,
          state: input.state,
          requestedAt: "2026-10-05T12:00:00.000Z",
          acceptBy: input.acceptBy ?? "2026-10-05T15:00:00.000Z",
          scheduledFor: input.scheduledFor ?? null,
          startedAt: input.state === "active"
            ? "2026-10-05T13:50:00.000Z"
            : null,
          completedAt: input.state === "completed"
            ? "2026-10-05T13:59:00.000Z"
            : null,
        },
        reservationId: null,
        reservedCredits: 0,
      });
    };

    await put({
      requestId: "owner-due-requested",
      state: "requested",
      acceptBy: "2026-10-05T13:59:00.000Z",
    });
    await put({
      requestId: "owner-future-requested",
      state: "requested",
      acceptBy: "2026-10-05T14:01:00.000Z",
    });
    await put({
      requestId: "owner-due-scheduled",
      state: "scheduled",
      scheduledFor: "2026-10-05T13:44:00.000Z",
    });
    await put({
      requestId: "owner-future-scheduled",
      state: "scheduled",
      scheduledFor: "2026-10-05T13:50:00.000Z",
    });
    await put({
      requestId: "owner-active",
      state: "active",
    });
    await put({
      requestId: "owner-repair-expired",
      state: "expired",
    });
    await put({
      requestId: "owner-repair-completed",
      state: "completed",
    });

    const candidates = await repository.listOwnerAccessLifecycleCandidates({
      tenantId,
      at,
      startGraceMinutes: 15,
      completionGraceMinutes: 15,
      limit: 100,
    });
    expect(new Set(candidates.map((item) => item.requestId))).toEqual(
      new Set([
        "owner-due-requested",
        "owner-due-scheduled",
        "owner-repair-expired",
        "owner-repair-completed",
      ]),
    );
  });

  it("persists owner-session messages idempotently and rejects content replay conflicts", async () => {
    const repository = createPostgresTwinRuntimeRepository(pool);
    const tenantId = createCanonicalId("tenant");
    const requesterUserId = createCanonicalId("user");
    const ownerUserId = createCanonicalId("user");
    const characterId = createCanonicalId("character");
    const requestId = "owner-room-message-request";

    await repository.putOwnerAccessRequest({
      tenantId,
      request: {
        requestId,
        requesterUserId,
        ownerUserId,
        originatingCharacterId: characterId,
        modality: "text",
        durationMinutes: 15,
        priceCredits: 0,
        platformFeeCredits: 0,
        ownerEarningCredits: 0,
        chargeMode: "trial",
        trialPolicyRevision: 1,
        state: "active",
        requestedAt: "2026-10-05T12:00:00.000Z",
        acceptBy: "2026-10-05T13:00:00.000Z",
        scheduledFor: null,
        startedAt: "2026-10-05T12:10:00.000Z",
        completedAt: null,
      },
      reservationId: null,
      reservedCredits: 0,
    });

    const message = {
      requestId,
      messageId: "message-postgres-owner-room",
      senderUserId: requesterUserId,
      body: "Hello owner",
      sentAt: "2026-10-05T12:10:05.000Z",
    };
    const first = await repository.appendOwnerAccessMessage({
      tenantId,
      message,
    });
    const replay = await repository.appendOwnerAccessMessage({
      tenantId,
      message,
    });
    expect(replay).toEqual(first);

    await expect(
      repository.appendOwnerAccessMessage({
        tenantId,
        message: { ...message, body: "Different content" },
      }),
    ).rejects.toThrow("replay conflict");

    const messages = await repository.listOwnerAccessMessages({
      tenantId,
      requestId,
      limit: 100,
    });
    expect(messages).toEqual([first]);

    await expect(
      pool.query(
        `UPDATE commerce.owner_access_messages
            SET body='mutated'
          WHERE tenant_id=$1 AND request_id=$2 AND message_id=$3`,
        [tenantId, requestId, message.messageId],
      ),
    ).rejects.toThrow("Twin economy history is immutable");
  });

  it("tracks owner-session participant presence with server timestamps and monotonic heartbeats", async () => {
    const repository = createPostgresTwinRuntimeRepository(pool);
    const tenantId = createCanonicalId("tenant");
    const requesterUserId = createCanonicalId("user");
    const ownerUserId = createCanonicalId("user");
    const characterId = createCanonicalId("character");
    const requestId = "owner-room-presence-request";

    await repository.putOwnerAccessRequest({
      tenantId,
      request: {
        requestId,
        requesterUserId,
        ownerUserId,
        originatingCharacterId: characterId,
        modality: "text",
        durationMinutes: 15,
        priceCredits: 0,
        platformFeeCredits: 0,
        ownerEarningCredits: 0,
        chargeMode: "trial",
        trialPolicyRevision: 1,
        state: "active",
        requestedAt: "2026-10-05T12:00:00.000Z",
        acceptBy: "2026-10-05T13:00:00.000Z",
        scheduledFor: null,
        startedAt: "2026-10-05T12:10:00.000Z",
        completedAt: null,
      },
      reservationId: null,
      reservedCredits: 0,
    });

    const first = await repository.touchOwnerAccessPresence({
      tenantId,
      requestId,
      userId: requesterUserId,
      seenAt: "2026-10-05T12:10:00.000Z",
    });
    const second = await repository.touchOwnerAccessPresence({
      tenantId,
      requestId,
      userId: requesterUserId,
      seenAt: "2026-10-05T12:10:15.000Z",
    });
    await repository.touchOwnerAccessPresence({
      tenantId,
      requestId,
      userId: ownerUserId,
      seenAt: "2026-10-05T12:10:05.000Z",
    });

    expect(first.heartbeatCount).toBe(1);
    expect(second.firstSeenAt).toBe("2026-10-05T12:10:00.000Z");
    expect(second.lastSeenAt).toBe("2026-10-05T12:10:15.000Z");
    expect(second.heartbeatCount).toBe(2);

    const presence = await repository.listOwnerAccessPresence({
      tenantId,
      requestId,
    });
    expect(presence).toHaveLength(2);
    expect(
      presence.find((item) => item.userId === requesterUserId)?.heartbeatCount,
    ).toBe(2);
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
