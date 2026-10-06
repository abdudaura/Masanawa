# Internet Cafe Gateway projection seam

Status: CLAIMED — 2026-10-06
Branch: `work/internet-cafe-gateway-projection-20261006`
Base: PR #136 production integration head

Owned paths only:
- `services/gateway/src/internet_cafe_room.ts`
- `services/gateway/src/internet_cafe_room.test.ts`
- `docs/workstreams/internet-cafe-gateway-projection-20261006.md`

No edits to Gateway `app.ts`/`main.ts`, mobile router/chat/transport, Billing/provider code, Skills implementation, Commerce/Event migrations, production environment or APK paths.

Goal:
- produce the exact Lane I Internet Cafe mobile projection;
- keep Data/Airtime/Electricity/TV bound to opaque canonical billing references supplied by shared composition;
- bind applications/business/documents/online-help services to opaque admitted Skill references supplied by shared composition;
- provide server-owned quick starts, task intake and optional selection projections;
- never invent price, provider success, receipt or financial state.

The #136 owner mounts the route and resolves opaque references through canonical Billing/Skills.