import type {
  TalkAiStageEventRepository,
  TalkAuthorizedStage,
  TalkStageEvent,
} from "./event_context.js";

interface SqlResult<Row> {
  readonly rows: Row[];
}
export interface TalkAiStageSqlPool {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<SqlResult<Row>>;
}

interface TalkRow extends Record<string, unknown> {
  topic: string;
  host_name: string;
}
interface SeatRow extends Record<string, unknown> {
  participant_id: string;
  kind: "human" | "expert" | "twin";
  display_name: string;
  is_host: boolean;
  admitted_at: Date | string;
}
interface ReactionRow extends Record<string, unknown> {
  reaction: string;
  total: number | string;
  latest: Date | string;
}
interface HandRow extends Record<string, unknown> {
  hand_status: "raised" | "accepted" | "declined";
  total: number | string;
  latest: Date | string;
}
interface QuestionRow extends Record<string, unknown> {
  question_id: string;
  body: string;
  author_name: string;
  resolved_at: Date | string;
}
interface PollRow extends Record<string, unknown> {
  poll_id: string;
  question: string;
  status: "open" | "closed";
  event_at: Date | string;
}

function timestamp(value: string | Date): string {
  const time = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(time.getTime())) throw new TypeError("Invalid persisted Talk event timestamp");
  return time.toISOString();
}

/**
 * Reads existing authoritative Talk tables without inventing a separate event store.
 * Only accepted public states are projected. In particular:
 * - pending/dismissed questions and unmoderated comments are excluded;
 * - private recipient identities and raw financial activity are never read;
 * - gifts are withheld until a canonical settled PUBLIC event projection exists;
 * - current reactions and hands are aggregated instead of revealing listeners.
 *
 * This is a best-effort recent snapshot, not a lossless historical event log.
 * Persistence and moderation responsibilities remain with their own services.
 */
