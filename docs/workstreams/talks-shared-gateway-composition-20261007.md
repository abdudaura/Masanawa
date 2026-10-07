# Talk shared Gateway composition — 2026-10-07

- **Owner/window:** current ChatGPT transformation window
- **Branch:** `work/talks-shared-gateway-composition-20261007`
- **Base SHA:** `25ef7be2cef9047c25696a30f5d918634a1e2f52`
- **Lane:** compose completed Direct Twin + Talk safety backends into real Gateway startup
- **Lease:** active

Owned:
- `services/gateway/src/app.ts`
- `services/gateway/src/main.ts`
- narrowly scoped Gateway startup/app tests required by these additions
- `services/gateway/src/talk_safety/platform_authority.ts`
- `services/gateway/src/talk_safety/platform_authority.test.ts`
- this handoff

Not owned:
- mobile UI
- Talk AI worker provider adapter
- replay/gift/domain internals
- migration contents
- Billing/Crypto/channels
- deployment credentials

Rules:
- Direct Twin customer routes use canonical platform customer-session auth.
- Safety report/block/mute use canonical customer-session auth.
- Global safety enforcement uses canonical customer session PLUS explicit configured safety-admin user allowlist.
- Empty/missing safety-admin allowlist fails closed for admin enforcement while leaving customer safety routes available.
- No static admin bearer token.
- All repository instances use canonical Gateway PostgreSQL pool.
- Existing Talk/Gift/Replay composition must remain untouched except additive wiring.

Status: implementing shared composition.
