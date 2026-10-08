import { describe, expect, it, vi } from "vitest";
import {
  createPostgresTalkProfileRepository,
  type TalkProfileSqlPool,
} from "./postgres_repository.js";

const row = {
  tenant_id: "tenant_1",
  user_id: "user_owner",
  handle: "owner",
  display_name: "New name",
  bio: "About",
  avatar_url: null,
  live_talk_id: null,
  twin_public_id: null,
  twin_display_name: null,
  talks_json: [],
  follower_count: 0,
  following_count: 0,
  is_following: false,
};

describe("public profile edits SQL ownership", () => {
  it("updates only the authenticated tenant/user row and preserves other columns", async () => {
    const calls: Array<{ text: string; values: readonly unknown[] }> = [];
    const pool = {
      async query(text: string, values: readonly unknown[] = []) {
        calls.push({ text, values });
        if (text.startsWith("UPDATE talks.public_profiles")) {
          return { rows: [{ user_id: "user_owner" }], rowCount: 1 };
        }
        return { rows: [row], rowCount: 1 };
      },
    } as unknown as TalkProfileSqlPool;
    const repo = createPostgresTalkProfileRepository(pool);
    const updated = await repo.updateOwnHuman({
      tenantId: "tenant_1",
      userId: "user_owner",
      displayName: "New name",
      bio: "About",
      removeAvatar: true,
    });
    expect(updated?.displayName).toBe("New name");
    expect(calls).toHaveLength(2);
    expect(calls[0]!.text).toMatch(
      /UPDATE talks\.public_profiles[\s\S]*WHERE tenant_id = \$1 AND user_id = \$2/u,
    );
    expect(calls[0]!.text).toContain("avatar_url = NULL");
    expect(calls[0]!.values).toEqual([
      "tenant_1", "user_owner", "New name", "About",
    ]);
    expect(calls[1]!.values).toEqual([
      "tenant_1", "user_owner", "user_owner",
    ]);
  });

  it("does not fabricate success when the owner has no public profile row", async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    const repo = createPostgresTalkProfileRepository(
      { query } as unknown as TalkProfileSqlPool,
    );
    const missing = await repo.updateOwnHuman({
      tenantId: "tenant_1", userId: "user_missing", bio: "About",
    });
    expect(missing).toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("rejects a no-op without sending any database update", async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    const repo = createPostgresTalkProfileRepository(
      { query } as unknown as TalkProfileSqlPool,
    );
    const result = await repo.updateOwnHuman({
      tenantId: "tenant_1", userId: "user_owner",
    });
    expect(result).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });
});
