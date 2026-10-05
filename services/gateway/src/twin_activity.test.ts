import { describe, expect, it } from "vitest";
import type { PersonalCloneProvisioningRepository } from "@masanawa/identity";
import {
  createTwinActivityService,
  type TwinActivityAuthorizer,
  type TwinActivitySource,
} from "./twin_activity.js";

const tenantId = "tenant_00000000-0000-4000-8000-000000000001" as never;
const userId = "user_00000000-0000-4000-8000-000000000002" as never;
const characterId = "character_00000000-0000-4000-8000-000000000003" as never;

function dependencies(records: Awaited<ReturnType<TwinActivitySource["listForTwin"]>>) {
  const authorizer: TwinActivityAuthorizer = {
    async authorize(input) {
      expect(input.capability).toBe("creator.activity.read");
      return { tenantId, userId };
    },
  };
  const personalClones = {
    async readPersonalClone() {
      return { characterId, characterVersionId: "character-version_00000000-0000-4000-8000-000000000004" as never, relationshipId: "relationship_00000000-0000-4000-8000-000000000005" as never };
    },
  } as unknown as PersonalCloneProvisioningRepository;
  const source: TwinActivitySource = { async listForTwin() { return records; } };
  return { authorizer, personalClones, source };
}

describe("twin activity projection", () => {
  it("returns privacy-safe summaries without transcript content", async () => {
    const service = createTwinActivityService(dependencies([
      { eventId: "evt-1", tenantId, characterId, kind: "visit", status: "observed", occurredAt: "2026-10-05T08:00:00Z" },
      { eventId: "evt-2", tenantId, characterId, kind: "conversation", status: "completed", occurredAt: "2026-10-05T08:01:00Z" },
      { eventId: "evt-3", tenantId, characterId, kind: "owner-request", status: "pending", occurredAt: "2026-10-05T08:02:00Z", amountCredits: 1500 },
      { eventId: "evt-4", tenantId, characterId, kind: "earning", status: "completed", occurredAt: "2026-10-05T08:03:00Z", amountCredits: 250 },
    ]));

    const view = await service.read({ authorizationHeader: "Bearer user" });

    expect(view.summary).toEqual({
      visitors: 1,
      conversations: 1,
      earningsCredits: 250,
      pendingOwnerRequests: 1,
    });
    expect(view.items[0]?.eventId).toBe("evt-4");
    expect(JSON.stringify(view)).not.toContain("transcript");
    expect(JSON.stringify(view)).not.toContain("messageText");
  });

  it("rejects out-of-scope source records instead of leaking another twin", async () => {
    const service = createTwinActivityService(dependencies([
      {
        eventId: "evt-bad",
        tenantId,
        characterId: "character_00000000-0000-4000-8000-000000000999",
        kind: "visit",
        status: "observed",
        occurredAt: "2026-10-05T08:00:00Z",
      },
    ]));
    await expect(service.read({ authorizationHeader: "Bearer user" })).rejects.toThrow(
      "out-of-scope",
    );
  });
});