export function createPostgresTalkAiStageEventRepository(
  pool: TalkAiStageSqlPool,
): TalkAiStageEventRepository {
  return Object.freeze({
    async readAuthorizedStage({ tenantId, talkId, before }) {
      const until = Date.parse(before);
      if (!Number.isFinite(until) || !tenantId.trim() || !talkId.trim()) {
        throw new TypeError("Invalid stage context request");
      }
      const since = new Date(until - 10 * 60 * 1000).toISOString();
      const scope = [tenantId, talkId, before, since];

      const talk = await pool.query<TalkRow>(
        "SELECT topic, host_name FROM talks.talks " +
        "WHERE tenant_id=$1 AND talk_id=$2 AND state IN ('live','reconnecting') " +
        "AND NOT EXISTS (SELECT 1 FROM talks.safety_enforcement se " +
        "WHERE se.tenant_id=$1 AND se.target_kind='talk' " +
        "AND se.target_id=$2 AND se.visibility <> 'public') LIMIT 1",
        [tenantId, talkId],
      );
      if (!talk.rows[0]) return null;

      // All reads must remain scoped by tenant AND Talk. These queries return
      // only bounded public projections, never whole rows or JSON payloads.
      const [seats, reactions, hands, questions, polls] = await Promise.all([
        pool.query<SeatRow>(
          "SELECT s.participant_id,s.kind,s.display_name,s.is_host,s.admitted_at " +
          "FROM talks.talk_seats s JOIN talks.talks t " +
          "ON t.tenant_id=s.tenant_id AND t.talk_id=s.talk_id " +
          "WHERE s.tenant_id=$1 AND s.talk_id=$2 AND s.active=true " +
          "AND NOT EXISTS (SELECT 1 FROM talks.safety_preferences sp " +
          "WHERE sp.tenant_id=s.tenant_id AND sp.viewer_user_id=t.host_user_id " +
          "AND sp.subject_user_id=s.user_id AND sp.blocked=true) " +
          "ORDER BY s.is_host DESC,s.admitted_at ASC LIMIT 6",
          [tenantId, talkId],
        ),
        pool.query<ReactionRow>(
          "SELECT p.reaction,COUNT(*)::integer AS total,MAX(p.reaction_updated_at) AS latest " +
          "FROM talks.participation p JOIN talks.talks t " +
          "ON t.tenant_id=p.tenant_id AND t.talk_id=p.talk_id " +
          "WHERE p.tenant_id=$1 AND p.talk_id=$2 AND p.reaction IS NOT NULL " +
          "AND p.reaction_updated_at <= $3 AND p.reaction_updated_at >= $4 " +
          "AND NOT EXISTS (SELECT 1 FROM talks.safety_preferences sp " +
          "WHERE sp.tenant_id=p.tenant_id AND sp.viewer_user_id=t.host_user_id " +
          "AND sp.subject_user_id=p.user_id AND sp.blocked=true) " +
          "GROUP BY p.reaction ORDER BY latest DESC LIMIT 6",
          scope,
        ),
        pool.query<HandRow>(
          "SELECT p.hand_status,COUNT(*)::integer AS total,MAX(p.updated_at) AS latest " +
          "FROM talks.participation p JOIN talks.talks t " +
          "ON t.tenant_id=p.tenant_id AND t.talk_id=p.talk_id " +
          "WHERE p.tenant_id=$1 AND p.talk_id=$2 " +
          "AND p.hand_status IN ('raised','accepted','declined') " +
          "AND p.updated_at <= $3 AND p.updated_at >= $4 " +
          "AND NOT EXISTS (SELECT 1 FROM talks.safety_preferences sp " +
          "WHERE sp.tenant_id=p.tenant_id AND sp.viewer_user_id=t.host_user_id " +
          "AND sp.subject_user_id=p.user_id AND sp.blocked=true) " +
          "GROUP BY p.hand_status ORDER BY latest DESC LIMIT 3",
          scope,
        ),
        pool.query<QuestionRow>(
          "SELECT q.question_id,q.body,q.author_name,q.resolved_at " +
          "FROM talks.questions q JOIN talks.talks t " +
          "ON t.tenant_id=q.tenant_id AND t.talk_id=q.talk_id " +
          "WHERE q.tenant_id=$1 AND q.talk_id=$2 AND q.status='answered' " +
          "AND q.resolved_at <= $3 AND q.resolved_at >= $4 " +
          "AND NOT EXISTS (SELECT 1 FROM talks.safety_preferences sp " +
          "WHERE sp.tenant_id=q.tenant_id AND sp.viewer_user_id=t.host_user_id " +
          "AND sp.subject_user_id=q.author_user_id AND sp.blocked=true) " +
          "ORDER BY q.resolved_at DESC LIMIT 16",
          scope,
        ),
        pool.query<PollRow>(
          "SELECT poll_id,question,status,COALESCE(closed_at,created_at) AS event_at " +
          "FROM talks.polls WHERE tenant_id=$1 AND talk_id=$2 " +
          "AND COALESCE(closed_at,created_at) <= $3 " +
          "AND COALESCE(closed_at,created_at) >= $4 " +
          "ORDER BY event_at DESC LIMIT 16",
          scope,
        ),
      ]);

      const common = { tenantId, talkId, visibility: "public" as const };
      const events: TalkStageEvent[] = [
        ...seats.rows.map((seat): TalkStageEvent => ({
          ...common,
          eventId: "seat:" + seat.participant_id,
          occurredAt: timestamp(seat.admitted_at),
          actorName: seat.display_name,
          kind: "seat",
          role: seat.kind,
          action: "joined",
        })),
        ...reactions.rows.map((reaction): TalkStageEvent => ({
          ...common,
          eventId: "reaction:" + reaction.reaction + ":" + timestamp(reaction.latest),
          occurredAt: timestamp(reaction.latest),
          actorName: "",
          kind: "reaction",
          reaction: reaction.reaction,
          count: Number(reaction.total),
        })),
        ...hands.rows.map((hand): TalkStageEvent => ({
          ...common,
          eventId: "hand:" + hand.hand_status + ":" + timestamp(hand.latest),
          occurredAt: timestamp(hand.latest),
          actorName: String(Math.min(10000, Number(hand.total))) + " audience members",
          kind: "hand",
          action: hand.hand_status,
        })),
        ...questions.rows.map((question): TalkStageEvent => ({
          ...common,
          eventId: "answered-question:" + question.question_id,
          occurredAt: timestamp(question.resolved_at),
          actorName: question.author_name,
          kind: "question",
          action: "answered",
          body: question.body,
        })),
        ...polls.rows.map((poll): TalkStageEvent => ({
          ...common,
          eventId: "poll:" + poll.poll_id + ":" + poll.status,
          occurredAt: timestamp(poll.event_at),
          actorName: "",
          kind: "poll",
          action: poll.status === "open" ? "opened" : "closed",
          question: poll.question,
        })),
      ];
      return Object.freeze<TalkAuthorizedStage>({
        tenantId,
        talkId,
        topic: talk.rows[0].topic,
        hostName: talk.rows[0].host_name,
        participants: Object.freeze(seats.rows.map((seat) => Object.freeze({
          displayName: seat.display_name,
          kind: seat.kind,
          isHost: seat.is_host,
        }))),
        events: Object.freeze(events),
      });
    },
  });
}
