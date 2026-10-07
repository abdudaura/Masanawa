import { describe, expect, it } from "vitest";
import {
  createTwinDirectoryService,
  type PublicTwinDirectoryRecord,
  type PublicTwinDirectorySource,
  type TwinDirectoryAuthorizer,
} from "./twin_directory.js";

const tenantId = "tenant_00000000-0000-4000-8000-000000000001" as never;
const userId = "user_00000000-0000-4000-8000-000000000002" as never;
const characterId = "character_00000000-0000-4000-8000-000000000003" as never;

function record(overrides: Partial<PublicTwinDirectoryRecord> = {}): PublicTwinDirectoryRecord {
  return {
    tenantId,
    characterId,
    publicId: "amina-bello",
    displayName: "Amina Bello",
    headline: "Ask my AI twin about what I know and do.",
    discoverable: true,
    ...overrides,
  };
}

function service(records: readonly PublicTwinDirectoryRecord[]) {
  const authorizer: TwinDirectoryAuthorizer = {
    async authorize(input) {
      expect(input.capability).toBe("twin.directory.read");
      return { tenantId, userId };
    },
  };
  const source: PublicTwinDirectorySource = {
    async search() { return records; },
    async findByPublicId(input) {
      return records.find((item) => item.publicId === input.publicId) ?? null;
    },
  };
  return createTwinDirectoryService({ authorizer, source });
}

describe("public twin directory", () => {
  it("projects only explicit public fields and labels AI/free text truth", async () => {
    const items = await service([record()]).search({
      authorizationHeader: "Bearer user",
      query: "amina",
    });
    expect(items).toEqual([{
      characterId,
      publicId: "amina-bello",
      displayName: "Amina Bello",
      headline: "Ask my AI twin about what I know and do.",
      avatarUrl: null,
      representationLabel: "AI twin",
      ownerPresence: "not-present",
      textChatMode: "free",
    }]);
    expect(JSON.stringify(items)).not.toContain("memory");
    expect(JSON.stringify(items)).not.toContain("ownerUserId");
    expect(JSON.stringify(items)).not.toContain("voice");
    expect(JSON.stringify(items)).not.toContain("price");
  });

  it("rejects non-discoverable or cross-tenant records from the source", async () => {
    await expect(service([record({ discoverable: false })]).search({
      authorizationHeader: "Bearer user",
    })).rejects.toThrow("unauthorized");

    await expect(service([record({
      tenantId: "tenant_00000000-0000-4000-8000-000000000999" as never,
    })]).search({ authorizationHeader: "Bearer user" })).rejects.toThrow("unauthorized");
  });

  it("resolves the same stable public id projection used by share/deep links", async () => {
    const found = await service([record()]).resolve({
      authorizationHeader: "Bearer user",
      publicId: "amina-bello",
    });
    expect(found?.publicId).toBe("amina-bello");
    expect(found?.textChatMode).toBe("free");
  });



  it("filters blocked Twins from search and stable-id resolution", async () => {
    const authorizer: TwinDirectoryAuthorizer = {
      async authorize() { return { tenantId, userId }; },
    };
    const source: PublicTwinDirectorySource = {
      async search() { return [record()]; },
      async findByPublicId() { return record(); },
    };
    const filtered = createTwinDirectoryService({
      authorizer,
      source,
      visibility: {
        async canDiscover(input) {
          expect(input.userId).toBe(userId);
          return false;
        },
      },
    });

    await expect(filtered.search({
      authorizationHeader: "Bearer user",
    })).resolves.toEqual([]);
    await expect(filtered.resolve({
      authorizationHeader: "Bearer user",
      publicId: "amina-bello",
    })).resolves.toBeNull();
  });

  it("bounds search input before querying the source", async () => {
    await expect(service([]).search({
      authorizationHeader: "Bearer user",
      query: "x".repeat(81),
    })).rejects.toThrow("too long");
    await expect(service([]).search({
      authorizationHeader: "Bearer user",
      limit: 51,
    })).rejects.toThrow("between 1 and 50");
  });
});
