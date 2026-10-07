from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
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
