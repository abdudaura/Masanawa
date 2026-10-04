# Mobile admin app — 2026-10-05

Owner/window: ChatGPT mobile admin app implementation, explicitly assigned by the user to derive a separate admin-facing Flutter app from the existing customer mobile app.

Branch: `work/mobile-admin-app-20261005`
Base: `24c8ed783cc2b4797e2c915a698b69ee997f3995`

Owned paths:
- `apps/admin_mobile/**`
- `docs/workstreams/mobile-admin-app.md`

Non-owned / read-only dependencies:
- `apps/mobile/**` is reference-only; no edits in this workstream.
- Gateway/Ops/shared contracts, migrations, billing, crypto, channels and customer authentication remain owned by their active workstreams.
- Existing `apps/ops/**` is reference-only.

Scope:
1. Create a separately installable Flutter admin app, not a second mode hidden inside the customer app.
2. Reuse only the approved Agent Blue identity/theme and minimal networking/auth foundations needed by admins.
3. Do not copy customer chat/media/commerce/creator UX into the admin binary.
4. Establish an admin information architecture for overview, users, agents, Skills, transactions, operations and settings.
5. Wire server reads only where an existing authorized contract is already available; otherwise use explicit unavailable/coming-online states rather than fake data.
6. Keep customer app behavior untouched.

Current step: bootstrap the independent Flutter app shell and admin navigation, then add typed admin API boundaries and initial operational screens.

Implementation status: in progress.
Verification status: pending.
Deployment status: not deployed.
