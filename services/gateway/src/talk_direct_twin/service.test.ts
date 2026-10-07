import { describe, expect, it, vi } from "vitest";
import {
  createDirectTwinService,
  readDirectTwinInstructionForWorker,
  type DirectTwinInstructionRecord,
  type DirectTwinRepository,
  type DirectTwinSeatRecord,
} from "./service.js";

const identity = {
  tenantId: "tenant-1",
  userId: "owner-1",
  profile: { name: "Owner" },
} as never;

const twinSeat: DirectTwinSeatRecord = {
  tenantId: "tenant-1",
  talkId: "talk-1",
  seatId: "seat-1",
  personaId: "twin-1",
  kind: "twin",
  ownerUserId: "owner-1",
  admitted: true,
  removed: false,
};

function setup(input: {
  seat?: DirectTwinSeatRecord | null;
  instruction?: DirectTwinInstructionRecord | null;
} = {}) {
  let current = input.instruction ?? null;
  const repository: DirectTwinRepository = {
    readSeat: vi.fn(async () => input.seat === undefined ? twinSeat : input.seat),
    listOwnedTwinSeats: vi.fn(async () => {
      const seat = input.seat === undefined ? twinSeat : input.seat;
      return seat ? [seat] : [];
    }),
    readInstruction: vi.fn(async () => current),
    writeInstruction: vi.fn(async (request) => {
      const revision = (current?.revision ?? 0) + 1;
      current = {
        tenantId: request.tenantId,
        talkId: request.talkId,
        seatId: request.seatId,
        personaId: request.personaId,
        ownerUserId: request.ownerUserId,
        revision,
        instruction: request.instruction,
        updatedAt: request.updatedAt,
        expiresAt: request.expiresAt,
      };
      return current;
    }),
  };
  const service = createDirectTwinService({
    repository,
    authorizer: { authorize: async () => identity },
    now: () => new Date("2026-10-07T10:00:00Z"),
    ttlMs: 60_000,
  });
  return { repository, service, current: () => current };
}

describe("Direct Twin private control", () => {
  it("lists only the current owner's active Twin Seats for mobile control", async () => {
    const { service, repository } = setup();
    await expect(service.mine({
      authorizationHeader: "Bearer x",
      talkId: "talk-1",
    })).resolves.toEqual([{ seatId: "seat-1", personaId: "twin-1" }]);
    expect(repository.listOwnedTwinSeats).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      talkId: "talk-1",
      ownerUserId: "owner-1",
    });
  });

  it("lets only the canonical Twin owner set a short-lived private instruction", async () => {
    const { service, repository } = setup();
    const result = await service.set({
      authorizationHeader: "Bearer x",
      talkId: "talk-1",
      seatId: "seat-1",
      expectedRevision: null,
      instruction: "  Focus on the economic impact.  ",
    });

    expect(result).toEqual({
      revision: 1,
      instruction: "Focus on the economic impact.",
      expiresAt: "2026-10-07T10:01:00.000Z",
    });
    expect(repository.writeInstruction).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerUserId: "owner-1",
        personaId: "twin-1",
        instruction: "Focus on the economic impact.",
      }),
    );
  });

  it("rejects Expert Seats, inactive Twin Seats and non-owners", async () => {
    await expect(setup({
      seat: { ...twinSeat, kind: "expert", ownerUserId: null },
    }).service.read({
      authorizationHeader: "Bearer x",
      talkId: "talk-1",
      seatId: "seat-1",
    })).rejects.toThrow("Only Twin Seats");

    await expect(setup({
      seat: { ...twinSeat, admitted: false },
    }).service.read({
      authorizationHeader: "Bearer x",
      talkId: "talk-1",
      seatId: "seat-1",
    })).rejects.toThrow("not active");

    await expect(setup({
      seat: { ...twinSeat, ownerUserId: "someone-else" },
    }).service.read({
      authorizationHeader: "Bearer x",
      talkId: "talk-1",
      seatId: "seat-1",
    })).rejects.toThrow("Only the Twin owner");
  });

  it("returns expired instructions as empty instead of leaking stale steering", async () => {
    const { service } = setup({
      instruction: {
        tenantId: "tenant-1",
        talkId: "talk-1",
        seatId: "seat-1",
        personaId: "twin-1",
        ownerUserId: "owner-1",
        revision: 4,
        instruction: "Old instruction",
        updatedAt: "2026-10-07T09:58:00Z",
        expiresAt: "2026-10-07T09:59:00Z",
      },
    });

    await expect(service.read({
      authorizationHeader: "Bearer x",
      talkId: "talk-1",
      seatId: "seat-1",
    })).resolves.toEqual({
      revision: 4,
      instruction: null,
      expiresAt: null,
    });
  });

  it("clears an instruction with expected revision custody", async () => {
    const { service, current } = setup({
      instruction: {
        tenantId: "tenant-1",
        talkId: "talk-1",
        seatId: "seat-1",
        personaId: "twin-1",
        ownerUserId: "owner-1",
        revision: 2,
        instruction: "Be concise",
        updatedAt: "2026-10-07T09:59:00Z",
        expiresAt: "2026-10-07T10:01:00Z",
      },
    });

    const result = await service.clear({
      authorizationHeader: "Bearer x",
      talkId: "talk-1",
      seatId: "seat-1",
      expectedRevision: 2,
    });

    expect(result).toEqual({ revision: 3, instruction: null, expiresAt: null });
    expect(current()?.instruction).toBeNull();
  });

  it("worker-side read fails closed on owner/persona mismatch and expiry", async () => {
    const record: DirectTwinInstructionRecord = {
      tenantId: "tenant-1",
      talkId: "talk-1",
      seatId: "seat-1",
      personaId: "twin-1",
      ownerUserId: "owner-1",
      revision: 1,
      instruction: "Use my preferred framing",
      updatedAt: "2026-10-07T10:00:00Z",
      expiresAt: "2026-10-07T10:01:00Z",
    };
    const repository = setup({ instruction: record }).repository;

    await expect(readDirectTwinInstructionForWorker({
      repository,
      tenantId: "tenant-1",
      talkId: "talk-1",
      seatId: "seat-1",
      ownerUserId: "owner-1",
      personaId: "twin-1",
      now: () => new Date("2026-10-07T10:00:30Z"),
    })).resolves.toBe("Use my preferred framing");

    await expect(readDirectTwinInstructionForWorker({
      repository,
      tenantId: "tenant-1",
      talkId: "talk-1",
      seatId: "seat-1",
      ownerUserId: "wrong-owner",
      personaId: "twin-1",
      now: () => new Date("2026-10-07T10:00:30Z"),
    })).resolves.toBeNull();

    await expect(readDirectTwinInstructionForWorker({
      repository,
      tenantId: "tenant-1",
      talkId: "talk-1",
      seatId: "seat-1",
      ownerUserId: "owner-1",
      personaId: "twin-1",
      now: () => new Date("2026-10-07T10:02:00Z"),
    })).resolves.toBeNull();
  });

  it("never exposes Direct Twin instructions through a public projection", async () => {
    const { service } = setup();
    const set = await service.set({
      authorizationHeader: "Bearer x",
      talkId: "talk-1",
      seatId: "seat-1",
      expectedRevision: null,
      instruction: "Private strategy",
    });

    expect(Object.keys(set).sort()).toEqual(["expiresAt", "instruction", "revision"]);
    expect(set).not.toHaveProperty("talkTranscript");
    expect(set).not.toHaveProperty("comment");
    expect(set).not.toHaveProperty("activity");
  });
});
