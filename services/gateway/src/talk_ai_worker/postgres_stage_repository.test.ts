import { describe, expect, it, vi } from "vitest";
import { projectTalkAiStageContext } from "./event_context.js";
import {
  createPostgresTalkAiStageEventRepository,
  type TalkAiStageSqlPool,
} from "./postgres_stage_repository.js";

function fixture(available = true) {
  const query = vi.fn(async (sql: string, args?: unknown[]) => {
    if (sql.includes("FROM talks.talks ")) {
      return { rows: available ? [{ topic: "Climate policy", host_name: "Host" }] : [] };
    }
    if (sql.includes("FROM talks.talk_seats ")) return { rows: [
      { participant_id: "seat-host", kind: "human", display_name: "Host",
        is_host: true, admitted_at: "2026-10-08T04:59:00Z" },
    ] };
    if (sql.includes("FROM talks.participation ") && sql.includes("reaction IS NOT NULL")) {
      return { rows: [{ reaction: "👏", total: 13, latest: "2026-10-08T04:59:10Z" }] };
    }
    if (sql.includes("FROM talks.participation ") && sql.includes("hand_status IN")) {
      return { rows: [{ hand_status: "raised", total: 2, latest: "2026-10-08T04:59:20Z" }] };
    }
    if (sql.includes("FROM talks.questions ")) return { rows: [{
      question_id: "answered-1", author_name: "Mariam",
      body: "How can we verify this?", resolved_at: "2026-10-08T04:59:30Z",
    }] };
    if (sql.includes("FROM talks.polls ")) return { rows: [{
      poll_id: "poll-1", question: "Which alternative?", status: "open",
      event_at: "2026-10-08T04:59:40Z",
    }] };
    throw new Error("Unexpected query: " + sql + " " + JSON.stringify(args));
  });
  const pool = { query } as unknown as TalkAiStageSqlPool;
  return { repository: createPostgresTalkAiStageEventRepository(pool), query };
}

describe("canonical PostgreSQL Talk stage context source", () => {
  it("reads scoped public aggregates without fetching unmoderated comments or financial activity", async () => {
    const { repository, query } = fixture();
    const before = "2026-10-08T05:00:00Z";
    const stage = await repository.readAuthorizedStage({
      tenantId: "tenant-1", talkId: "talk-1", before,
    });
    expect(stage?.hostName).toBe("Host");
    expect(stage?.participants).toEqual([
      { displayName: "Host", kind: "human", isHost: true },
    ]);
    const context = projectTalkAiStageContext({
      tenantId: "tenant-1", talkId: "talk-1", before, stage,
    });
    expect(context?.events.map((event) => event.kind)).toEqual([
      "seat", "reaction", "hand", "question", "poll",
    ]);
    expect(context?.events.find((e) => e.kind === "reaction")?.summary)
      .toBe("👏 reactions: 13");
    expect(context?.events.find((e) => e.kind === "question")?.summary)
      .toContain("How can we verify this?");
    expect(context?.contentTrust).toBe("public-untrusted-data");

    expect(query).toHaveBeenCalledTimes(6);
    for (const [sql, params] of query.mock.calls) {
      expect(sql).toContain("tenant_id=$1 AND talk_id=$2");
      expect(params?.slice(0, 2)).toEqual(["tenant-1", "talk-1"]);
      expect(sql).not.toContain("FROM talks.comments");
      expect(sql).not.toContain("FROM talks.activity");
      expect(sql).not.toContain("wallet");
      expect(sql).not.toContain("private");
    }
    const allSql = query.mock.calls.map(([sql]) => sql).join("\n");
    expect(allSql).toContain("status='answered'");
    expect(allSql).toContain("GROUP BY reaction");
    expect(allSql).toContain("GROUP BY hand_status");
    expect(allSql).toContain("LIMIT 16");
    expect(allSql).toContain("LIMIT 6");
  });

  it("does not query audience data for missing or non-live Talks", async () => {
    const { repository, query } = fixture(false);
    await expect(repository.readAuthorizedStage({
      tenantId: "tenant-1", talkId: "talk-not-live", before: "2026-10-08T05:00:00Z",
    })).resolves.toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[0]).toContain("state IN ('live','reconnecting')");
  });

  it("validates identifiers and timestamps before querying", async () => {
    const { repository, query } = fixture();
    await expect(repository.readAuthorizedStage({
      tenantId: " ", talkId: "talk-1", before: "2026-10-08T05:00:00Z",
    })).rejects.toThrow("Invalid stage context request");
    await expect(repository.readAuthorizedStage({
      tenantId: "tenant-1", talkId: "talk-1", before: "never",
    })).rejects.toThrow("Invalid stage context request");
    expect(query).not.toHaveBeenCalled();
  });

  it("propagates PostgreSQL query failure rather than manufacturing an authorized state", async () => {
    const pool: TalkAiStageSqlPool = {
      query: async () => { throw new Error("database is unavailable"); },
    };
    const repository = createPostgresTalkAiStageEventRepository(pool);
    await expect(repository.readAuthorizedStage({
      tenantId: "tenant-1", talkId: "talk-1", before: "2026-10-08T05:00:00Z",
    })).rejects.toThrow("database is unavailable");
  });
});
