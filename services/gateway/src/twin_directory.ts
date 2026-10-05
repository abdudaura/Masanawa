import type { CharacterId, TenantId, UserId } from "@masanawa/contracts";

export interface TwinDirectoryAuthority {
  readonly tenantId: TenantId;
  readonly userId: UserId;
}

export interface TwinDirectoryAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
    readonly capability: "twin.directory.read";
  }): Promise<TwinDirectoryAuthority>;
}

export interface PublicTwinDirectoryRecord {
  readonly tenantId: TenantId;
  readonly characterId: CharacterId;
  readonly publicId: string;
  readonly displayName: string;
  readonly headline: string;
  readonly avatarUrl?: string | null;
  readonly discoverable: boolean;
}

export interface PublicTwinDirectorySource {
  search(input: {
    readonly tenantId: TenantId;
    readonly query: string;
    readonly limit: number;
  }): Promise<readonly PublicTwinDirectoryRecord[]>;
  findByPublicId(input: {
    readonly tenantId: TenantId;
    readonly publicId: string;
  }): Promise<PublicTwinDirectoryRecord | null>;
}

export interface PublicTwinDirectoryItem {
  readonly characterId: string;
  readonly publicId: string;
  readonly displayName: string;
  readonly headline: string;
  readonly avatarUrl: string | null;
  readonly representationLabel: "AI twin";
  readonly ownerPresence: "not-present";
  readonly textChatMode: "free";
}

export interface TwinDirectoryService {
  search(input: {
    readonly authorizationHeader: string | undefined;
    readonly query?: string;
    readonly limit?: number;
  }): Promise<readonly PublicTwinDirectoryItem[]>;
  resolve(input: {
    readonly authorizationHeader: string | undefined;
    readonly publicId: string;
  }): Promise<PublicTwinDirectoryItem | null>;
}

function cleanQuery(value: string | undefined): string {
  const query = (value ?? "").trim();
  if (query.length > 80) throw new RangeError("Twin search query is too long");
  return query;
}

function boundedLimit(value: number | undefined): number {
  if (value === undefined) return 30;
  if (!Number.isSafeInteger(value) || value < 1 || value > 50) {
    throw new RangeError("Twin directory limit must be between 1 and 50");
  }
  return value;
}

function cleanPublicId(value: string): string {
  const id = value.trim();
  if (!/^[a-z0-9][a-z0-9_-]{2,63}$/i.test(id)) {
    throw new TypeError("Invalid public twin id");
  }
  return id;
}

function project(
  authority: TwinDirectoryAuthority,
  record: PublicTwinDirectoryRecord,
): PublicTwinDirectoryItem {
  if (record.tenantId !== authority.tenantId || !record.discoverable) {
    throw new Error("Twin directory source returned an unauthorized record");
  }
  if (!record.publicId.trim() || !record.displayName.trim()) {
    throw new Error("Twin directory source returned an invalid public projection");
  }
  return Object.freeze({
    characterId: record.characterId,
    publicId: record.publicId.trim(),
    displayName: record.displayName.trim(),
    headline: record.headline.trim(),
    avatarUrl: record.avatarUrl?.trim() || null,
    representationLabel: "AI twin",
    ownerPresence: "not-present",
    textChatMode: "free",
  });
}

export function createTwinDirectoryService(input: {
  readonly authorizer: TwinDirectoryAuthorizer;
  readonly source: PublicTwinDirectorySource;
  readonly visibility?: {
    canDiscover(input: {
      readonly tenantId: TenantId;
      readonly userId: UserId;
      readonly characterId: CharacterId;
    }): Promise<boolean>;
  };
}): TwinDirectoryService {
  return Object.freeze<TwinDirectoryService>({
    async search(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "twin.directory.read",
      });
      const records = await input.source.search({
        tenantId: authority.tenantId,
        query: cleanQuery(request.query),
        limit: boundedLimit(request.limit),
      });
      const visible = input.visibility
        ? (await Promise.all(
            records.map(async (record) => ({
              record,
              allowed: await input.visibility!.canDiscover({
                tenantId: authority.tenantId,
                userId: authority.userId,
                characterId: record.characterId,
              }),
            })),
          ))
            .filter((entry) => entry.allowed)
            .map((entry) => entry.record)
        : records;
      return Object.freeze(visible.map((record) => project(authority, record)));
    },
    async resolve(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "twin.directory.read",
      });
      const record = await input.source.findByPublicId({
        tenantId: authority.tenantId,
        publicId: cleanPublicId(request.publicId),
      });
      if (!record) return null;
      if (
        input.visibility &&
        !(await input.visibility.canDiscover({
          tenantId: authority.tenantId,
          userId: authority.userId,
          characterId: record.characterId,
        }))
      ) {
        return null;
      }
      return project(authority, record);
    },
  });
}
