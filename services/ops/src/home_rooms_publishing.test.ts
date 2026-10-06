import {
  createCanonicalId,
  type TenantId,
} from "@masanawa/contracts";
import { describe, expect, it } from "vitest";

import {
  createHomeRoomsPublishingService,
  type AssistantHomePublishingRepository,
  type HomeRoomPublishingRepository,
  type HomeRoomsPublishingAuthorizer,
  type HomeRoomsPublishingCapability,
  type NewsPublishingRepository,
} from "./home_rooms_publishing.js";

const tenantId = createCanonicalId("tenant");

function harness() {
  const authorized: HomeRoomsPublishingCapability[] = [];
  const newsCalls: unknown[] = [];
  const homeCalls: unknown[] = [];
  const assistantCalls: unknown[] = [];

  const authorizer: HomeRoomsPublishingAuthorizer = {
    async authorize(input) {
      authorized.push(input.capability);
      return { tenantId };
    },
  };

  const news: NewsPublishingRepository = {
    async list() {
      return [
        {
          categoryId: "world",
          label: "World",
          visible: true,
          sortOrder: 1,
          pinnedItemId: null,
          revision: 4,
        },
      ];
    },
    async setVisibility(input) {
      newsCalls.push(input);
      return {
        categoryId: input.categoryId,
        label: "World",
        visible: input.visible,
        sortOrder: 1,
        pinnedItemId: null,
        revision: input.expectedRevision + 1,
      };
    },
    async pinItem(input) {
      newsCalls.push(input);
      return {
        categoryId: input.categoryId,
        label: "World",
        visible: true,
        sortOrder: 1,
        pinnedItemId: input.itemId,
        revision: input.expectedRevision + 1,
      };
    },
  };

  const home: HomeRoomPublishingRepository = {
    async list() {
      return [
        {
          roomKey: "study-center",
          label: "Study Center",
          visible: true,
          sortOrder: 2,
          revision: 7,
        },
      ];
    },
    async setVisibility(input) {
      homeCalls.push(input);
      return {
        roomKey: input.roomKey,
        label: "Study Center",
        visible: input.visible,
        sortOrder: 2,
        revision: input.expectedRevision + 1,
      };
    },
    async setSortOrder(input) {
      homeCalls.push(input);
      return {
        roomKey: input.roomKey,
        label: "Study Center",
        visible: true,
        sortOrder: input.sortOrder,
        revision: input.expectedRevision + 1,
      };
    },
  };

  const assistants: AssistantHomePublishingRepository = {
    async list() {
      return [
        {
          characterId: "character-gwana",
          displayName: "Gwana",
          position: "left",
          visible: true,
          revision: 11,
        },
      ];
    },
    async putPresentation(input) {
      assistantCalls.push(input);
      return {
        characterId: input.characterId,
        displayName: input.displayName,
        position: input.position,
        visible: input.visible,
        revision: input.expectedRevision + 1,
      };
    },
  };

  return {
    service: createHomeRoomsPublishingService({
      authorizer,
      news,
      home,
      assistants,
    }),
    authorized,
    newsCalls,
    homeCalls,
    assistantCalls,
  };
}

