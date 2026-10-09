import { describe, expect, it, vi } from "vitest";
import { createTalkProfileService } from "./service.js";
import type { TalkProfileRepository } from "./model.js";

function subject() {
  const createOwnHuman = vi.fn(async (input: {
    handle: string; displayName: string; bio: string;
  }) => ({ ...input }));
  const updateOwnHuman = vi.fn(async (input: {
    displayName?: string; bio?: string; removeAvatar?: boolean;
  }) => ({ ...input }));
  const service = createTalkProfileService({
    repository: { createOwnHuman, updateOwnHuman } as unknown as TalkProfileRepository,
    authorizer: {
      async authorize() {
        return { tenantId: "tenant_1", userId: "owner_1" } as never;
      },
    },
  });
  return { service, createOwnHuman, updateOwnHuman };
}

describe("F13 public profile API guards before database writes", () => {
  it.each(["\u0000", "\u202e", "\u2067", "\ud800"])(
    "rejects unsafe display-name token %s in creation", async (token) => {
      const { service, createOwnHuman } = subject();
      await expect(service.createSelf({
        authorizationHeader: "Bearer session",
        handle: "owner",
        displayName: `Owner${token} One`,
        bio: "Hello",
      })).rejects.toMatchObject({
        code: "profiles.display_name_invalid", statusCode: 400,
      });
      expect(createOwnHuman).not.toHaveBeenCalled();
    },
  );

  it.each(["\u0000", "\u202e", "\u2069", "\udfff"])(
    "rejects unsafe bio token %s in an update before mutation", async (token) => {
      const { service, updateOwnHuman } = subject();
      await expect(service.updateSelf({
        authorizationHeader: "Bearer session",
        bio: `Hello${token}`,
      })).rejects.toMatchObject({
        code: "profiles.bio_invalid", statusCode: 400,
      });
      expect(updateOwnHuman).not.toHaveBeenCalled();
    },
  );

  it("normalizes valid multilingual creation without changing authenticated identity", async () => {
    const { service, createOwnHuman } = subject();
    await service.createSelf({
      authorizationHeader: "Bearer session",
      handle: "OWNER",
      displayName: "  Sannu   ناصر  ",
      bio: "Hausa\r\nعربي",
    });
    expect(createOwnHuman).toHaveBeenCalledWith({
      tenantId: "tenant_1",
      userId: "owner_1",
      handle: "owner",
      displayName: "Sannu ناصر",
      bio: "Hausa\nعربي",
    });
  });

  it("allows an empty bio and preserves an unchanged name during update", async () => {
    const { service, updateOwnHuman } = subject();
    await service.updateSelf({
      authorizationHeader: "Bearer session",
      bio: "  ",
    });
    expect(updateOwnHuman).toHaveBeenCalledWith({
      tenantId: "tenant_1",
      userId: "owner_1",
      bio: "",
    });
  });

  it("refuses a no-op and retains the existing profile update error code", async () => {
    const { service, updateOwnHuman } = subject();
    await expect(service.updateSelf({
      authorizationHeader: "Bearer session",
    })).rejects.toMatchObject({
      code: "profiles.update_empty", statusCode: 400,
    });
    expect(updateOwnHuman).not.toHaveBeenCalled();
  });
});
