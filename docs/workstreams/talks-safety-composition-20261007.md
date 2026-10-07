# Talk safety composition — 2026-10-07

- **Owner:** current ChatGPT Talks implementation window
- **Branch:** `work/talks-safety-composition-20261007`
- **Base:** `dbd64c530407fe3bd2b6d3c82a03d552d5c528dc`
- **PR:** #377 — Compose Talk safety routes and replay enforcement

## Implemented

### Gateway safety routes
Registered the already-merged durable Talk safety service:
- `POST /safety/reports`
- `GET /safety/profiles/:handle/preference`
- `PUT /safety/profiles/:handle/preference`
- `GET /admin/talk-safety/:kind/:targetId`
- `PUT /admin/talk-safety/:kind/:targetId`

The PostgreSQL safety repository is now composed from the canonical Gateway database pool.

### Authority split
- Ordinary customer reporting and personal block/mute use the existing platform customer-session authorizer.
- Global safety enforcement uses a distinct `TalkSafetyPlatformAuthority`.
- The platform authority first requires a valid platform session, then checks configured admin principals.
- Admin principals reuse the existing Gateway configuration:
  - `MASANAWA_ADMIN_PRINCIPALS`
  - `MASANAWA_ADMIN_USER_IDS`
  - `MASANAWA_ADMIN_EMAILS`.
- User id, normalized email, or configured phone may match.
- A normal valid customer session without configured admin membership receives 403.
- No new admin-token/auth subsystem was invented.

### Canonical replay safety alignment
Global safety enforcement uses replay `recording_id` as the replay target id.

When a successful enforcement write produces:
- target kind = `replay`; and
- visibility = `blocked`;

the safety replay bridge:
1. resolves `talks.replay_sessions` by tenant + `recording_id`;
2. validates the canonical replay session;
3. applies the existing `@masanawa/agents` `platform_block` transition;
4. persists the replay state with revision CAS;
5. retries boundedly on concurrent revision change;
6. treats already-blocked replay state as idempotent success.

Restricted enforcement does **not** force replay canonical state to blocked.

If the replay row does not exist, the durable safety enforcement remains authoritative and public access stays fail-closed through the already-merged safety filters.

## Tests

Focused tests cover:
- ordinary customer session cannot act as platform safety admin;
- configured admin user id is authorized;
- admin email matching is case-normalized;
- recording-id lookup maps to canonical replay `platform_block`;
- already-blocked replay transition is idempotent;
- missing replay row is tolerated;
- replay CAS conflict is re-read/retried;
- blocked replay enforcement triggers canonical replay synchronization;
- restricted replay enforcement does not trigger canonical block.

## Verification

- GitHub reports PR #377 mergeable.
- Foundation CI run `37614067755`, job `112768059681`, failed before any workflow step.
- GitHub returned an empty step list, matching the repository-wide zero-step runner/service-startup failure pattern.
- No branch-specific typecheck/test/build failure was surfaced.
- No production admin principal, database migration, or environment configuration was changed from this window.

## Remaining client/admin work

Backend safety authority is now complete and enforceable. Independent UI lanes may add:
- Report actions on Talk/replay/comment/profile/persona surfaces;
- viewer Block/Mute profile controls;
- admin safety queue/enforcement screens.

Those clients must call these canonical routes rather than implementing local-only hiding or client-side moderation authority.

**Implementation status:** complete for Talk safety Gateway composition and canonical replay blocking.  
**Claim status:** handoff-ready and approved for merge.
