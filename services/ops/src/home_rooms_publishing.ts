import type { TenantId } from "@masanawa/contracts";

export type HomeRoomsPublishingCapability =
  | "home-rooms.news.read"
  | "home-rooms.news.write"
  | "home-rooms.home.read"
  | "home-rooms.home.write"
  | "home-rooms.assistants.read"
  | "home-rooms.assistants.write";

export interface HomeRoomsPublishingAuthority {
  readonly tenantId: TenantId;
}

export interface HomeRoomsPublishingAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
    readonly capability: HomeRoomsPublishingCapability;
  }): Promise<HomeRoomsPublishingAuthority>;
}

export interface NewsCategoryPublishingState {
  readonly categoryId: string;
  readonly label: string;
  readonly visible: boolean;
  readonly sortOrder: number;
  readonly pinnedItemId: string | null;
  readonly revision: number;
}

export interface HomeRoomPublishingState {
  readonly roomKey: string;
  readonly label: string;
  readonly visible: boolean;
  readonly sortOrder: number;
  readonly revision: number;
}

export interface AssistantHomePublishingState {
  readonly characterId: string;
  readonly displayName: string;
  readonly position: "left" | "right";
  readonly visible: boolean;
  readonly revision: number;
}

export interface NewsPublishingRepository {
  list(input: {
    readonly tenantId: TenantId;
  }): Promise<readonly NewsCategoryPublishingState[]>;

  setVisibility(input: {
    readonly tenantId: TenantId;
    readonly categoryId: string;
    readonly visible: boolean;
    readonly expectedRevision: number;
  }): Promise<NewsCategoryPublishingState>;

  pinItem(input: {
    readonly tenantId: TenantId;
    readonly categoryId: string;
    readonly itemId: string | null;
    readonly expectedRevision: number;
  }): Promise<NewsCategoryPublishingState>;
}

export interface HomeRoomPublishingRepository {
  list(input: {
    readonly tenantId: TenantId;
  }): Promise<readonly HomeRoomPublishingState[]>;

  setVisibility(input: {
    readonly tenantId: TenantId;
    readonly roomKey: string;
    readonly visible: boolean;
    readonly expectedRevision: number;
  }): Promise<HomeRoomPublishingState>;

  setSortOrder(input: {
    readonly tenantId: TenantId;
    readonly roomKey: string;
    readonly sortOrder: number;
    readonly expectedRevision: number;
  }): Promise<HomeRoomPublishingState>;
}

export interface AssistantHomePublishingRepository {
  list(input: {
    readonly tenantId: TenantId;
  }): Promise<readonly AssistantHomePublishingState[]>;

  putPresentation(input: {
    readonly tenantId: TenantId;
    readonly characterId: string;
    readonly displayName: string;
    readonly position: "left" | "right";
    readonly visible: boolean;
    readonly expectedRevision: number;
  }): Promise<AssistantHomePublishingState>;
}

export interface HomeRoomsPublishingSnapshot {
  readonly newsCategories: readonly NewsCategoryPublishingState[];
  readonly homeRooms: readonly HomeRoomPublishingState[];
  readonly assistants: readonly AssistantHomePublishingState[];
}

export interface HomeRoomsPublishingService {
  read(input: {
    readonly authorizationHeader: string | undefined;
  }): Promise<HomeRoomsPublishingSnapshot>;

  setNewsCategoryVisibility(input: {
    readonly authorizationHeader: string | undefined;
    readonly categoryId: string;
    readonly visible: boolean;
    readonly expectedRevision: number;
  }): Promise<NewsCategoryPublishingState>;

  pinNewsItem(input: {
    readonly authorizationHeader: string | undefined;
    readonly categoryId: string;
    readonly itemId: string | null;
    readonly expectedRevision: number;
  }): Promise<NewsCategoryPublishingState>;

  setHomeRoomVisibility(input: {
    readonly authorizationHeader: string | undefined;
    readonly roomKey: string;
    readonly visible: boolean;
    readonly expectedRevision: number;
  }): Promise<HomeRoomPublishingState>;

  reorderHomeRoom(input: {
    readonly authorizationHeader: string | undefined;
    readonly roomKey: string;
    readonly sortOrder: number;
    readonly expectedRevision: number;
  }): Promise<HomeRoomPublishingState>;

  updateAssistantPresentation(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: string;
    readonly displayName: string;
    readonly position: "left" | "right";
    readonly visible: boolean;
    readonly expectedRevision: number;
  }): Promise<AssistantHomePublishingState>;
}

function nonEmpty(value: string, name: string, maxLength = 512): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > maxLength) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function revision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError("expectedRevision must be a positive safe integer");
  }
  return value;
}

function sortOrder(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100_000) {
    throw new TypeError("sortOrder is invalid");
  }
  return value;
}

function assertReturnedRevision(
  expectedRevision: number,
  actualRevision: number,
): void {
  if (
    !Number.isSafeInteger(actualRevision) ||
    actualRevision <= expectedRevision
  ) {
    throw new TypeError(
      "Publishing repository must return a newer target revision",
    );
  }
}

