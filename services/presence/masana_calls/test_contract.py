"""stdlib-only contract negatives, usable without LiveKit/provider credentials."""
import json
import unittest
from contract import MasanaCallDispatch

VALID = {
  "schemaVersion": 1, "tenantId": "tenant-a",
  "callId": "call_0199f0d0-0000-7000-8000-000000000003",
  "characterId": "character_0199f0d0-0000-7000-8000-000000000004",
  "roomName": "masana-0199f0d0-0000-7000-8000-000000000005",
}

class TestDispatch(unittest.TestCase):
    def test_valid_and_exact_room(self):
        parsed = MasanaCallDispatch.parse(json.dumps(VALID))
        parsed.assert_room(VALID["roomName"])
        with self.assertRaises(ValueError):
            parsed.assert_room("other-room")

    def test_denied_version_and_malformed_or_wrong_character(self):
        for patch in ({"schemaVersion": 2}, {"tenantId": ""},
                      {"characterId": "human_123"}, {"callId": "bad"},
                      {"roomName": "talk-seat"}):
            with self.subTest(patch=patch):
                with self.assertRaises(ValueError):
                    MasanaCallDispatch.parse(json.dumps({**VALID, **patch}))

if __name__ == "__main__":
    unittest.main()
