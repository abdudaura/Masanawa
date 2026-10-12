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

  it("persists immutable voice settlement timing and usage for recovery", async () => {
    const repository = createPostgresTwinRuntimeRepository(pool);
    const tenantId = createCanonicalId("tenant");
    const plan = { planKey: `voice-settle:${createCanonicalId("operation")}`,
      entries: [{ role: "platform", amountCredits: 10, ledgerEntryId: createCanonicalId("ledger-entry") }],
      createdAt: "2026-10-12T10:00:30.000Z",
      voiceSettlement: { verifiedSeconds: 30, outcome: "completed" as const } };
    expect(await repository.putLedgerPlan({ tenantId, plan })).toEqual(plan);
    expect(await repository.readLedgerPlan({ tenantId, planKey: plan.planKey })).toEqual(plan);
    expect(await repository.putLedgerPlan({ tenantId, plan: { ...plan,
      createdAt: "2026-10-12T10:01:30.000Z",
      voiceSettlement: { verifiedSeconds: 90, outcome: "interrupted" } } })).toEqual(plan);
  });

  it("preserves historical owners while persisting nullable platform voice beneficiaries", async () => {
    const repository = createPostgresTwinRuntimeRepository(pool);
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const ownerUserId = createCanonicalId("user");
    const characterId = createCanonicalId("character");
    const base = {
      tenantId, userId, ownerUserId, characterId,
      quoteId: createCanonicalId("quote"), policyRevision: 1, trialPolicyRevision: 1,
      chargeMode: "paid" as const, trialDurationDays: 7, trialStartsAt: null,
      trialExpiresAt: null, estimatedSeconds: 300, estimatedPriceCredits: 50,
      spendCapCredits: 50, ownerShareBasisPoints: 8000, unitSeconds: 60,
      priceCreditsPerUnit: 10, quoteExpiresAt: "2099-10-05T16:10:00.000Z",
      createdAt: "2026-10-05T16:00:00.000Z",
    };
    await repository.putVoiceQuote(base);
    const platform = { ...base, quoteId: createCanonicalId("quote"),
      ownerUserId: null, ownerShareBasisPoints: 0 };
    expect(await repository.putVoiceQuote(platform)).toEqual(platform);
    expect(await repository.readVoiceQuote({ tenantId, quoteId: base.quoteId })).toEqual(base);
    const admission = { tenantId, userId, ownerUserId: null,
      admissionId: createCanonicalId("operation"), quoteId: platform.quoteId,
      characterId, chargeMode: "paid" as const, admittedAt: base.createdAt,
      startedAt: null, expiresAt: platform.quoteExpiresAt, spendCapCredits: 50,
      reservationLedgerEntryId: createCanonicalId("ledger-entry"), settledAt: null };
    expect(await repository.putVoiceAdmission(admission)).toEqual(admission);
    expect(await repository.readVoiceAdmission({ tenantId: createCanonicalId("tenant"),
      admissionId: admission.admissionId })).toBeNull();
    await expect(repository.putVoiceQuote({ ...platform,
      quoteId: createCanonicalId("quote"), ownerShareBasisPoints: 1 })).rejects.toThrow("zero owner share");
    await runMigrations(pool, [{ owner: "commerce", directory: fileURLToPath(
      new URL("../../../../../packages/commerce/migrations", import.meta.url)) }]);
    expect(await repository.readVoiceQuote({ tenantId, quoteId: base.quoteId })).toEqual(base);
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
        modality: "text",
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
      modality: "text" as const,
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
      state:
        | "requested"
        | "scheduled"
        | "active"
        | "expired"
        | "completed"
        | "settled"
        | "releasing"
        | "disputed";
      acceptBy?: string;
      scheduledFor?: string | null;
      startedAt?: string | null;
      completedAt?: string | null;
      disputeBy?: string | null;
      earningsReleasedAt?: string | null;
      paid?: boolean;
      reconciliationReason?: "attendance-timeout";
    }) => {
      await repository.putOwnerAccessRequest({
        tenantId,
        request: {
          requestId: input.requestId,
          requesterUserId,
          ownerUserId,
          originatingCharacterId: characterId,
          modality: "text",
          durationMinutes: 15,
          priceCredits: input.paid ? 100 : 0,
          platformFeeCredits: input.paid ? 20 : 0,
          ownerEarningCredits: input.paid ? 80 : 0,
          chargeMode: input.paid ? "paid" : "trial",
          trialPolicyRevision: 1,
          state: input.state,
          requestedAt: "2026-10-05T12:00:00.000Z",
          acceptBy: input.acceptBy ?? "2026-10-05T15:00:00.000Z",
          scheduledFor: input.scheduledFor ?? null,
          startedAt:
            input.startedAt ??
            (input.state === "active"
              ? "2026-10-05T13:50:00.000Z"
              : null),
          completedAt:
            input.completedAt ??
            (input.state === "completed"
              ? "2026-10-05T13:59:00.000Z"
              : null),
          disputeBy: input.disputeBy ?? null,
          earningsReleasedAt: input.earningsReleasedAt ?? null,
          ...(input.reconciliationReason
            ? { reconciliationReason: input.reconciliationReason }
            : {}),
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
      requestId: "owner-future-active",
      state: "active",
    });
    await put({
      requestId: "owner-due-active",
      state: "active",
      startedAt: "2026-10-05T13:20:00.000Z",
    });
    await put({
      requestId: "owner-repair-attendance-timeout",
      state: "disputed",
      reconciliationReason: "attendance-timeout",
    });
    await put({
      requestId: "owner-repair-expired",
      state: "expired",
    });
    await put({
      requestId: "owner-repair-completed",
      state: "completed",
    });
    await put({
      requestId: "owner-due-settled",
      state: "settled",
      paid: true,
      completedAt: "2026-10-05T13:00:00.000Z",
      disputeBy: "2026-10-05T13:59:00.000Z",
    });
    await put({
      requestId: "owner-future-settled",
      state: "settled",
      paid: true,
      completedAt: "2026-10-05T13:00:00.000Z",
      disputeBy: "2026-10-05T14:01:00.000Z",
    });
    await put({
      requestId: "owner-settled-needs-deadline-backfill",
      state: "settled",
      paid: true,
      completedAt: "2026-10-05T13:00:00.000Z",
    });
    await put({
      requestId: "owner-repair-releasing",
      state: "releasing",
      paid: true,
      completedAt: "2026-10-05T13:00:00.000Z",
      disputeBy: "2026-10-05T13:59:00.000Z",
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
        "owner-due-active",
        "owner-repair-attendance-timeout",
        "owner-repair-expired",
        "owner-repair-completed",
        "owner-due-settled",
        "owner-settled-needs-deadline-backfill",
        "owner-repair-releasing",
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
      expiresAt: "2026-11-04T12:10:05.000Z",
    });
    const replay = await repository.appendOwnerAccessMessage({
      tenantId,
      message,
      expiresAt: "2026-11-04T12:10:05.000Z",
    });
    expect(replay).toEqual(first);

    await expect(
      repository.appendOwnerAccessMessage({
        tenantId,
        message: { ...message, body: "Different content" },
        expiresAt: "2026-11-04T12:10:05.000Z",
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

  it("purges only expired private owner-session messages", async () => {
    const repository = createPostgresTwinRuntimeRepository(pool);
    const tenantId = createCanonicalId("tenant");
    const requesterUserId = createCanonicalId("user");
    const ownerUserId = createCanonicalId("user");
    const characterId = createCanonicalId("character");
    const requestId = "owner-room-retention-request";

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
        state: "settled",
        requestedAt: "2026-10-05T12:00:00.000Z",
        acceptBy: "2026-10-05T13:00:00.000Z",
        scheduledFor: null,
        startedAt: "2026-10-05T12:10:00.000Z",
        completedAt: "2026-10-05T12:20:00.000Z",
      },
      reservationId: null,
      reservedCredits: 0,
    });

    await repository.appendOwnerAccessMessage({
      tenantId,
      message: {
        requestId,
        messageId: "message-expired-retention",
        senderUserId: requesterUserId,
        body: "Old private message",
        sentAt: "2026-10-05T12:10:05.000Z",
      },
      expiresAt: "2026-10-06T12:10:05.000Z",
    });
    await repository.appendOwnerAccessMessage({
      tenantId,
      message: {
        requestId,
        messageId: "message-live-retention",
        senderUserId: ownerUserId,
        body: "Still retained",
        sentAt: "2026-10-05T12:10:10.000Z",
      },
      expiresAt: "2026-11-05T12:10:10.000Z",
    });

    const purged = await repository.purgeExpiredOwnerAccessMessages({
      tenantId,
      at: "2026-10-07T00:00:00.000Z",
      limit: 100,
    });
    expect(purged).toBe(1);

    const messages = await repository.listOwnerAccessMessages({
      tenantId,
      requestId,
      limit: 100,
    });
    expect(messages.map((message) => message.messageId)).toEqual([
      "message-live-retention",
    ]);
    await expect(
      repository.readOwnerAccessRequest({ tenantId, requestId }),
    ).resolves.toEqual(
      expect.objectContaining({ requestId, state: "settled" }),
    );
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

  it("persists immutable provider valuation revisions without a default mapping", async () => {
    const repository = createPostgresTwinRuntimeRepository(pool);
    const tenantId = createCanonicalId("tenant");

    await expect(repository.readProviderValuationPolicy({
      tenantId,
      valuationKey: "flutterwave:NGN:kobo",
      eventType: "external-funding",
      at: "2026-10-06T12:00:00.000Z",
    })).resolves.toBeNull();

    const saved = await repository.putProviderValuationPolicy({
      tenantId,
      policy: {
        schemaVersion: 1,
        revision: 1,
        enabled: false,
        valuationKey: "flutterwave:NGN:kobo",
        eventType: "external-funding",
        sourceUnit: "NGN_KOBO",
        sourceUnitsPerStep: 1000,
        creditUnitsPerStep: 1,
        minimumSourceUnits: 1000,
        maximumBaseCredits: 500,
        effectiveAt: "2026-10-06T12:00:00.000Z",
      },
    });
    expect(saved).toMatchObject({
      revision: 1,
      enabled: false,
      sourceUnitsPerStep: 1000,
      creditUnitsPerStep: 1,
    });

    await expect(repository.putProviderValuationPolicy({
      tenantId,
      policy: {
        ...saved,
        creditUnitsPerStep: 2,
      },
    })).rejects.toThrow("revision conflict");

    await expect(pool.query(
      `UPDATE commerce.twin_provider_valuation_policy_revisions
          SET enabled=true
        WHERE tenant_id=$1 AND valuation_key=$2 AND event_type=$3 AND revision=1`,
      [tenantId, "flutterwave:NGN:kobo", "external-funding"],
    )).rejects.toThrow("Twin economy history is immutable");
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