function assertNewsResult(
  input: {
    readonly categoryId: string;
    readonly expectedRevision: number;
  },
  result: NewsCategoryPublishingState,
): NewsCategoryPublishingState {
  if (result.categoryId !== input.categoryId) {
    throw new TypeError("News publishing repository returned another category");
  }
  assertReturnedRevision(input.expectedRevision, result.revision);
  return Object.freeze({ ...result });
}

function assertHomeResult(
  input: {
    readonly roomKey: string;
    readonly expectedRevision: number;
  },
  result: HomeRoomPublishingState,
): HomeRoomPublishingState {
  if (result.roomKey !== input.roomKey) {
    throw new TypeError("Home publishing repository returned another Room");
  }
  assertReturnedRevision(input.expectedRevision, result.revision);
  return Object.freeze({ ...result });
}

function assertAssistantResult(
  input: {
    readonly characterId: string;
    readonly expectedRevision: number;
  },
  result: AssistantHomePublishingState,
): AssistantHomePublishingState {
  if (result.characterId !== input.characterId) {
    throw new TypeError(
      "Assistant publishing repository returned another Character",
    );
  }
  assertReturnedRevision(input.expectedRevision, result.revision);
  return Object.freeze({ ...result });
}

export function createHomeRoomsPublishingService(input: {
  readonly authorizer: HomeRoomsPublishingAuthorizer;
  readonly news: NewsPublishingRepository;
  readonly home: HomeRoomPublishingRepository;
  readonly assistants: AssistantHomePublishingRepository;
}): HomeRoomsPublishingService {
  return Object.freeze({
    async read(request) {
      const [newsAuthority, homeAuthority, assistantAuthority] =
        await Promise.all([
          input.authorizer.authorize({
            authorizationHeader: request.authorizationHeader,
            capability: "home-rooms.news.read",
          }),
          input.authorizer.authorize({
            authorizationHeader: request.authorizationHeader,
            capability: "home-rooms.home.read",
          }),
          input.authorizer.authorize({
            authorizationHeader: request.authorizationHeader,
            capability: "home-rooms.assistants.read",
          }),
        ]);

      if (
        newsAuthority.tenantId !== homeAuthority.tenantId ||
        newsAuthority.tenantId !== assistantAuthority.tenantId
      ) {
        throw new TypeError(
          "Home/Rooms publishing read authority must resolve one Tenant",
        );
      }

      const tenantId = newsAuthority.tenantId;
      const [newsCategories, homeRooms, assistants] = await Promise.all([
        input.news.list({ tenantId }),
        input.home.list({ tenantId }),
        input.assistants.list({ tenantId }),
      ]);

      return Object.freeze({
        newsCategories: Object.freeze([...newsCategories]),
        homeRooms: Object.freeze([...homeRooms]),
        assistants: Object.freeze([...assistants]),
      });
    },

    async setNewsCategoryVisibility(request) {
      const categoryId = nonEmpty(request.categoryId, "categoryId");
      const expectedRevision = revision(request.expectedRevision);
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "home-rooms.news.write",
      });
      const result = await input.news.setVisibility({
        tenantId: authority.tenantId,
        categoryId,
        visible: request.visible,
        expectedRevision,
      });
      return assertNewsResult({ categoryId, expectedRevision }, result);
    },

    async pinNewsItem(request) {
      const categoryId = nonEmpty(request.categoryId, "categoryId");
      const expectedRevision = revision(request.expectedRevision);
      const itemId =
        request.itemId === null
          ? null
          : nonEmpty(request.itemId, "itemId", 1024);
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "home-rooms.news.write",
      });
      const result = await input.news.pinItem({
        tenantId: authority.tenantId,
        categoryId,
        itemId,
        expectedRevision,
      });
      return assertNewsResult({ categoryId, expectedRevision }, result);
    },

    async setHomeRoomVisibility(request) {
      const roomKey = nonEmpty(request.roomKey, "roomKey");
      const expectedRevision = revision(request.expectedRevision);
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "home-rooms.home.write",
      });
      const result = await input.home.setVisibility({
        tenantId: authority.tenantId,
        roomKey,
        visible: request.visible,
        expectedRevision,
      });
      return assertHomeResult({ roomKey, expectedRevision }, result);
    },

    async reorderHomeRoom(request) {
      const roomKey = nonEmpty(request.roomKey, "roomKey");
      const expectedRevision = revision(request.expectedRevision);
      const order = sortOrder(request.sortOrder);
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "home-rooms.home.write",
      });
      const result = await input.home.setSortOrder({
        tenantId: authority.tenantId,
        roomKey,
        sortOrder: order,
        expectedRevision,
      });
      return assertHomeResult({ roomKey, expectedRevision }, result);
    },

    async updateAssistantPresentation(request) {
      const characterId = nonEmpty(request.characterId, "characterId");
      const displayName = nonEmpty(
        request.displayName,
        "displayName",
        200,
      );
      const expectedRevision = revision(request.expectedRevision);
      if (request.position !== "left" && request.position !== "right") {
        throw new TypeError("Assistant Home position is invalid");
      }
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "home-rooms.assistants.write",
      });
      const result = await input.assistants.putPresentation({
        tenantId: authority.tenantId,
        characterId,
        displayName,
        position: request.position,
        visible: request.visible,
        expectedRevision,
      });
      return assertAssistantResult(
        { characterId, expectedRevision },
        result,
      );
    },
  });
}
