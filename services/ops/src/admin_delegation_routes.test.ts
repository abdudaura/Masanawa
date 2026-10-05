import { afterEach, describe, expect, it } from "vitest";
import type { AdminAgentDelegationService } from "./admin_delegation.js";
import { createOpsApp } from "./app.js";

const apps: Array<ReturnType<typeof createOpsApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("Ops admin agent delegation routes", () => {
  it("forwards the operator bearer session to the delegation service", async () => {
    const calls: unknown[] = [];
    const service = {
      async list(input: unknown) {
        calls.push(input);
        return [{
          characterId: "character_00000000-0000-4000-8000-000000000001",
          label: "Gwani",
          purpose: "Primary conversational administrator",
          autonomy: "confirm-writes",
          capabilities: ["platform.summary.read"],
          enabled: true,
          approvalRequiredForWrites: true,
        }];
      },
    } as AdminAgentDelegationService;
    const app = createOpsApp({ adminAgentDelegation: service });
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/delegates",
      headers: { authorization: "Bearer operator-session" },
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual([{
      authorizationHeader: "Bearer operator-session",
    }]);
    expect(response.json()[0]).toMatchObject({
      label: "Gwani",
      approvalRequiredForWrites: true,
    });
  });
});
