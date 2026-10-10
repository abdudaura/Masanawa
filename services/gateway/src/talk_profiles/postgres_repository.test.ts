import { describe, expect, it } from "vitest";
import {
  createPostgresTalkProfileRepository,
  type TalkProfileSqlPool,
} from "./postgres_repository.js";

function humanRow(overrides: Record<string, unknown> = {}) {
  return {
    tenant_id: "tenant_a",
    user_id: "user_target",
    handle: "amina",
    display_name: "Amina",
    bio: "Host",
    avatar_url: null,
    live_talk_id: "talk_live",
    twin_public_id: "persona_twin",
    twin_display_name: "Amina Twin",
    talks_json: [],
    follower_count: 4,
    following_count: 2,
    is_following: false,
    ...overrides,
  };
}

describe("Postgres Talk profile repository", () => {
  it("reads a human profile with viewer-scoped follow state and server counts", async () => {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const pool: TalkProfileSqlPool = {
      async query<Row>(text: string, values?: unknown[]) {
        calls.push({ text, ...(values === undefined ? {} : { values }) });
        return { rowCount: 1, rows: [humanRow()] as unknown as Row[] };
      },
    };

    const profile = await createPostgresTalkProfileRepository(pool).readHuman({
      tenantId: "tenant_a",
      viewerUserId: "user_viewer",
      handle: "amina",
    });

    expect(profile).toMatchObject({
      handle: "amina",
      followerCount: 4,
      followingCount: 2,
      isFollowing: false,
      isLive: true,
      liveTalkId: "talk_live",
    });
    expect(calls[0]?.values).toEqual(["tenant_a", "user_viewer", "amina"]);
    expect(calls[0]?.text).toContain("follower_user_id = $2");
  });

  it("reads a human profile by canonical user id with viewer follow state", async () => {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const pool: TalkProfileSqlPool = {
      async query<Row>(text: string, values?: unknown[]) {
        calls.push({ text, ...(values === undefined ? {} : { values }) });
        return { rowCount: 1, rows: [humanRow()] as unknown as Row[] };
      },
    };

    const profile =
        await createPostgresTalkProfileRepository(pool).readHumanByUserId({
      tenantId: "tenant_a",
      viewerUserId: "user_viewer",
      userId: "user_target",
    });

    expect(profile).toMatchObject({ handle: "amina", isFollowing: false });
    expect(calls[0]?.values).toEqual([
      "tenant_a",
      "user_viewer",
      "user_target",
    ]);
    expect(calls[0]?.text).toContain("p.user_id = $3");
  });

  it("uses insert-on-conflict for idempotent follow and scoped delete for unfollow", async () => {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    let reads = 0;
    const pool: TalkProfileSqlPool = {
      async query<Row>(text: string, values?: unknown[]) {
        calls.push({ text, ...(values === undefined ? {} : { values }) });
        if (text.includes("SELECT p.user_id FROM talks.public_profiles p")) {
          return { rowCount: 1, rows: [{ user_id: "user_target" }] as unknown as Row[] };
        }
        if (text.includes("SELECT p.tenant_id")) {
          reads += 1;
          return {
            rowCount: 1,
            rows: [humanRow({ is_following: true, follower_count: 5 })] as unknown as Row[],
          };
        }
        return { rowCount: 1, rows: [] as unknown as Row[] };
      },
    };
    const repository = createPostgresTalkProfileRepository(pool);

    const followed = await repository.setFollowing({
      tenantId: "tenant_a",
      viewerUserId: "user_viewer",
      handle: "amina",
      following: true,
      changedAt: "2026-10-07T09:00:00.000Z",
    });
    expect(followed).toMatchObject({ isFollowing: true, followerCount: 5 });
    expect(calls[0]?.text).toContain("se.visibility IN ('restricted','blocked')");
    expect(calls.some((call) => call.text.includes("ON CONFLICT"))).toBe(true);

    await repository.setFollowing({
      tenantId: "tenant_a",
      viewerUserId: "user_viewer",
      handle: "amina",
      following: false,
      changedAt: "2026-10-07T09:01:00.000Z",
    });
    expect(calls.some((call) => call.text.includes("DELETE FROM talks.follows"))).toBe(true);
    expect(reads).toBe(2);
  });

  it("uses the same idempotent follow table for canonical user-id targets", async () => {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const pool: TalkProfileSqlPool = {
      async query<Row>(text: string, values?: unknown[]) {
        calls.push({ text, ...(values === undefined ? {} : { values }) });
        if (text.includes("SELECT p.user_id, p.handle")) {
          return {
            rowCount: 1,
            rows: [{ user_id: "user_target", handle: "amina" }] as unknown as Row[],
          };
        }
        if (text.includes("SELECT p.tenant_id")) {
          return {
            rowCount: 1,
            rows: [humanRow({ is_following: true, follower_count: 5 })] as unknown as Row[],
          };
        }
        return { rowCount: 1, rows: [] as unknown as Row[] };
      },
    };
    const repository = createPostgresTalkProfileRepository(pool);

    const followed = await repository.setFollowingByUserId({
      tenantId: "tenant_a",
      viewerUserId: "user_viewer",
      userId: "user_target",
      following: true,
      changedAt: "2026-10-07T09:00:00.000Z",
    });

    expect(followed).toMatchObject({ isFollowing: true, followerCount: 5 });
    expect(calls.some((call) => call.text.includes("ON CONFLICT"))).toBe(true);
    expect(
      calls.some((call) =>
        call.values?.includes("user_target") &&
        call.text.includes("talks.public_profiles"),
      ),
    ).toBe(true);
  });

  it("rejects following yourself before mutating the relationship table", async () => {
    const calls: string[] = [];
    const pool: TalkProfileSqlPool = {
      async query<Row>(text: string) {
        calls.push(text);
        if (text.includes("SELECT p.user_id FROM talks.public_profiles p")) {
          return { rowCount: 1, rows: [{ user_id: "user_viewer" }] as unknown as Row[] };
        }
        return { rowCount: 0, rows: [] as unknown as Row[] };
      },
    };

    await expect(
      createPostgresTalkProfileRepository(pool).setFollowing({
        tenantId: "tenant_a",
        viewerUserId: "user_viewer",
        handle: "viewer",
        following: true,
        changedAt: "2026-10-07T09:00:00.000Z",
      }),
    ).rejects.toThrow("profiles.cannot_follow_self");

    expect(calls[0]).toContain("se.visibility IN ('restricted','blocked')");
    expect(calls.some((text) => text.includes("INSERT INTO talks.follows"))).toBe(false);
  });
});