describe("Home/Rooms Ops publishing service", () => {
  it("reads separate domain revisions under one Tenant authority", async () => {
    const { service, authorized } = harness();
    const result = await service.read({
      authorizationHeader: "Bearer operator",
    });

    expect(result.newsCategories[0]?.revision).toBe(4);
    expect(result.homeRooms[0]?.revision).toBe(7);
    expect(result.assistants[0]?.revision).toBe(11);
    expect(authorized).toEqual([
      "home-rooms.news.read",
      "home-rooms.home.read",
      "home-rooms.assistants.read",
    ]);
  });

  it("uses the News category revision only for News mutation", async () => {
    const { service, authorized, newsCalls } = harness();
    const result = await service.setNewsCategoryVisibility({
      authorizationHeader: "Bearer operator",
      categoryId: "world",
      visible: false,
      expectedRevision: 4,
    });

    expect(result.revision).toBe(5);
    expect(authorized).toEqual(["home-rooms.news.write"]);
    expect(newsCalls).toEqual([
      {
        tenantId,
        categoryId: "world",
        visible: false,
        expectedRevision: 4,
      },
    ]);
  });

  it("pins and clears News items with target-specific revision", async () => {
    const { service } = harness();

    await expect(
      service.pinNewsItem({
        authorizationHeader: "Bearer operator",
        categoryId: "world",
        itemId: "news-123",
        expectedRevision: 8,
      }),
    ).resolves.toMatchObject({
      categoryId: "world",
      pinnedItemId: "news-123",
      revision: 9,
    });

    await expect(
      service.pinNewsItem({
        authorizationHeader: "Bearer operator",
        categoryId: "world",
        itemId: null,
        expectedRevision: 9,
      }),
    ).resolves.toMatchObject({
      pinnedItemId: null,
      revision: 10,
    });
  });

  it("uses independent Home Room revision for visibility and ordering", async () => {
    const { service, homeCalls } = harness();

    await service.setHomeRoomVisibility({
      authorizationHeader: "Bearer operator",
      roomKey: "study-center",
      visible: false,
      expectedRevision: 7,
    });
    await service.reorderHomeRoom({
      authorizationHeader: "Bearer operator",
      roomKey: "study-center",
      sortOrder: 5,
      expectedRevision: 8,
    });

    expect(homeCalls).toEqual([
      {
        tenantId,
        roomKey: "study-center",
        visible: false,
        expectedRevision: 7,
      },
      {
        tenantId,
        roomKey: "study-center",
        sortOrder: 5,
        expectedRevision: 8,
      },
    ]);
  });

  it("uses the assistant Character presentation revision independently", async () => {
    const { service, assistantCalls } = harness();

    const result = await service.updateAssistantPresentation({
      authorizationHeader: "Bearer operator",
      characterId: "character-gwana",
      displayName: "Gwana",
      position: "left",
      visible: true,
      expectedRevision: 11,
    });

    expect(result.revision).toBe(12);
    expect(assistantCalls).toEqual([
      {
        tenantId,
        characterId: "character-gwana",
        displayName: "Gwana",
        position: "left",
        visible: true,
        expectedRevision: 11,
      },
    ]);
  });

  it("rejects malformed revisions and inputs before repository writes", async () => {
    const { service, newsCalls, homeCalls, assistantCalls } = harness();

    await expect(
      service.setNewsCategoryVisibility({
        authorizationHeader: "Bearer operator",
        categoryId: " ",
        visible: true,
        expectedRevision: 4,
      }),
    ).rejects.toThrow("categoryId is invalid");

    await expect(
      service.reorderHomeRoom({
        authorizationHeader: "Bearer operator",
        roomKey: "study-center",
        sortOrder: -1,
        expectedRevision: 7,
      }),
    ).rejects.toThrow("sortOrder is invalid");

    await expect(
      service.updateAssistantPresentation({
        authorizationHeader: "Bearer operator",
        characterId: "character-gwana",
        displayName: " ",
        position: "left",
        visible: true,
        expectedRevision: 11,
      }),
    ).rejects.toThrow("displayName is invalid");

    expect(newsCalls).toHaveLength(0);
    expect(homeCalls).toHaveLength(0);
    expect(assistantCalls).toHaveLength(0);
  });

  it("fails closed when repository returns another target or stale revision", async () => {
    const { service } = harness();
    const badNews: NewsPublishingRepository = {
      async list() {
        return [];
      },
      async setVisibility(input) {
        return {
          categoryId: "another",
          label: "Another",
          visible: input.visible,
          sortOrder: 1,
          pinnedItemId: null,
          revision: input.expectedRevision + 1,
        };
      },
      async pinItem(input) {
        return {
          categoryId: input.categoryId,
          label: "World",
          visible: true,
          sortOrder: 1,
          pinnedItemId: input.itemId,
          revision: input.expectedRevision,
        };
      },
    };

    const isolated = createHomeRoomsPublishingService({
      authorizer: {
        async authorize() {
          return { tenantId };
        },
      },
      news: badNews,
      home: {
        async list() {
          return [];
        },
        async setVisibility() {
          throw new Error("unused");
        },
        async setSortOrder() {
          throw new Error("unused");
        },
      },
      assistants: {
        async list() {
          return [];
        },
        async putPresentation() {
          throw new Error("unused");
        },
      },
    });

    await expect(
      isolated.setNewsCategoryVisibility({
        authorizationHeader: "Bearer operator",
        categoryId: "world",
        visible: false,
        expectedRevision: 4,
      }),
    ).rejects.toThrow(
      "News publishing repository returned another category",
    );

    await expect(
      isolated.pinNewsItem({
        authorizationHeader: "Bearer operator",
        categoryId: "world",
        itemId: "news-1",
        expectedRevision: 4,
      }),
    ).rejects.toThrow(
      "Publishing repository must return a newer target revision",
    );

    // Keep the main harness referenced so TypeScript does not elide it as unused.
    expect(service).toBeDefined();
  });

  it("fails closed if read capabilities resolve different Tenants", async () => {
    let count = 0;
    const foreignTenant = createCanonicalId("tenant");
    const authorizer: HomeRoomsPublishingAuthorizer = {
      async authorize() {
        count += 1;
        return {
          tenantId: (count === 2 ? foreignTenant : tenantId) as TenantId,
        };
      },
    };
    const emptyNews: NewsPublishingRepository = {
      async list() {
        return [];
      },
      async setVisibility() {
        throw new Error("unused");
      },
      async pinItem() {
        throw new Error("unused");
      },
    };
    const emptyHome: HomeRoomPublishingRepository = {
      async list() {
        return [];
      },
      async setVisibility() {
        throw new Error("unused");
      },
      async setSortOrder() {
        throw new Error("unused");
      },
    };
    const emptyAssistants: AssistantHomePublishingRepository = {
      async list() {
        return [];
      },
      async putPresentation() {
        throw new Error("unused");
      },
    };

    const isolated = createHomeRoomsPublishingService({
      authorizer,
      news: emptyNews,
      home: emptyHome,
      assistants: emptyAssistants,
    });

    await expect(
      isolated.read({ authorizationHeader: "Bearer operator" }),
    ).rejects.toThrow(
      "Home/Rooms publishing read authority must resolve one Tenant",
    );
  });
});
