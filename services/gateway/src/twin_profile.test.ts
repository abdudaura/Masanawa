import { describe, expect, it } from "vitest";
import type {
  TwinProfileAuthorizer,
  TwinProfileRecord,
  TwinProfileStore,
} from "./twin_profile.js";
import { createTwinProfileService } from "./twin_profile.js";

const tenantId = "tenant_00000000-0000-4000-8000-000000000001" as never;
const userId = "user_00000000-0000-4000-8000-000000000002" as never;
const characterId = "character_00000000-0000-4000-8000-000000000003" as never;

const base: TwinProfileRecord = {
  tenantId,
  ownerUserId: userId,
  characterId,
  publicId: "amina-bello",
  displayName: "Amina Bello",
  bio: "Teacher",
  interests: ["learning"],
  languages: ["English", "Hausa"],
  avatarUrl: null,
  discoverable: false,
  revision: 1,
  updatedAt: "2026-10-05T08:00:00.000Z" as never,
};

function harness(initial: TwinProfileRecord = base) {
  let record = initial;
  const authorizer: TwinProfileAuthorizer = {
    async authorize() {
      return { tenantId, userId };
    },
  };
  const store: TwinProfileStore = {
    async readForOwner() {
      return record;
    },
    async update(input) {
      record = {
        ...record,
        ...input.patch,
        revision: record.revision + 1,
        updatedAt: input.updatedAt,
      };
      return record;
    },
  };
  return { service: createTwinProfileService({ authorizer, store }), read: () => record };
}

describe("twin profile service", () => {
  it("returns an owner-safe view without ownerUserId", async () => {
    const { service } = harness();
    const view = await service.read({ authorizationHeader: "Bearer user" });
    expect(view?.representationLabel).toBe("AI twin");
    expect(JSON.stringify(view)).not.toContain("ownerUserId");
  });

  it("previews low-risk conversational customization without confirmation", async () => {
    const { service } = harness();
    const plan = await service.previewCustomization({
      authorizationHeader: "Bearer user",
      patch: { bio: "Teacher and storyteller" },
    });
    expect(plan.requiresConfirmation).toBe(false);
  });

  it("requires confirmation before publishing a previously private twin", async () => {
    const { service } = harness();
    const plan = await service.previewCustomization({
      authorizationHeader: "Bearer user",
      patch: { discoverable: true },
    });
    expect(plan.standingChanges).toEqual(["publish-profile"]);
    await expect(service.applyCustomization({
      authorizationHeader: "Bearer user",
      expectedRevision: 1,
      patch: { discoverable: true },
      confirmed: false,
      updatedAt: "2026-10-05T09:00:00.000Z" as never,
    })).rejects.toThrow("explicit confirmation");
  });

  it("applies a confirmed standing change with optimistic revision custody", async () => {
    const { service, read } = harness();
    const updated = await service.applyCustomization({
      authorizationHeader: "Bearer user",
      expectedRevision: 1,
      patch: { discoverable: true },
      confirmed: true,
      updatedAt: "2026-10-05T09:00:00.000Z" as never,
    });
    expect(updated.discoverable).toBe(true);
    expect(updated.revision).toBe(2);
    expect(read().publicId).toBe("amina-bello");

    await expect(service.applyCustomization({
      authorizationHeader: "Bearer user",
      expectedRevision: 1,
      patch: { bio: "stale write" },
      confirmed: false,
      updatedAt: "2026-10-05T09:01:00.000Z" as never,
    })).rejects.toThrow("stale");
  });

  it("rejects a store that returns another owner or changes stable identity", async () => {
    const authorizer: TwinProfileAuthorizer = {
      async authorize() { return { tenantId, userId }; },
    };
    const badStore: TwinProfileStore = {
      async readForOwner() {
        return { ...base, ownerUserId: "user_00000000-0000-4000-8000-000000000999" as never };
      },
      async update() { return base; },
    };
    const service = createTwinProfileService({ authorizer, store: badStore });
    await expect(service.read({ authorizationHeader: "Bearer user" }))
      .rejects.toThrow("out-of-scope");
  });
});
