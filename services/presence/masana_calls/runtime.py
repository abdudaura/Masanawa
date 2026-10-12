"""Per-turn read authority; separate from retired Talks/Twin presence runtime."""
import asyncpg
from dataclasses import dataclass
from datetime import datetime, timezone

from contract import MasanaCallDispatch

@dataclass(frozen=True)
class MasanaVoiceContext:
    display_name: str
    profession: str
    biography: str
    voice_id: str
    expires_at: datetime
    permitted: bool

    @property
    def active(self) -> bool:
        return self.permitted and self.expires_at > datetime.now(timezone.utc)

class MasanaCallRuntime:
    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool

    @classmethod
    async def connect(cls, database_url: str) -> "MasanaCallRuntime":
        return cls(await asyncpg.create_pool(dsn=database_url, min_size=1, max_size=4, command_timeout=10))

    async def close(self) -> None:
        await self.pool.close()

    async def read(self, call: MasanaCallDispatch) -> MasanaVoiceContext:
        row = await self.pool.fetchrow("""
            SELECT s.state, s.expires_at, r.voice_profile_id, r.profile
            FROM masana.call_sessions s
            JOIN masana.character_revisions r ON r.tenant_id=s.tenant_id
                AND r.character_id=s.character_id AND r.state='approved'
            JOIN identity.characters c ON c.tenant_id=s.tenant_id AND c.character_id=s.character_id
            JOIN identity.character_ownership o ON o.tenant_id=s.tenant_id AND o.character_id=s.character_id
            JOIN identity.users u ON u.tenant_id=s.tenant_id AND u.user_id=s.fan_user_id
            WHERE s.tenant_id=$1 AND s.call_id=$2 AND s.character_id=$3
              AND s.room_name=$4 AND s.state IN ('connecting','active')
              AND s.expires_at > now() AND c.state='active'
              AND o.kind='platform' AND u.state='active'
              AND nullif(btrim(r.voice_profile_id),'') IS NOT NULL
            LIMIT 1
        """, call.tenant_id, call.call_id, call.character_id, call.room_name)
        if row is None:
            raise PermissionError("masana_call_not_authorized")
        profile = row["profile"]
        if isinstance(profile, str):
            import json
            profile = json.loads(profile)
        return MasanaVoiceContext(
            display_name=str(profile.get("displayName", "Masana")),
            profession=str(profile.get("profession", "AI professional")),
            biography=str(profile.get("bio", ""))[:1600],
            voice_id=row["voice_profile_id"],
            expires_at=row["expires_at"],
            permitted=True,
        )
