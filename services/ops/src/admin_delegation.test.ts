import { describe, expect, it } from "vitest";
import {
  createAdminAgentDelegationService,
  readAdminAgentDelegationConfig,
} from "./admin_delegation.js";

const tenantId = "tenant_0199cabc-1234-7abc-8def-1234567890ab";
const gwaniId = "character_0199cabc-1234-7abc-8def-1234567890aa";
const jevId = "character_0199cabc-1234-7abc-8def-1234567890ac";

describe("Ops admin agent delegation", () => {
  it("parses explicit Character-scoped delegates", () => {
    const config = readAdminAgentDelegationConfig({
      MASANAWA_PLATFORM_TENANT_ID: tenantId,
      MASANAWA_OPS_AGENT_DELEGATES_JSON: JSON.stringify([
        {
          characterId: gwaniId,
          label: "Gwani",
          purpose: "Primary conversational administrator",
          autonomy: "confirm-writes",
          capabilities: ["platform.summary.read", "commerce.write"],
        },
        {
          characterId: jevId,
          label: "JEV",
          purpose: "Operational reviewer",
          autonomy: "read-autonomous",
          capabilities: ["operations.read", "audit.read"],
        },
      ]),
    })!;

    expect(config.tenantId).toBe(tenantId);
    expect(config.delegates).toHaveLength(2);
    expect(config.delegates[0]).toMatchObject({
      characterId: gwaniId,
      label: "Gwani",
      approvalRequiredForWrites: true,
    });
  });

  it("requires the signed-in operator to hold delegate-read authority", async () => {
    const config = readAdminAgentDelegationConfig({
      MASANAWA_PLATFORM_TENANT_ID: tenantId,
      MASANAWA_OPS_AGENT_DELEGATES_JSON: JSON.stringify([
        {
          characterId: gwaniId,
          label: "Gwani",
          capabilities: ["platform.summary.read"],
        },
      ]),
    })!;
    const authorizer = {
      authorize: async ({ capability }: { capability: string }) => {
        expect(capability).toBe("admin.delegates.read");
        return { tenantId };
      },
    } as never;

    const service = createAdminAgentDelegationService({ config, authorizer });
    await expect(service.list({ authorizationHeader: "Bearer token" }))
      .resolves.toHaveLength(1);
  });

  it("never permits configuration to disable write approval", () => {
    const config = readAdminAgentDelegationConfig({
      MASANAWA_PLATFORM_TENANT_ID: tenantId,
      MASANAWA_OPS_AGENT_DELEGATES_JSON: JSON.stringify([
        {
          characterId: gwaniId,
          label: "Gwani",
          autonomy: "confirm-writes",
          capabilities: ["*"],
          approvalRequiredForWrites: false,
        },
      ]),
    })!;
    expect(config.delegates[0]?.approvalRequiredForWrites).toBe(true);
  });
});
