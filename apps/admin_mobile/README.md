# Masanawa Admin Mobile

Masanawa Admin is a separately installable Android-first Flutter control plane for managing the Masanawa platform from a phone or tablet. It is intentionally independent of the customer app.

Android application id: `ng.masanawa.admin`.

## Current control areas

- Overview — Ops readiness plus platform-wide operational counts.
- Admin Agents — real Gateway conversations with explicitly delegated Characters such as Gwani; delegation is Character-, tenant-, capability- and risk-scoped.
- Decision Center — JEV architecture and shadow-first decision governance. JEV is a typed decision model, not an Agent and never receives admin authority.
- Users — tenant-scoped identity/relationship counts, lifecycle filters and privacy-safe relationship drill-downs; lifecycle mutation is intentionally read-only until Identity exposes a canonical state-transition command.
- Agents — discover all canonical Characters, show ownership kind, configure first presentation, edit presentation/visibility/order and assign Skills.
- Skills — catalog and readiness.
- Runtime — recent AgentRuns, failures, trace correlation and bounded state filtering.
- Commerce — full immutable-revision Offer create/edit/enable administration with SkillVersion, pricing, commission and region validation; fulfillments and immutable ledger activity.
- Operations — consequential Operations and reconciliation cases, bounded diagnostics and safe external-receipt drill-down.
- Providers — encrypted credential metadata and canonical revocation only; never plaintext/ciphertext.
- System — Memory/extraction health, inbox/outbox recovery queues, Worlds and approval metadata.
- Modules — readiness map for Channels, Devices, Workflows, Social/Studio, Plugins and Agent Phone as their canonical contracts land.
- Audit — security-safe audit metadata.

See `docs/ADMIN-CONTROL-PLANE.md` for the complete capability and dependency matrix.

## Security

The app never talks directly to PostgreSQL/Supabase. All data is served through tenant-scoped Ops capabilities. Provider secret material and sensitive event payloads are not projected to the app.

Production login now uses the same canonical Masanawa PlatformSession as the customer app: email/phone OTP at the Gateway, secure access/refresh token storage, startup refresh, logout revocation, and automatic access-token refresh. Ops independently authorizes the resolved session against `MASANAWA_OPS_ADMIN_GRANTS_JSON`; a normal customer session has no admin authority unless its tenant plus User ID, verified email, or verified phone is explicitly granted the requested capability. The legacy bootstrap token remains an emergency fallback only.

## Run

The Ops endpoint and customer-auth Gateway are both deliberate build inputs:

```bash
flutter run \
  --dart-define=ADMIN_BASE_URL=https://your-ops-host \
  --dart-define=ADMIN_AUTH_BASE_URL=https://your-gateway-host
```

Configure Ops with a tenant-scoped grant, for example:

```json
[
  {
    "tenantId": "tenant_...",
    "email": "operator@example.com",
    "capabilities": ["*"]
  }
]
```

Set that JSON as `MASANAWA_OPS_ADMIN_GRANTS_JSON`. A grant must contain exactly one selector: `userId`, verified `email`, or verified `phone`. Use explicit capability names instead of `"*"` for least-privilege operators. No admin credential is committed to the repository.


## Conversational administration

The intended control path is:

1. the signed-in operator talks to Gwani;
2. Gwani proposes an explicit admin action;
3. JEV may classify bounded questions such as ambiguity, risk, escalation or evidence need, but it does not authorize anything;
4. Ops intersects the operator's capability with Gwani's delegated capability and the action risk class;
5. delegated read-only actions may execute through the canonical admin service;
6. writes return `approval-required` and do not execute until the governed approval path is satisfied;
7. canonical command/Operation/provider/reconciliation evidence is returned to Gwani for explanation.

The current branch includes the Ops admin-action broker for safe read actions and write proposals. A Gateway Tool adapter still needs to be wired after the canonical Decisions/JEV and approval contracts are integrated; the model is never allowed to bypass this broker.
