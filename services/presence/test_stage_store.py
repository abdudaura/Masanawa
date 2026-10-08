"""SQL authorization-boundary checks; no live DB or provider secrets needed."""
from __future__ import annotations
import unittest
from runtime_store import RuntimeStore


class _Transaction:
    def __init__(self, connection, isolation, readonly):
        assert isolation == "repeatable_read"
        assert readonly is True
        self.connection = connection

    async def __aenter__(self):
        self.connection.in_transaction = True
        return self

    async def __aexit__(self, *_):
        self.connection.in_transaction = False


class _Connection:
    def __init__(self, live=True):
        self.live = live
        self.in_transaction = False
        self.queries = []

    def transaction(self, *, isolation, readonly):
        return _Transaction(self, isolation, readonly)

    async def fetchrow(self, sql, *args):
        assert self.in_transaction
        self.queries.append((sql, args))
        if not self.live:
            return None
        return {"topic": "Science and ethics", "host_name": "Amina"}

    async def fetch(self, sql, *args):
        assert self.in_transaction
        self.queries.append((sql, args))
        if "FROM talks.talk_seats s JOIN" in sql:
            return [{"display_name": "Amina", "kind": "human", "is_host": True}]
        if "GROUP BY p.reaction" in sql:
            return [{"reaction": "👏", "total": 9}]
        if "GROUP BY p.hand_status" in sql:
            return [{"status": "raised", "total": 2}]
        if "FROM talks.questions q JOIN" in sql:
            return [{"author_name": "Musa", "body": "What next?"}]
        if "FROM talks.polls p" in sql:
            return [{"question": "Vote?", "status": "open", "options": '[{"label":"Yes","votes":2}]'}]
        raise AssertionError("unexpected SQL read")


class _Acquire:
    def __init__(self, connection):
        self.connection = connection

    async def __aenter__(self):
        return self.connection

    async def __aexit__(self, *_):
        pass


class _Pool:
    def __init__(self, connection):
        self.connection = connection

    def acquire(self):
        return _Acquire(self.connection)


class StageReadTests(unittest.IsolatedAsyncioTestCase):
    async def test_live_stage_is_exactly_scoped_to_tenant_talk_seat_persona_kind(self):
        connection = _Connection()
        store = RuntimeStore(_Pool(connection))
        response = await store.read_public_stage(
            tenant_id="tenant_1", talk_id="talk_1", seat_id="seat_1",
            persona_id="expert_1", kind="expert",
        )
        self.assertEqual(response["topic"], "Science and ethics")
        self.assertEqual(response["host_name"], "Amina")
        self.assertEqual(response["polls"][0]["options"], [{"label": "Yes", "votes": 2}])
        self.assertEqual(len(connection.queries), 6)
        authorization_sql, arguments = connection.queries[0]
        self.assertEqual(arguments, ("tenant_1", "talk_1", "seat_1", "expert_1", "expert"))
        for fragment in (
            "s.active=true", "s.is_muted=false", "s.removed_at IS NULL",
            "lr.state='live'", "ls.role='host'", "ls.connection_state='connected'",
            "talks.safety_enforcement", "e.visibility <> 'public'",
        ):
            self.assertIn(fragment, authorization_sql)
        for sql, args in connection.queries[1:]:
            self.assertIn("tenant_id=$1", sql)
            self.assertIn("talk_id=$2", sql)
            self.assertEqual(args[:2], ("tenant_1", "talk_1"))

    async def test_disallowed_stage_is_not_read_or_projected(self):
        connection = _Connection(live=False)
        store = RuntimeStore(_Pool(connection))
        response = await store.read_public_stage(
            tenant_id="tenant_1", talk_id="talk_1", seat_id="seat_1",
            persona_id="expert_1", kind="expert",
        )
        self.assertIsNone(response)
        self.assertEqual(len(connection.queries), 1)
        self.assertFalse(connection.in_transaction)

    async def test_only_public_aggregates_without_raw_private_votes_or_financial_tables(self):
        connection = _Connection()
        store = RuntimeStore(_Pool(connection))
        response = await store.read_public_stage(
            tenant_id="tenant_1", talk_id="talk_1", seat_id="seat_1",
            persona_id="expert_1", kind="expert",
        )
        self.assertEqual(response["reactions"], [{"reaction": "👏", "total": 9}])
        self.assertEqual(response["questions"], [{"author_name": "Musa", "body": "What next?"}])
        sql = "\n".join(entry[0] for entry in connection.queries)
        self.assertIn("q.status='answered'", sql)
        self.assertIn("recent.latest_vote", sql)
        self.assertIn("sp.blocked=true", sql)
        for forbidden in ("commerce.", "wallet", "financial", "agent_messages", "private_message"):
            self.assertNotIn(forbidden, sql.lower())
        self.assertFalse(connection.in_transaction)


if __name__ == "__main__":
    unittest.main()
