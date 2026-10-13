# AF10: direct AI questions and removal of unsolicited product gates

Base main: e11fe1481c3aa51db9b6bf90fce38c44cd2b1472
Claim: af10-rooms-direct-answers-20261013-gpt6
Branch: lane/af10-rooms-direct-answers-20261013-gpt6

## User-facing behavior
- An authenticated fan joins any published **free** Room, asks a question of any ordinary topic, and sees an immediate pending state followed by the **AI-generated answer** when available. No staff approval, staff-review queue, or human publish button is involved. The answer is recorded as machine-generated and visible in the existing Room questions API. Failed Gemini calls retain the question and retry with bounded exponential backoff.
- Existing questions incorrectly diverted into \`needs_staff\` and marked outbox \`acknowledged\` become eligible for automatic generation again, unless an answer is already approved. No destructive data migration.
- Remove the arbitrary 20-question/day cap. Short one-character questions are accepted by a forward-only SQL constraint adjustment (0005), keeping non-empty/2000-char validation, auth, tenant isolation, idempotency, and subscription integrity. Existing native mobile screens show actual answer/pending states, not fake moderation.
- Regular user-facing Status, Rooms and Chats feature registrations are enabled when correctly composed with sessions and storage, instead of off-by-default operator switches. Editorial creation remains limited to server-listed editors. No user gains platform-admin permissions.

## Provider and operations
- The existing **server-owned Gemini credentials** supply the Room worker. Its model uses the current \`MASANAWA_GEMINI_CREDENTIALS_JSON\` or \`MASANAWA_GEMINI_API_KEY\` / \`GEMINI_API_KEY\`, and \`MASANAWA_GEMINI_REPLY_MODELS\` when provided. Lack of credentials fails startup clearly rather than silently routing all questions to manual review. No credentials enter customer routes or logs. Provider error or empty answer triggers durable retry, not human moderation.
- Provider usage has real variable cost: the owner requested functional AI Rooms; operators still need to supply a supported Gemini credential and review actual cost/throughput. The AI service and database must be deployed/healthy. No artificial question limits are imposed; sensible request size, secure auth, provider deadlines and bounded worker concurrency remain.
- This removes *non-security* user-facing content activation switches, **not** signed financial transactions, verified paid subscriptions, legal protections, safety guards, or receipt/account authorization.

## Audit / constraints
- Previously arbitrary: MASANAWA_ROOMS_BACKEND_ENABLED, MASANAWA_STATUS_BACKEND_ENABLED, MASANAWA_CHATS_INBOX_ENABLED, MASANAWA_ROOMS_STAFF_ENABLED, MASANAWA_ROOMS_TEACHER_REVIEW_ONLY_ENABLED, staff-only /admin/rooms/questions/:questionId/review and the hardcoded 20/day count. Replaced them with working product dependencies and actual account/editor boundaries.
- Separate paid/membership/Play subscription APIs remain guarded until verified Play entitlement. Financial issuance/provider settlement stays guarded, \`0112_msn_wallet.sql\` stays outside production migrations. Existing moderated discussion/reports still protect other fans; do not confuse these with reviewing ordinary Room questions.
- Railway production database and Gateway were observed offline on 2026-10-13; original worker was on obsolete October 4 Baatiku billing proxy branch. THIS CODE CHANGE DOES NOT CLAIM LIVE PRODUCTION DEPLOYMENT. Actual deploy, database restore/migration, real Gemini call and two-account/device proofs remain unverified until executed.

## Verification
Run existing \`.github/workflows/rooms-production-build.yml\` on exact head: production Gateway + Worker builds, Rooms/Calls and provider tests, real PostgreSQL 18 migrations and idempotence. Scope human/financial/provider checks separately. MUI-09, MUI-10, AF11 remain OPEN.
