import { describe, expect, it } from "vitest";
import {
  createTalkLiveSession,
  type TalkLiveSession,
} from "@masanawa/agents";
import { toInstant } from "@masanawa/contracts";
import {
  createPostgresTalkModerationRepository,
  type TalkModerationSqlPool,
} from "./postgres_repository.js";

function talkRow() {
  return {
    host_user_id: "user_host",
    host_name: "Host",
    state: "live",
    started_at: "2026-10-07T10:00:00.000Z",
  };
}

describe("Postgres Talk moderation repository", () => {
  it("turns an accepted free human request into a canonical Speaker Seat", async () => {
    const initial = createTalkLiveSession({
      tenantId: "tenant_1" as never,
      talkId: "talk_1" as never,
      hostUserId: "user_host" as never,
      hostSeatId: "host_user_host" as never,
      startedAt: toInstant("2026-10-07T10:00:00.000Z"),
    });
    let canonicalReads = 0;
    const calls: string[] = [];

    const pool: TalkModerationSqlPool = {
      async query<Row>(text: string) {
        calls.push(text);
        if (text.includes("FROM talks.talks")) {
          return { rowCount: 1, rows: [talkRow()] as unknown as Row[] };
        }
        if (text.includes("FROM talks.host_requests") && text.includes("request_id=$3")) {
          return {
            rowCount: 1,
            rows: [{
              request_id: "hand_user_speaker",
              kind: "human_speaker",
              requester_user_id: "user_speaker",
              persona_id: null,
              display_name: "Speaker",
              detail: null,
              avatar_url: null,
              amount_label: null,
              commercial_authorization_id: null,
              status: "pending",
            }] as unknown as Row[],
          };
        }
        if (text.includes("FROM talks.live_runtime")) {
          return { rowCount: 1, rows: [{ state: "live" }] as unknown as Row[] };
        }
        if (text.includes("SELECT revision,session_json") && text.includes("talks.live_canonical")) {
          canonicalReads += 1;
          return canonicalReads === 1
            ? { rowCount: 0, rows: [] as unknown as Row[] }
            : {
                rowCount: 1,
                rows: [{ revision: initial.revision, session_json: initial }] as unknown as Row[],
              };
        }
        if (text.includes("INSERT INTO talks.live_canonical")) {
          return { rowCount: 1, rows: [] as unknown as Row[] };
        }
        if (text.includes("WITH canonical AS") && text.includes("talks.talk_seats")) {
          return { rowCount: 1, rows: [{ applied: true }] as unknown as Row[] };
        }
        if (text.includes("UPDATE talks.live_sessions") && text.includes("role='speaker'")) {
          return {
            rowCount: 1,
            rows: [{ user_id: "user_speaker", session_id: "session_1" }] as unknown as Row[],
          };
        }
        if (text.includes("FROM talks.host_requests") && text.includes("status='pending'")) {
          return { rowCount: 0, rows: [] as unknown as Row[] };
        }
        if (text.includes("FROM talks.talk_seats") && text.includes("active=true")) {
          return {
            rowCount: 1,
            rows: [{
              participant_id: "seat_hand_user_speaker",
              kind: "human",
              user_id: "user_speaker",
              persona_id: null,
              display_name: "Speaker",
              avatar_url: null,
              is_host: false,
              is_muted: false,
            }] as unknown as Row[],
          };
        }
        return { rowCount: 1, rows: [] as unknown as Row[] };
      },
    };

    const result = await createPostgresTalkModerationRepository(pool).actOnRequest({
      tenantId: "tenant_1",
      hostUserId: "user_host",
      talkId: "talk_1",
      requestId: "hand_user_speaker",
      action: "accept",
      now: "2026-10-07T10:01:00.000Z",
    });

    expect(result?.controls.participants).toEqual([
      {
        participantId: "host_user_host",
        displayName: "Host",
        kind: "human",
        isHost: true,
        isMuted: false,
      },
      {
        participantId: "seat_hand_user_speaker",
        displayName: "Speaker",
        kind: "human",
        isHost: false,
        isMuted: false,
      },
    ]);
    expect(result?.mediaActions).toEqual([
      { type: "publish", identity: "user_speaker:session_1", canPublish: true },
    ]);
    expect(calls.some((text) => text.includes("revision=$4"))).toBe(true);
  });

  it("persists bounded pending audience questions for a live Talk", async () => {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const pool: TalkModerationSqlPool = {
      async query<Row>(text: string, values?: unknown[]) {
        calls.push({ text, values });
        if (text.includes("FROM talks.talks")) {
          return { rowCount: 1, rows: [talkRow()] as unknown as Row[] };
        }
        if (text.includes("FROM talks.live_runtime")) {
          return { rowCount: 1, rows: [{ state: "live" }] as unknown as Row[] };
        }
        if (text.includes("INSERT INTO talks.questions")) {
          return {
            rowCount: 1,
            rows: [{
              question_id: "question_1",
              author_name: "Listener",
              body: "What changed?",
              status: "pending",
              created_at: "2026-10-07T10:01:00.000Z",
              resolved_at: null,
            }] as unknown as Row[],
          };
        }
        return { rowCount: 0, rows: [] as unknown as Row[] };
      },
    };

    const question =
        await createPostgresTalkModerationRepository(pool).submitQuestion({
      tenantId: "tenant_1",
      talkId: "talk_1",
      userId: "user_listener",
      displayName: "Listener",
      questionId: "question_1",
      body: "What changed?",
      now: "2026-10-07T10:01:00.000Z",
    });

    expect(question).toMatchObject({
      questionId: "question_1",
      authorName: "Listener",
      body: "What changed?",
      status: "pending",
    });
    const insert = calls.find((call) =>
      call.text.includes("INSERT INTO talks.questions")
    );
    expect(insert?.text).toContain("'pending'");
    expect(insert?.text).toContain("< 3");
  });

  it("returns the remaining Host question queue after resolution", async () => {
    let questionReads = 0;
    const pool: TalkModerationSqlPool = {
      async query<Row>(text: string) {
        if (text.includes("FROM talks.talks")) {
          return { rowCount: 1, rows: [talkRow()] as unknown as Row[] };
        }
        if (text.includes("UPDATE talks.questions")) {
          return {
            rowCount: 1,
            rows: [{
              question_id: "question_1",
              author_name: "Listener",
              body: "First?",
              status: "answered",
              created_at: "2026-10-07T10:01:00.000Z",
              resolved_at: "2026-10-07T10:02:00.000Z",
            }] as unknown as Row[],
          };
        }
        if (text.includes("FROM talks.questions")) {
          questionReads += 1;
          return {
            rowCount: 1,
            rows: [{
              question_id: "question_2",
              author_name: "Second listener",
              body: "Second?",
              status: "pending",
              created_at: "2026-10-07T10:01:30.000Z",
              resolved_at: null,
            }] as unknown as Row[],
          };
        }
        return { rowCount: 0, rows: [] as unknown as Row[] };
      },
    };

    const remaining =
        await createPostgresTalkModerationRepository(pool).resolveQuestion({
      tenantId: "tenant_1",
      talkId: "talk_1",
      hostUserId: "user_host",
      questionId: "question_1",
      action: "answered",
      now: "2026-10-07T10:02:00.000Z",
    });

    expect(questionReads).toBe(1);
    expect(remaining).toEqual([
      expect.objectContaining({
        questionId: "question_2",
        status: "pending",
      }),
    ]);
  });

  it("never lets moderation remove the Host Seat", async () => {
    const pool: TalkModerationSqlPool = {
      async query<Row>(text: string) {
        if (text.includes("FROM talks.talks")) {
          return { rowCount: 1, rows: [talkRow()] as unknown as Row[] };
        }
        return { rowCount: 0, rows: [] as unknown as Row[] };
      },
    };

    await expect(
      createPostgresTalkModerationRepository(pool).moderateParticipant({
        tenantId: "tenant_1",
        hostUserId: "user_host",
        talkId: "talk_1",
        participantId: "host_user_host",
        action: "remove",
        now: "2026-10-07T10:01:00.000Z",
      }),
    ).rejects.toThrow("talks.host_immutable");
  });
});
