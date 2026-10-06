import { describe, expect, it } from "vitest";
import type {
  TwinSafetyAuthorizer,
  TwinSafetyProfile,
  TwinSafetyStore,
} from "./twin_safety_controls.js";
import { createTwinSafetyService } from "./twin_safety_controls.js";

const tenantId = "tenant_00000000-0000-4000-8000-000000000001" as never;
const userId = "user_00000000-0000-4000-8000-000000000002" as never;
const ownerUserId = "user_00000000-0000-4000-8000-000000000003" as never;
const characterId = "character_00000000-0000-4000-8000-000000000004" as never;

const profile: TwinSafetyProfile = {
  tenantId,
  characterId,
  ownerUserId,
  discoverable: true,
};

function harness() {
  let blocked = false;
  const authorizer: TwinSafetyAuthorizer = {
    async authorize() {
      return { tenantId, userId };
    },
  };
  const store: TwinSafetyStore = {
    async readProfile() {
      return profile;
    },
    async readBlock() {
      return blocked
        ? {
            tenantId,
            viewerUserId: userId,
            characterId,
            blocked: true,
            revision: 1,
            updatedAt: "2026-10-06T10:00:00.000Z" as never,
          }
        : null;
    },
    async setBlock(command) {
      blocked = command.blocked;
      return {
        ...command,
        revision: 1,
        updatedAt: "2026-10-06T10:00:00.000Z" as never,
      };
    },
    async createReport(command) {
      return {
        tenantId: command.tenantId,
        reporterUserId: command.reporterUserId,
        characterId: command.characterId,
        requestId: command.requestId,
        reportId: "report_00000001",
        reason: command.reason,
        state: "received",
      };
    },
  };
  return createTwinSafetyService({ authorizer, store });
}

describe("Twin safety Gateway service", () => {
  it("makes a block immediately deny discovery and interaction", async () => {
    const service = harness();
    await service.setBlocked({
      authorizationHeader: "Bearer test",
      characterId,
      requestId: "req:block:0001",
      blocked: true,
    });
    await expect(service.readAccess({
      authorizationHeader: "Bearer test",
      characterId,
    })).resolves.toEqual({
      discoverable: false,
      interactable: false,
      reason: "viewer-blocked",
    });
  });

  it("returns a bounded report receipt tied to the admitted request", async () => {
    const service = harness();
    await expect(service.report({
      authorizationHeader: "Bearer test",
      characterId,
      requestId: "req:report:0001",
      reason: "impersonation",
      details: "Pretending to be the owner",
    })).resolves.toMatchObject({
      requestId: "req:report:0001",
      characterId,
      reason: "impersonation",
      state: "received",
    });
  });

  it("fails closed when a store returns a forged block receipt", async () => {
    const authorizer: TwinSafetyAuthorizer = {
      async authorize() {
        return { tenantId, userId };
      },
    };
    const store: TwinSafetyStore = {
      async readProfile() {
        return profile;
      },
      async readBlock() {
        return null;
      },
      async setBlock(command) {
        return {
          ...command,
          requestId: "req:block:forged",
          revision: 1,
          updatedAt: "2026-10-06T10:00:00.000Z" as never,
        };
      },
      async createReport(command) {
        return {
          tenantId: command.tenantId,
          reporterUserId: command.reporterUserId,
          characterId: command.characterId,
          requestId: command.requestId,
          reportId: "report_00000002",
          reason: command.reason,
          state: "received",
        };
      },
    };
    const service = createTwinSafetyService({ authorizer, store });
    await expect(service.setBlocked({
      authorizationHeader: "Bearer test",
      characterId,
      requestId: "req:block:0002",
      blocked: true,
    })).rejects.toThrow("does not match");
  });
});
