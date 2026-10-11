import { describe, expect, it } from "vitest";
import {
  createPostgresTalkSearchRepository,
  type TalkSearchSqlPool,
} from "./postgres_repository.js";

describe("Postgres Talk search repository", () => {
  it("escapes LIKE metacharacters and keeps Talk search tenant-scoped", async () => {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const pool: TalkSearchSqlPool = {
      async query<Row>(text: string, values?: unknown[]) {
        calls.push({ text, ...(values === undefined ? {} : { values }) });
        return { rowCount: 0, rows: [] as Row[] };
      },
    };

    await createPostgresTalkSearchRepository(pool).searchTalks({
      tenantId: "tenant_a",
      query: "50%_off\\today",
      limit: 9,
    });

    const call = calls[0]!;
    expect(call.text).toContain("t.tenant_id = $1");
    expect(call.text).toContain("ESCAPE");
    expect(call.text).toContain("t.state IN ('live','reconnecting','ended')");
    expect(call.values).toEqual([
      "tenant_a",
      "%50\\%\\_off\\\\today%",
      "50%_off\\today",
      "50\\%\\_off\\\\today%",
      9,
    ]);
  });

  it("validates live People state against canonical Talk state", async () => {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const pool: TalkSearchSqlPool = {
      async query<Row>(text: string, values?: unknown[]) {
        calls.push({ text, ...(values === undefined ? {} : { values }) });
        return {
          rowCount: 1,
          rows: [{
            handle: "amina",
            display_name: "Amina",
            bio: "Host",
            avatar_url: null,
            live_talk_id: "talk_live",
          }] as unknown as Row[],
        };
      },
    };

    const people = await createPostgresTalkSearchRepository(pool).searchPeople({
      tenantId: "tenant_a",
      query: "amina",
      limit: 5,
    });

    expect(calls[0]?.text).toContain("live.state = 'live'");
    expect(calls[0]?.text).toContain("p.tenant_id = $1");
    expect(people[0]).toMatchObject({
      handle: "amina",
      isLive: true,
      liveTalkId: "talk_live",
    });
  });

  it("requires canonical discoverability for Twins and verification for Experts", async () => {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const pool: TalkSearchSqlPool = {
      async query<Row>(text: string, values?: unknown[]) {
        calls.push({ text, ...(values === undefined ? {} : { values }) });
        return { rowCount: 0, rows: [] as Row[] };
      },
    };

    await createPostgresTalkSearchRepository(pool).searchPersonas({
      tenantId: "tenant_a",
      query: "history",
      kind: "expert",
      limit: 10,
    });

    expect(calls[0]?.text).toContain(
      "(p.kind <> 'expert' OR p.is_verified = true)",
    );
    expect(calls[0]?.text).toContain("identity.twin_profiles");
    expect(calls[0]?.text).toContain("twin.discoverable = true");
    expect(calls[0]?.text).toContain(
      "(p.kind <> 'twin' OR twin.public_id IS NOT NULL)",
    );
    expect(calls[0]?.values?.[2]).toBe("expert");
  });
});
