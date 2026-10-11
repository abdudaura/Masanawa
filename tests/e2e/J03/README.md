# J03 Masana-only text chat — non-deploying source

Contract: fan opens session for **approved, active, platform-owned Masana**,
submits stable canonical request IDs, receives responses through the existing
AgentConversationService (canonical agents.character_sessions and mobile turn
journal). No new SQL tables or competing journal. POST /v1/masana/:id/chat/sessions,
POST /v1/masana/:id/chat/sessions/:sessionId/turns, and close are feature-local.
Every API request requalifies the character using the L-MASANA approved revision
and the existing session authorizer validates fan/tenant/character association.

Golden steps on a disposable PG18 instance after AF00 composition:
1. Apply original migrations then L-MASANA approved profile schema. Seed two
   tenants, one platform Masana, one draft Masana and one human-owned character.
2. Fan A opens session; post request ID R twice; assert one persisted agent turn,
   same result and a single model invocation. Replay conflicting payload -> denied.
3. Fan B and foreign tenant cannot use A's session or request ID.
4. Draft/revoked Masana, human, blank user, missing/failed PG auth -> denied.
5. Disconnect/reconnect on Android. Queue several sends while response streams;
   retry the failed turn with the SAME request ID; no lost or duplicated send.
6. Worker turn admission denied when feature disabled, character withdrawn or fan
   authority revoked. No SMS, human DM, Twin, or WebSocket alternate admission.

Source dependencies for AF00 only: inject existing authenticated fan resolver,
canonical AgentConversationService, approved Masana eligibility store and job guard;
mount C10–C12 Flutter feature to five-tab shell and persist account-fenced outbox.
Do not enable historical /agent/* human/clone session writes. No new migration.
Run scoped Vitest, PG18 fresh+upgrade and Flutter widget tests at the exact
integrated SHA, then live low-end Android test. **No release is claimed.**
