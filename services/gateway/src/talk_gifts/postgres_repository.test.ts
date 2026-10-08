import { describe, expect, it } from "vitest";
import {
  createPostgresTalkGiftRepository,
  type TalkGiftSqlPool,
} from "./postgres_repository.js";

describe("Postgres Talk gift repository", () => {
  it("resolves Host by tenant + Talk and never accepts a client recipient", async () => {
    const calls: Array<{ text: string; values?: unknown[] | undefined }> = [];
    const pool: TalkGiftSqlPool = {
      async query<Row>(text: string, values?: unknown[] | undefined) {
        calls.push({ text, values });
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
      senderUserId: "listener_1",
    });

    expect(target).toEqual({
      talkId: "talk_1",
      talkTitle: "Talk title",
      hostUserId: "host_1",
      hostName: "Amina",
    });
    expect(calls[0]!.values).toEqual(["tenant_1", "talk_1", "listener_1"]);
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
      senderUserId: "listener_1",
    });

    expect(sql).toContain("t.state IN ('live','reconnecting')");
    expect(sql).toContain("FROM talks.replay_sessions r");
    expect(sql).toContain("r.recording_state = 'finalized'");
    expect(sql).toContain("r.publication_state = 'published'");
  });

  it("disallows gifting hidden Talks, blocked replays and safety-restricted Host profiles", async () => {
    const calls: Array<{ text: string; values?: unknown[] | undefined }> = [];
    const pool: TalkGiftSqlPool = {
      async query<Row>(text: string, values?: unknown[] | undefined) {
        calls.push({ text, values });
        return { rowCount: 0, rows: [] as Row[] };
      },
    };
    const target = await createPostgresTalkGiftRepository(pool).resolveTarget({
      tenantId: "tenant_1",
      talkId: "talk_1",
      senderUserId: "listener_1",
    });
    expect(target).toBeNull();
    const query = calls[0]!;
    expect(query.text).toContain("se.target_kind = 'talk'");
    expect(query.text).toContain("se.target_id = t.talk_id");
    expect(query.text).toContain("se.target_kind = 'replay'");
    expect(query.text).toContain("se.target_id = r.recording_id");
    expect(query.text).toContain("se.target_kind = 'profile'");
    expect(query.text).toContain("hp.user_id = t.host_user_id");
    expect(query.text).toContain("se.visibility IN ('restricted','blocked')");
    expect(query.values).toEqual(["tenant_1", "talk_1", "listener_1"]);
  });

  it("checks both directions of Host-viewer blocks before showing a catalog or sending Credits", async () => {
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
      senderUserId: "listener_1",
    });
    expect(sql).toContain("sp.tenant_id = t.tenant_id");
    expect(sql).toContain("sp.blocked = TRUE");
    expect(sql).toContain("sp.viewer_user_id = $3 AND sp.subject_user_id = t.host_user_id");
    expect(sql).toContain("sp.viewer_user_id = t.host_user_id AND sp.subject_user_id = $3");
    expect(sql).toContain("FROM talks.safety_preferences sp");
  });
});

