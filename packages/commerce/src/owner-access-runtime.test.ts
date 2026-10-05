import { describe, expect, it } from "vitest";
import {
  createOwnerAccessRuntime,
  type OwnerAccessRequestRepository,
  type OwnerAccessReservationPort,
} from "./owner-access-runtime.js";
import type { OwnerAccessQuote, OwnerAccessRequest } from "./owner-access.js";

function memoryRepository(): {
  repo: OwnerAccessRequestRepository;
  read(): any;
} {
  let value: any = null;
  return {
    repo: {
      async create(input) {
        value = Object.freeze({ ...input });
        return value;
      },
      async get() {
        return value;
      },
      async update(input) {
        value = Object.freeze({ ...input });
        return value;
      },
    },
    read() {
      return value;
    },
  };
}

const paidQuote: OwnerAccessQuote = {
  requestId: "owner-request-paid",
  ownerUserId: "user-owner",
  originatingCharacterId: "character-1",
  modality: "voice",
  durationMinutes: 20,
  priceCredits: 1000,
  platformFeeCredits: 100,
  ownerEarningCredits: 900,
  chargeMode: "paid",
  trialDurationDays: 7,
  policyRevision: 1,
  trialPolicyRevision: 1,
  quoteExpiresAt: "2026-10-05T11:00:00Z",
};

describe("owner access runtime", () => {
  it("reserves paid funds when the request is created", async () => {
    const memory = memoryRepository();
    const calls: string[] = [];
    const reservations: OwnerAccessReservationPort = {
      async reserve(input) {
        calls.push(`reserve:${input.amountCredits}`);
        return { reservationId: "reservation-1", reservedCredits: input.amountCredits };
      },
      async release() {
        throw new Error("not used");
      },
      async settle() {
        throw new Error("not used");
      },
    };
    const runtime = createOwnerAccessRuntime({
      repository: memory.repo,
      reservations,
      acceptWithinMinutes: 60,
      now: () => new Date("2026-10-05T10:00:00Z"),
    });

    const created = await runtime.create({
      requesterUserId: "user-requester",
      quote: paidQuote,
    });

    expect(calls).toEqual(["reserve:1000"]);
    expect(created.reservedCredits).toBe(1000);
    expect(created.acceptBy).toBe("2026-10-05T11:00:00.000Z");
  });

  it("does not reserve money for trial-covered owner access", async () => {
    const memory = memoryRepository();
    let reserved = false;
    const reservations: OwnerAccessReservationPort = {
      async reserve() {
        reserved = true;
        throw new Error("must not reserve");
      },
      async release() {},
      async settle() {},
    };
    const runtime = createOwnerAccessRuntime({
      repository: memory.repo,
      reservations,
      acceptWithinMinutes: 60,
      now: () => new Date("2026-10-05T10:00:00Z"),
    });
    await runtime.create({
      requesterUserId: "user-requester",
      quote: {
        ...paidQuote,
        requestId: "owner-request-trial",
        chargeMode: "trial",
        priceCredits: 0,
        platformFeeCredits: 0,
        ownerEarningCredits: 0,
      },
    });
    expect(reserved).toBe(false);
  });

  it("refunds the exact reservation when the owner declines", async () => {
    const memory = memoryRepository();
    let refund = 0;
    const reservations: OwnerAccessReservationPort = {
      async reserve(input) {
        return { reservationId: "reservation-1", reservedCredits: input.amountCredits };
      },
      async release(input) {
        refund = input.refundCredits;
      },
      async settle() {},
    };
    const runtime = createOwnerAccessRuntime({
      repository: memory.repo,
      reservations,
      acceptWithinMinutes: 60,
      now: () => new Date("2026-10-05T10:00:00Z"),
    });
    await runtime.create({ requesterUserId: "user-requester", quote: paidQuote });
    const result = await runtime.transition({
      requestId: paidQuote.requestId,
      next: "declined",
    });
    expect(result.settlement.disposition).toBe("refund");
    expect(refund).toBe(1000);
  });

  it("settles only after verified completion", async () => {
    const memory = memoryRepository();
    let ownerPaid = 0;
    let platformPaid = 0;
    const reservations: OwnerAccessReservationPort = {
      async reserve(input) {
        return { reservationId: "reservation-1", reservedCredits: input.amountCredits };
      },
      async release() {},
      async settle(input) {
        ownerPaid = input.ownerEarningCredits;
        platformPaid = input.platformRevenueCredits;
      },
    };
    let clock = new Date("2026-10-05T10:00:00Z");
    const runtime = createOwnerAccessRuntime({
      repository: memory.repo,
      reservations,
      acceptWithinMinutes: 60,
      now: () => clock,
    });
    await runtime.create({ requesterUserId: "user-requester", quote: paidQuote });
    await runtime.transition({ requestId: paidQuote.requestId, next: "accepted" });
    await runtime.transition({
      requestId: paidQuote.requestId,
      next: "scheduled",
      scheduledFor: "2026-10-06T17:00:00Z",
    });
    clock = new Date("2026-10-06T17:00:00Z");
    await runtime.transition({ requestId: paidQuote.requestId, next: "active" });
    const result = await runtime.transition({
      requestId: paidQuote.requestId,
      next: "completed",
      attendanceVerified: true,
      completionVerified: true,
    });
    expect(result.settlement.disposition).toBe("settle");
    expect(ownerPaid).toBe(900);
    expect(platformPaid).toBe(100);
  });
});
