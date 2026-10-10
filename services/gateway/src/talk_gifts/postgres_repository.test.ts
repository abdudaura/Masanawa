import { describe, expect, it } from "vitest";
import {
  createPostgresTalkGiftRepository,
  type TalkGiftSqlPool,
} from "./postgres_repository.js";

describe("Postgres Talk gift repository", () => {
  it("resolves Host by tenant + Talk and never accepts a client recipient", async () => {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const pool: TalkGiftSqlPool = {
      async query<Row>(text: string, values?: unknown[]) {
        calls.push({ text, ...(values === undefined ? {} : { values }) });
        return {
          rowCount: 1,
          rows: [{
            talk_id: "talk_1",
            title: "Talk title",
            host_user_id: "host_1",
            host_name: "Amina",
          }] as Row[],
        };
      },
    };

    const target = await createPostgresTalkGiftRepository(pool).resolveTarget({
      tenantId: "tenant_1",
      talkId: "talk_1",
    });

    expect(target).toEqual({
      talkId: "talk_1",
      talkTitle: "Talk title",
      hostUserId: "host_1",
      hostName: "Amina",
    });
    expect(calls[0]!.values).toEqual(["tenant_1", "talk_1"]);
    expect(calls[0]!.text).toContain("t.tenant_id = $1");
    expect(calls[0]!.text).toContain("t.talk_id = $2");
    expect(calls[0]!.text).toContain("t.host_user_id");
  });

  it("allows ended gifts only for finalized published replays", async () => {
    let sql = "";
    const pool: TalkGiftSqlPool = {
      async query<Row>(text: string) {
        sql = text;
        return { rowCount: 0, rows: [] as Row[] };
      },
    };

    await createPostgresTalkGiftRepository(pool).resolveTarget({
      tenantId: "tenant_1",
      talkId: "talk_1",
    });

    expect(sql).toContain("t.state IN ('live','reconnecting')");
    expect(sql).toContain("FROM talks.replay_sessions r");
    expect(sql).toContain("r.recording_state = 'finalized'");
    expect(sql).toContain("r.publication_state = 'published'");
  });
});
