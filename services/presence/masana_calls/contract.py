"""J04 immutable dispatch contract; sender must be the authorized Gateway."""
import json
import re
from dataclasses import dataclass

_CALL = re.compile(r"^call_[0-9a-f-]{36}$", re.I)
_CHARACTER = re.compile(r"^character_[0-9a-f-]{36}$", re.I)

@dataclass(frozen=True)
class MasanaCallDispatch:
    tenant_id: str
    call_id: str
    character_id: str
    room_name: str

    @classmethod
    def parse(cls, raw: str) -> "MasanaCallDispatch":
        value = json.loads(raw)
        if not isinstance(value, dict) or value.get("schemaVersion") != 1:
            raise ValueError("invalid_call_dispatch_version")
        tenant = value.get("tenantId")
        call_id = value.get("callId")
        character = value.get("characterId")
        room = value.get("roomName")
        if not isinstance(tenant, str) or not tenant.strip() or len(tenant) > 128:
            raise ValueError("invalid_call_tenant")
        if not isinstance(call_id, str) or not _CALL.fullmatch(call_id):
            raise ValueError("invalid_call_id")
        if not isinstance(character, str) or not _CHARACTER.fullmatch(character):
            raise ValueError("invalid_call_character")
        if not isinstance(room, str) or not re.fullmatch(r"masana-[a-f0-9-]{36}", room, re.I):
            raise ValueError("invalid_call_room")
        return cls(tenant, call_id, character, room)

    def assert_room(self, actual: str) -> None:
        if actual != self.room_name:
            raise ValueError("dispatched_room_mismatch")

def qualified_gemini_voice(profile_id: str, raw_profiles: str) -> str:
    """Resolve staff-approved profile ID to server-configured Gemini voice; fail closed."""
    try:
        profiles = json.loads(raw_profiles)
    except (TypeError, ValueError):
        raise ValueError("invalid_voice_profile_map") from None
    if not isinstance(profiles, dict):
        raise ValueError("invalid_voice_profile_map")
    voice = profiles.get(profile_id)
    if not isinstance(voice, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9-]{1,39}", voice):
        raise ValueError("voice_profile_not_qualified")
    return voice
