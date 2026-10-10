import { describe, expect, it } from "vitest";
import {
  createPostgresTalkPollRepository,
  type TalkPollSqlPool,
} from "./postgres_repository.js";

const liveTalk = {
  host_user_id: "host_1",
  state: "live",
};

describe("Postgres Talk poll repository", () => {
  it("requires the human Host and live runtime before creating a poll", async () => {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const pool: TalkPollSqlPool = {
      async query<Row>(text: string, values?: unknown[]) {
        calls.push({ text, ...(values === undefined ? {} : { values }) });
        if (text.includes("FROM talks.talks")) {
          return { rowCount: 1, rows: [liveTalk] as unknown as Row[] };
        }
        if (text.includes("FROM talks.live_runtime")) {
          return { rowCount: 1, rows: [{ state: "live" }] as unknown as Row[] };
        }
        if (text.includes("INSERT INTO talks.polls")) {
          return {
            rowCount: 1,
            rows: [{
              poll_id: "poll_1",
              question: "Which topic next?",
              options_json: [
                { optionId: "option_1", label: "Jobs" },
                { optionId: "option_2", label: "Education" },
              ],
              status: "open",
              created_at: "2026-10-07T11:30:00.000Z",
              closed_at: null,
            }] as unknown as Row[],
          };
        }
        if (text.includes("FROM talks.poll_votes")) {
          return { rowCount: 0, rows: [] as unknown as Row[] };
        }
        return { rowCount: 0, rows: [] as unknown as Row[] };
      },
    };

    const result = await createPostgresTalkPollRepository(pool).create({
      tenantId: "tenant_1",
      hostUserId: "host_1",
      talkId: "talk_1",
      pollId: "poll_1",
      question: "Which topic next?",
      options: [
        { optionId: "option_1", label: "Jobs" },
        { optionId: "option_2", label: "Education" },
      ],
      now: "2026-10-07T11:30:00.000Z",
    });

    expect(result).toMatchObject({
      pollId: "poll_1",
      question: "Which topic next?",
      status: "open",
      totalVotes: 0,
    });
    expect(calls.some((call) =>
      call.text.includes("FROM talks.live_runtime") &&
      call.text.includes("state='live'")
    )).toBe(true);
    const insert = calls.find((call) => call.text.includes("INSERT INTO talks.polls"));
    expect(insert?.values?.[4]).toBe(JSON.stringify([
      { optionId: "option_1", label: "Jobs" },
      { optionId: "option_2", label: "Education" },
    ]));
  });

  it("rejects a non-Host before poll creation", async () => {
    let inserts = 0;
    const pool: TalkPollSqlPool = {
      async query<Row>(text: string) {
        if (text.includes("FROM talks.talks")) {
          return { rowCount: 1, rows: [liveTalk] as unknown as Row[] };
        }
        if (text.includes("INSERT INTO talks.polls")) inserts += 1;
        return { rowCount: 0, rows: [] as unknown as Row[] };
      },
    };

    await expect(
      createPostgresTalkPollRepository(pool).create({
        tenantId: "tenant_1",
        hostUserId: "listener_1",
        talkId: "talk_1",
        pollId: "poll_1",
        question: "Which topic next?",
        options: [
          { optionId: "option_1", label: "Jobs" },
          { optionId: "option_2", label: "Education" },
        ],
        now: "2026-10-07T11:30:00.000Z",
      }),
    ).rejects.toThrow("talks.host_forbidden");

    expect(inserts).toBe(0);
  });

  it("guards votes with live runtime, option membership, safety and one current user choice", async () => {
    let voteSql = "";
    const pool: TalkPollSqlPool = {
      async query<Row>(text: string) {
        if (text.includes("INSERT INTO talks.poll_votes")) {
          voteSql = text;
          return {
            rowCount: 1,
            rows: [{ option_id: "option_2" }] as unknown as Row[],
          };
        }
        if (text.includes("FROM talks.polls")) {
          return {
            rowCount: 1,
            rows: [{
              poll_id: "poll_1",
              question: "Which topic next?",
              options_json: [
                { optionId: "option_1", label: "Jobs" },
                { optionId: "option_2", label: "Education" },
              ],
              status: "open",
              created_at: "2026-10-07T11:30:00.000Z",
              closed_at: null,
            }] as unknown as Row[],
          };
        }
        if (text.includes("GROUP BY option_id")) {
          return {
            rowCount: 1,
            rows: [{ option_id: "option_2", vote_count: 1 }] as unknown as Row[],
          };
        }
        if (text.includes("FROM talks.poll_votes")) {
          return {
            rowCount: 1,
            rows: [{ option_id: "option_2" }] as unknown as Row[],
          };
        }
        return { rowCount: 0, rows: [] as unknown as Row[] };
      },
    };

    const result = await createPostgresTalkPollRepository(pool).vote({
      tenantId: "tenant_1",
      userId: "listener_1",
      talkId: "talk_1",
      pollId: "poll_1",
      optionId: "option_2",
      now: "2026-10-07T11:31:00.000Z",
    });

    expect(result).toMatchObject({
      pollId: "poll_1",
      myOptionId: "option_2",
      totalVotes: 1,
    });
    expect(voteSql).toContain("FROM talks.live_runtime");
    expect(voteSql).toContain("jsonb_array_elements(p.options_json)");
    expect(voteSql).toContain("FROM talks.safety_enforcement");
    expect(voteSql).toContain("ON CONFLICT(tenant_id,talk_id,poll_id,user_id) DO UPDATE");
  });

  it("lets only the Talk Host close an open poll", async () => {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const pool: TalkPollSqlPool = {
      async query<Row>(text: string, values?: unknown[]) {
        calls.push({ text, ...(values === undefined ? {} : { values }) });
        if (text.includes("FROM talks.talks")) {
          return { rowCount: 1, rows: [liveTalk] as unknown as Row[] };
        }
        if (text.includes("UPDATE talks.polls")) {
          return {
            rowCount: 1,
            rows: [{
              poll_id: "poll_1",
              question: "Which topic next?",
              options_json: [
                { optionId: "option_1", label: "Jobs" },
                { optionId: "option_2", label: "Education" },
              ],
              status: "closed",
              created_at: "2026-10-07T11:30:00.000Z",
              closed_at: "2026-10-07T11:32:00.000Z",
            }] as unknown as Row[],
          };
        }
        if (text.includes("FROM talks.poll_votes")) {
          return { rowCount: 0, rows: [] as unknown as Row[] };
        }
        return { rowCount: 0, rows: [] as unknown as Row[] };
      },
    };

    const result = await createPostgresTalkPollRepository(pool).close({
      tenantId: "tenant_1",
      hostUserId: "host_1",
      talkId: "talk_1",
      pollId: "poll_1",
      now: "2026-10-07T11:32:00.000Z",
    });

    expect(result).toMatchObject({
      pollId: "poll_1",
      status: "closed",
      closedAt: "2026-10-07T11:32:00.000Z",
    });
    const update = calls.find((call) => call.text.includes("UPDATE talks.polls"));
    expect(update?.values).toEqual([
      "tenant_1",
      "talk_1",
      "poll_1",
      "2026-10-07T11:32:00.000Z",
    ]);
  });
});
