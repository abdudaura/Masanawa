import { describe, expect, it } from "vitest";
import {
  createOwnerAccessRuntime,
  type OwnerAccessRequestRepository,
  type OwnerAccessReservationPort,
  type OwnerAccessTrialUsagePort,
} from "../../packages/commerce/src/owner-access-runtime.js";
import type {
  OwnerAccessRequest,
} from "../../packages/commerce/src/owner-access.js";

type StoredRequest = OwnerAccessRequest & {
  readonly reservationId: string | null;
  readonly reservedCredits: number;
};

function activeRequest(input: {
  chargeMode: "paid" | "trial";
  requestId?: string;
}): StoredRequest {
  const paid = input.chargeMode === "paid";
  return {
    requestId: input.requestId ?? "owner-request-1",
    requesterUserId: "requester-user",
    ownerUserId: "owner-user",
    originatingCharacterId: "personal-twin",
    modality: "voice",
    durationMinutes: 30,
    priceCredits: paid ? 1_000 : 0,
    platformFeeCredits: paid ? 200 : 0,
    ownerEarningCredits: paid ? 800 : 0,
    chargeMode: input.chargeMode,
    trialPolicyRevision: 7,
    state: "active",
    requestedAt: "2026-10-06T10:00:00.000Z",
    acceptBy: "2026-10-06T11:00:00.000Z",
    scheduledFor: "2026-10-06T10:15:00.000Z",
    startedAt: "2026-10-06T10:15:00.000Z",
    completedAt: null,
    reservationId: paid ? "reservation-1" : null,
    reservedCredits: paid ? 1_000 : 0,
  };
}

function crashOnceRepository(initial: StoredRequest) {
  let current = initial;
  let updateAttempts = 0;
  const repository: OwnerAccessRequestRepository = {
    async create() {
      throw new Error("not used");
    },
    async get({ requestId }) {
      return requestId === current.requestId ? current : null;
    },
    async update(next) {
      updateAttempts += 1;
      if (updateAttempts === 1) {
        throw new Error("simulated persistence crash after economic effect");
      }
      current = next;
      return current;
    },
  };
  return {
    repository,
    current: () => current,
    updateAttempts: () => updateAttempts,
  };
}

function replaySafeReservations() {
  const attempts: string[] = [];
  const effects = new Set<string>();
  const port: OwnerAccessReservationPort = {
    async reserve() {
      throw new Error("not used");
    },
    async release() {
      throw new Error("not used");
    },
    async settle(input) {
      const identity = [
        input.requestId,
        input.reservationId,
        input.customerChargeCredits,
        input.ownerUserId,
        input.ownerEarningCredits,
        input.platformRevenueCredits,
      ].join(":");
      attempts.push(identity);
      effects.add(identity);
    },
  };
  return {
    port,
    attempts,
    appliedEffects: () => effects.size,
  };
}

function replaySafeTrialUsage() {
  const attempts: string[] = [];
  const effects = new Set<string>();
  const port: OwnerAccessTrialUsagePort = {
    async consume(input) {
      const identity = [
        input.requestId,
        input.requesterUserId,
        input.feature,
        input.policyRevision,
        input.units,
      ].join(":");
      attempts.push(identity);
      effects.add(identity);
    },
  };
  return {
    port,
    attempts,
    appliedEffects: () => effects.size,
  };
}

describe("TWIN-106 owner-access retry recovery acceptance", () => {
  it("recovers a paid completion after state-write crash without applying money twice", async () => {
    const store = crashOnceRepository(activeRequest({ chargeMode: "paid" }));
    const reservations = replaySafeReservations();
    const trialUsage = replaySafeTrialUsage();
    const runtime = createOwnerAccessRuntime({
      repository: store.repository,
      reservations: reservations.port,
      trialUsage: trialUsage.port,
      acceptWithinMinutes: 60,
      now: () => new Date("2026-10-06T10:30:00.000Z"),
    });

    await expect(
      runtime.transition({
        requestId: "owner-request-1",
        next: "completed",
        attendanceVerified: true,
        completionVerified: true,
      }),
    ).rejects.toThrow("simulated persistence crash");

    expect(store.current().state).toBe("active");
    expect(reservations.attempts).toHaveLength(1);
    expect(reservations.appliedEffects()).toBe(1);

    const recovered = await runtime.transition({
      requestId: "owner-request-1",
      next: "completed",
      attendanceVerified: true,
      completionVerified: true,
    });

    expect(store.updateAttempts()).toBe(2);
    expect(reservations.attempts).toHaveLength(2);
    expect(reservations.attempts[1]).toBe(reservations.attempts[0]);
    expect(reservations.appliedEffects()).toBe(1);
    expect(trialUsage.attempts).toHaveLength(0);
    expect(recovered.request.state).toBe("completed");
    expect(store.current().state).toBe("completed");
    expect(recovered.settlement).toMatchObject({
      disposition: "settle",
      customerChargeCredits: 1_000,
      ownerEarningCredits: 800,
      platformRevenueCredits: 200,
    });
  });

  it("recovers a trial completion after state-write crash without consuming a second session", async () => {
    const store = crashOnceRepository(activeRequest({ chargeMode: "trial" }));
    const reservations = replaySafeReservations();
    const trialUsage = replaySafeTrialUsage();
    const runtime = createOwnerAccessRuntime({
      repository: store.repository,
      reservations: reservations.port,
      trialUsage: trialUsage.port,
      acceptWithinMinutes: 60,
      now: () => new Date("2026-10-06T10:30:00.000Z"),
    });

    const command = {
      requestId: "owner-request-1",
      next: "completed" as const,
      attendanceVerified: true,
      completionVerified: true,
    };

    await expect(runtime.transition(command)).rejects.toThrow(
      "simulated persistence crash",
    );

    expect(store.current().state).toBe("active");
    expect(trialUsage.attempts).toHaveLength(1);
    expect(trialUsage.appliedEffects()).toBe(1);

    const recovered = await runtime.transition(command);

    expect(trialUsage.attempts).toHaveLength(2);
    expect(trialUsage.attempts[1]).toBe(trialUsage.attempts[0]);
    expect(trialUsage.appliedEffects()).toBe(1);
    expect(reservations.attempts).toHaveLength(0);
    expect(recovered.request.state).toBe("completed");
    expect(store.current().state).toBe("completed");
    expect(recovered.settlement).toMatchObject({
      disposition: "settle",
      customerChargeCredits: 0,
      ownerEarningCredits: 0,
      platformRevenueCredits: 0,
      trialUnitsConsumed: 1,
    });
  });
});
