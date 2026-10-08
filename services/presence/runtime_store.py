from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import asyncpg


@dataclass(frozen=True)
class PersonaRuntime:
    tenant_id: str
    talk_id: str
    seat_id: str
    persona_id: str
    kind: str
    display_name: str
    role: str
    bio: str
    active: bool
    muted: bool
    talk_live: bool
    host_connected: bool
    commercial_active: bool
    direct_instruction: Optional[str]

    @property
    def generation_allowed(self) -> bool:
        return (
            self.active
            and not self.muted
            and self.talk_live
            and self.host_connected
            and self.commercial_active
        )


class RuntimeStore:
    def __init__(self, pool: asyncpg.Pool):
        self._pool = pool

    @classmethod
    async def connect(cls, database_url: str) -> "RuntimeStore":
        pool = await asyncpg.create_pool(
            dsn=database_url,
            min_size=1,
            max_size=8,
            command_timeout=10,
        )
        return cls(pool)

    async def close(self) -> None:
        await self._pool.close()

    async def read(
        self,
        *,
        tenant_id: str,
        talk_id: str,
        seat_id: str,
        persona_id: str,
        kind: str,
    ) -> PersonaRuntime:
        request_id = seat_id.removeprefix("seat_")
        row = await self._pool.fetchrow(
            """
            SELECT
              s.active,
              s.is_muted,
              p.display_name,
              p.role,
              p.bio,
              lr.state AS live_state,
              EXISTS (
                SELECT 1
                  FROM talks.live_sessions ls
                 WHERE ls.tenant_id=s.tenant_id
                   AND ls.talk_id=s.talk_id
                   AND ls.role='host'
                   AND ls.connection_state='connected'
                   AND ls.last_seen_at >= clock_timestamp() - interval '15 seconds'
              ) AS host_connected,
              EXISTS (
                SELECT 1
                  FROM commerce.talk_ai_seat_quotes q
                 WHERE q.tenant_id=s.tenant_id
                   AND q.talk_id=s.talk_id
                   AND q.request_id=$6
                   AND q.definition->>'state'='admitted'
              ) AS commercial_active,
              CASE
                WHEN $5='twin'
                 AND d.expires_at > clock_timestamp()
                 AND d.persona_id=s.persona_id
                THEN d.instruction
                ELSE NULL
              END AS direct_instruction
            FROM talks.talk_seats s
            JOIN talks.persona_profiles p
              ON p.tenant_id=s.tenant_id
             AND p.public_id=s.persona_id
            LEFT JOIN talks.live_runtime lr
              ON lr.tenant_id=s.tenant_id
             AND lr.talk_id=s.talk_id
            LEFT JOIN talks.direct_twin_instructions d
              ON d.tenant_id=s.tenant_id
             AND d.talk_id=s.talk_id
             AND d.seat_id=s.participant_id
            WHERE s.tenant_id=$1
              AND s.talk_id=$2
              AND s.participant_id=$3
              AND s.persona_id=$4
              AND s.kind=$5
              AND s.kind IN ('expert','twin')
            LIMIT 1
            """,
            tenant_id,
            talk_id,
            seat_id,
            persona_id,
            kind,
            request_id,
        )
        if row is None:
            raise RuntimeError("AI Seat is no longer available")
        return PersonaRuntime(
            tenant_id=tenant_id,
            talk_id=talk_id,
            seat_id=seat_id,
            persona_id=persona_id,
            kind=kind,
            display_name=row["display_name"],
            role=row["role"] or "",
            bio=row["bio"] or "",
            active=bool(row["active"]),
            muted=bool(row["is_muted"]),
            talk_live=row["live_state"] == "live",
            host_connected=bool(row["host_connected"]),
            commercial_active=bool(row["commercial_active"]),
            direct_instruction=row["direct_instruction"],
        )



    async def read_public_stage(
        self, *, tenant_id: str, talk_id: str, seat_id: str,
        persona_id: str, kind: str,
    ) -> Optional[dict[str, object]]:
        """Read minimal public context from existing canonical Talk tables.

        The AI Seat must still be authorized, the human Host present and the
        Talk actively live. All queries run in one consistent, read-only
        snapshot. Private messages, raw votes and financial rows are excluded.
        """
        from datetime import datetime, timedelta, timezone
        import json

        before = datetime.now(timezone.utc)
        since = before - timedelta(minutes=10)
        async with self._pool.acquire() as connection:
            async with connection.transaction(isolation="repeatable_read", readonly=True):
                talk = await connection.fetchrow(
                    """
                    SELECT t.topic, t.host_name
                      FROM talks.talks t
                      JOIN talks.live_runtime lr
                        ON lr.tenant_id=t.tenant_id AND lr.talk_id=t.talk_id
                      JOIN talks.talk_seats s
                        ON s.tenant_id=t.tenant_id AND s.talk_id=t.talk_id
                     WHERE t.tenant_id=$1 AND t.talk_id=$2
                       AND t.state='live' AND lr.state='live'
                       AND s.participant_id=$3 AND s.persona_id=$4
                       AND s.kind=$5 AND s.active=true AND s.is_muted=false
                       AND s.removed_at IS NULL
                       AND EXISTS (
                           SELECT 1 FROM talks.live_sessions ls
                            WHERE ls.tenant_id=t.tenant_id
                              AND ls.talk_id=t.talk_id AND ls.role='host'
                              AND ls.connection_state='connected'
                              AND ls.last_seen_at >= clock_timestamp()-interval '15 seconds'
                       )
                       AND NOT EXISTS (
                           SELECT 1 FROM talks.safety_enforcement e
                            WHERE e.tenant_id=t.tenant_id
                              AND e.target_kind='talk' AND e.target_id=t.talk_id
                              AND e.visibility <> 'public'
                       ) LIMIT 1
                    """,
                    tenant_id, talk_id, seat_id, persona_id, kind,
                )
                if not talk:
                    return None
                participants = await connection.fetch(
                    """
                    SELECT s.display_name, s.kind, s.is_host
                      FROM talks.talk_seats s JOIN talks.talks t
                        ON t.tenant_id=s.tenant_id AND t.talk_id=s.talk_id
                     WHERE s.tenant_id=$1 AND s.talk_id=$2 AND s.active=true
                       AND s.removed_at IS NULL
                       AND NOT EXISTS (
                           SELECT 1 FROM talks.safety_preferences sp
                            WHERE sp.tenant_id=s.tenant_id
                              AND sp.viewer_user_id=t.host_user_id
                              AND sp.subject_user_id=s.user_id AND sp.blocked=true
                       )
                     ORDER BY s.is_host DESC, s.admitted_at ASC LIMIT 6
                    """, tenant_id, talk_id,
                )
                reactions = await connection.fetch(
                    """
                    SELECT p.reaction, COUNT(*)::integer AS total
                      FROM talks.participation p JOIN talks.talks t
                        ON t.tenant_id=p.tenant_id AND t.talk_id=p.talk_id
                     WHERE p.tenant_id=$1 AND p.talk_id=$2
                       AND p.reaction IS NOT NULL
                       AND p.reaction_updated_at BETWEEN $3 AND $4
                       AND NOT EXISTS (
                           SELECT 1 FROM talks.safety_preferences sp
                            WHERE sp.tenant_id=p.tenant_id
                              AND sp.viewer_user_id=t.host_user_id
                              AND sp.subject_user_id=p.user_id AND sp.blocked=true
                       )
                     GROUP BY p.reaction ORDER BY total DESC LIMIT 6
                    """, tenant_id, talk_id, since, before,
                )
                hands = await connection.fetch(
                    """
                    SELECT p.hand_status AS status, COUNT(*)::integer AS total
                      FROM talks.participation p JOIN talks.talks t
                        ON t.tenant_id=p.tenant_id AND t.talk_id=p.talk_id
                     WHERE p.tenant_id=$1 AND p.talk_id=$2
                       AND p.hand_status IN ('raised','accepted','declined')
                       AND p.updated_at BETWEEN $3 AND $4
                       AND NOT EXISTS (
                           SELECT 1 FROM talks.safety_preferences sp
                            WHERE sp.tenant_id=p.tenant_id
                              AND sp.viewer_user_id=t.host_user_id
                              AND sp.subject_user_id=p.user_id AND sp.blocked=true
                       )
                     GROUP BY p.hand_status ORDER BY total DESC LIMIT 3
                    """, tenant_id, talk_id, since, before,
                )
                questions = await connection.fetch(
                    """
                    SELECT q.author_name, q.body
                      FROM talks.questions q JOIN talks.talks t
                        ON t.tenant_id=q.tenant_id AND t.talk_id=q.talk_id
                     WHERE q.tenant_id=$1 AND q.talk_id=$2
                       AND q.status='answered'
                       AND q.resolved_at BETWEEN $3 AND $4
                       AND NOT EXISTS (
                           SELECT 1 FROM talks.safety_preferences sp
                            WHERE sp.tenant_id=q.tenant_id
                              AND sp.viewer_user_id=t.host_user_id
                              AND sp.subject_user_id=q.author_user_id AND sp.blocked=true
                       )
                     ORDER BY q.resolved_at DESC LIMIT 8
                    """, tenant_id, talk_id, since, before,
                )
                polls = await connection.fetch(
                    """
                    SELECT p.question, p.status,
                           COALESCE((SELECT jsonb_agg(jsonb_build_object(
                               'label', opt->>'label', 'votes',
                               (SELECT COUNT(*)::integer FROM talks.poll_votes v
                                 WHERE v.tenant_id=p.tenant_id
                                   AND v.talk_id=p.talk_id AND v.poll_id=p.poll_id
                                   AND v.option_id=opt->>'optionId')))
                             FROM jsonb_array_elements(p.options_json) opt),
                             '[]'::jsonb) AS options
                      FROM talks.polls p
                      LEFT JOIN LATERAL (
                          SELECT MAX(v.updated_at) AS latest_vote
                            FROM talks.poll_votes v
                           WHERE v.tenant_id=p.tenant_id AND v.talk_id=p.talk_id
                             AND v.poll_id=p.poll_id AND p.status='open'
                      ) recent ON true
                     WHERE p.tenant_id=$1 AND p.talk_id=$2
                       AND p.status IN ('open','closed')
                       AND COALESCE(p.closed_at,recent.latest_vote,p.created_at) BETWEEN $3 AND $4
                     ORDER BY COALESCE(p.closed_at,recent.latest_vote,p.created_at) DESC LIMIT 4
                    """, tenant_id, talk_id, since, before,
                )
                safe_polls = []
                for poll in polls:
                    value = poll["options"]
                    if isinstance(value, str):
                        try:
                            value = json.loads(value)
                        except (ValueError, TypeError):
                            value = []
                    safe_polls.append({
                        "question": poll["question"], "status": poll["status"],
                        "options": value if isinstance(value, list) else [],
                    })
                return {
                    "topic": talk["topic"], "host_name": talk["host_name"],
                    "participants": [dict(row) for row in participants],
                    "reactions": [dict(row) for row in reactions],
                    "hands": [dict(row) for row in hands],
                    "questions": [dict(row) for row in questions],
                    "polls": safe_polls,
                }
