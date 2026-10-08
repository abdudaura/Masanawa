# R12 disabled-account write gates integration

- Owner: ChatGPT integration 2026-10-08 Africa/Lagos.
- Branch: `work/r12-disabled-guards-main-integration-20261008`; canonical base `c9e084c92ae729cc52dd1e78d622e5df0352e56c` includes deletion-intake #424 and compiler repair #427.
- Recovered stale stack PR #423 head `090e90c1b39934ca4cb4d9121164e8883890b61f`, last updated >5 minutes ago.
- Owned source paths: the seven exact changed paths in #423 only, plus this handoff.
- Reviewer verified no collision with modified canonical files after the old #416 base. Integrate only guards for session issuance, channel re-link and mobile push registration and related tests.
- Still no automatic revocation composition, financial settlement clearance, erase worker or provider erasure; account deletion remains pending until authoritative completion.
- Source-only integration; PostgreSQL, gateway and real-device tests not executed due CI runner allocation failures.

## Source integrity and safety check

- Integration commit `884d6311` copied all seven exact #423 changed blob SHAs onto latest main, preserving the existing R12 #424/#427 and R18 code.
- Verified canonical `identity.users.state` schema uses `active`, `disabled`, `archived`, matching the guard. User row `FOR SHARE` locks serialize newly issued sessions/channel links/push registrations against the revoker's UPDATE lock.
- The R12 irreversible deletion worker is still absent; merging guards adds defenses without enabling data destruction. Tests for concurrent write/revocation were authored upstream but not executed here.
- Active R09, R10, R11 branches were not edited. CI, Postgres and device gates remain open.
