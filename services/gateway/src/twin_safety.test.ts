import { describe, expect, it } from "vitest";
import {
  createTwinSafetyService,
  type TwinSafetyAuthorizer,
  type TwinSafetyRepository,
} from "./twin_safety.js";

describe("twin safety service", () => {
  it("blocks a twin through authenticated repository state", async () => {
    const authorizer: TwinSafetyAuthorizer = {
      async authorize(input) {
        expect(input.capability).toBe("twin.block");
        return { tenantId: "tenant-1", userId: "user-a" };
      },
    };
    const repository: TwinSafetyRepository = {
      async block(input) {
        expect(input.actorUserId).toBe("user-a");
        return { blocked: true };
      },
      async unblock() {
        return { blocked: false };
      },
      async report() {
        return { reportId: "report-1", status: "submitted" };
      },
    };
    const service = createTwinSafetyService({ authorizer, repository });
    expect(
      await service.block({
        authorizationHeader: "Bearer user",
        characterId: "character-12345",
      }),
    ).toEqual({ blocked: true });
  });

  it("normalizes report detail and submits without deciding guilt", async () => {
    const authorizer: TwinSafetyAuthorizer = {
      async authorize() {
        return { tenantId: "tenant-1", userId: "user-a" };
      },
    };
    let captured: string | null = null;
    const repository: TwinSafetyRepository = {
      async block() {
        return { blocked: true };
      },
      async unblock() {
        return { blocked: false };
      },
      async report(input) {
        captured = input.detail;
        return { reportId: "report-123", status: "submitted" };
      },
    };
    const service = createTwinSafetyService({ authorizer, repository });
    const result = await service.report({
      authorizationHeader: "Bearer user",
      characterId: "character-12345",
      reason: "fraud",
      detail: "  Suspicious payment request.  ",
    });
    expect(captured).toBe("Suspicious payment request.");
    expect(result.status).toBe("submitted");
  });
});
