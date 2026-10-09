import { describe, expect, it, vi } from "vitest";
import { projectTalkAiStageContext } from "./event_context.js";
import {
  createPostgresTalkAiStageEventRepository,
  type TalkAiStageSqlPool,
} from "./postgres_stage_repository.js";

function fixture(available = true, remainsAvailable = available, finalHostId = "host-1") {
  let authorizationReads = 0;
  const query = vi.fn(async (sql: string, args?: unknown[]) => {
    if (sql.includes("FROM talks.talks ")) {
      authorizationReads += 1;
      return { rows: available && (authorizationReads === 1 || remainsAvailable)
        ? [{ topic: "Climate policy", host_name: "Host",
             host_user_id: authorizationReads === 1 ? "host-1" : finalHostId }] : [] };
    }
    if (sql.includes("FROM talks.talk_seats ") && sql.includes("s.active=false")) return { rows: [
      { participant_id: "seat-departed", kind: "human", display_name: "Former speaker",
        is_host: false, admitted_at: "2026-10-08T04:58:00Z",
        removed_at: "2026-10-08T04:59:05Z" },
    ] };
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
    if (sql.includes("FROM talks.comments ")) return { rows: [{
      comment_id: "moderator-approved-1",
      body: "Could this work in other regions?",
      author_name: "Zainab",
      approved_at: "2026-10-08T04:59:45Z",
    }] };
    if (sql.includes("FROM talks.polls ")) return { rows: [{
      poll_id: "poll-1", question: "Which alternative?", status: "open",
      event_at: "2026-10-08T04:59:40Z",
      tallies_json: [{ label: "Option A", votes: 7 }, { label: "Option B", votes: 3 }],
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
      "seat", "seat", "reaction", "hand", "question", "poll", "comment",
    ]);
    expect(context?.events[1]?.summary).toBe("human seat left");
    expect(context?.events.find((e) => e.kind === "reaction")?.summary)
      .toBe("👏 reactions: 13");
    expect(context?.events.find((e) => e.kind === "question")?.summary)
      .toContain("How can we verify this?");
    expect(context?.events.find((e) => e.kind === "poll")?.summary)
      .toContain("Option A: 7; Option B: 3");
    expect(context?.events.find((event) => event.kind === "comment")).toMatchObject({
      actorName: "Zainab",
      summary: "Moderated public comment: Could this work in other regions?",
    });
    expect(context?.contentTrust).toBe("public-untrusted-data");

    expect(query).toHaveBeenCalledTimes(9);
    expect(query.mock.calls.filter(([sql]) => sql.includes("FROM talks.talks "))).toHaveLength(2);
    for (const [sql, params] of query.mock.calls) {
      expect(sql).toMatch(/(?:(?:q|p|s|c)\.)?tenant_id=\$1 AND (?:(?:q|p|s|c)\.)?talk_id=\$2/);
      expect(params?.slice(0, 2)).toEqual(["tenant-1", "talk-1"]);
      if (sql.includes("FROM talks.comments")) {
        // Reading raw comments requires an explicit current safety approval,
        // with its decision time bounded so later approval cannot leak into
        // an earlier AI conversation or a blocked viewer's Talk.
        expect(sql).toContain("JOIN talks.safety_enforcement se");
        expect(sql).toContain("se.target_kind='comment'");
        expect(sql).toContain("se.target_id=c.comment_id");
        expect(sql).toContain("se.visibility='public'");
        expect(sql).toContain("GREATEST(c.created_at,se.updated_at) <= $3");
        expect(sql).toContain("GREATEST(c.created_at,se.updated_at) >= $4");
        expect(sql).toContain("sp.subject_user_id=c.author_user_id");
        expect(sql).toContain("sp.blocked=true");
        expect(sql).toContain("ORDER BY approved_at DESC");
        expect(sql).toContain("LIMIT 16");
      }
      expect(sql).not.toContain("FROM talks.activity");
      expect(sql).not.toContain("wallet");
      expect(sql).not.toContain("private");
    }
    const allSql = query.mock.calls.map(([sql]) => sql).join("\n");
    expect(allSql).toContain("status='answered'");
    expect(allSql).toContain("sp.viewer_user_id=t.host_user_id");
    expect(allSql).toContain("sp.blocked=true");
    expect(allSql).toContain("sp.subject_user_id=p.user_id");
    expect(allSql).toContain("GROUP BY p.reaction");
    expect(allSql).toContain("GROUP BY p.hand_status");
    expect(allSql).toContain("s.removed_at <= $3");
    expect(allSql).toContain("s.active=false");
    expect(allSql).toContain("COUNT(*)::integer FROM talks.poll_votes v");
    expect(allSql).toContain("v.option_id=opt->>'optionId'");
    expect(allSql).toContain("COALESCE(p.closed_at,recent.latest_vote,p.created_at)");
    expect(allSql).toContain("p.status='open'");
    expect(allSql).not.toContain("SELECT v.user_id");
    expect(allSql).not.toContain("SELECT c.author_user_id");
    expect(allSql).not.toContain("SELECT *");
    expect(allSql).not.toContain("talks.safety_reports");
    expect(allSql).toContain("LIMIT 16");
    expect(allSql).toContain("LIMIT 6");
  });

  it("fails closed when explicit comment moderation enforcement is unavailable", async () => {
    const failingPool: TalkAiStageSqlPool = {
      query: async (sql: string) => {
        if (sql.includes("FROM talks.talks ")) {
          return { rows: [{ topic: "Public topic", host_name: "Host", host_user_id: "host-1" }] };
        }
        if (sql.includes("FROM talks.comments ")) throw new Error("safety enforcement unavailable");
        return { rows: [] };
      },
    };
    const repository = createPostgresTalkAiStageEventRepository(failingPool);
    await expect(repository.readAuthorizedStage({
      tenantId: "tenant-1", talkId: "talk-1", before: "2026-10-08T05:00:00Z",
    })).rejects.toThrow("safety enforcement unavailable");
  });

  it("returns no AI stage context when a Talk ends or becomes restricted during parallel event reads", async () => {
    const { repository, query } = fixture(true, false);
    await expect(repository.readAuthorizedStage({
      tenantId: "tenant-1", talkId: "talk-1", before: "2026-10-08T05:00:00Z",
    })).resolves.toBeNull();
    expect(query.mock.calls.filter(([sql]) => sql.includes("FROM talks.talks "))).toHaveLength(2);
    expect(query.mock.calls[8]?.[0]).toContain("se.visibility <> 'public'");
  });

  it("returns no prior-Host audience snapshot when the Talk Host changes during reads", async () => {
    const { repository } = fixture(true, true, "host-2");
    await expect(repository.readAuthorizedStage({
      tenantId: "tenant-1", talkId: "talk-1", before: "2026-10-08T05:00:00Z",
    })).resolves.toBeNull();
  });

  it("fails closed if the final Talk authorization check encounters a database error", async () => {
    let checks = 0;
    const pool: TalkAiStageSqlPool = {
      query: async (sql: string) => {
        if (sql.includes("FROM talks.talks ")) {
          checks += 1;
          if (checks === 2) throw new Error("Talk authorization retry failed");
          return { rows: [{ topic: "Climate policy", host_name: "Host", host_user_id: "host-1" }] };
        }
        return { rows: [] };
      },
    };
    await expect(createPostgresTalkAiStageEventRepository(pool).readAuthorizedStage({
      tenantId: "tenant-1", talkId: "talk-1", before: "2026-10-08T05:00:00Z",
    })).rejects.toThrow("Talk authorization retry failed");
    expect(checks).toBe(2);
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
