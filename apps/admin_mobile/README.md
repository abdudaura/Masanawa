# Masanawa Admin Mobile

Masanawa Admin is a separately installable Android-first Flutter control plane for managing the Masanawa platform from a phone or tablet. It is intentionally independent of the customer app.

Android application id: `ng.masanawa.admin`.

## Current control areas

- Overview — Ops readiness plus platform-wide operational counts.
- Users — tenant-scoped identity/relationship counts; lifecycle mutation is intentionally read-only until Identity exposes a canonical state-transition command.
- Agents — discover all canonical Characters, configure first presentation, edit presentation/visibility/order and assign Skills.
- Skills — catalog and readiness.
- Runtime — recent AgentRuns, failures and trace correlation.
- Commerce — Offers, fulfillments and ledger activity.
- Operations — consequential Operations and reconciliation cases.
- Providers — encrypted credential metadata and canonical revocation only; never plaintext/ciphertext.
- System — Memory/extraction health, inbox/outbox recovery queues, Worlds and approval metadata.
- Modules — readiness map for Channels, Devices, Workflows, Social/Studio, Plugins and Agent Phone as their canonical contracts land.
- Audit — security-safe audit metadata.

See `docs/ADMIN-CONTROL-PLANE.md` for the complete capability and dependency matrix.

## Security

The app never talks directly to PostgreSQL/Supabase. All data is served through tenant-scoped Ops capabilities. Provider secret material and sensitive event payloads are not projected to the app.

The current operator credential screen is bootstrap authentication. It stores the bearer credential using `flutter_secure_storage` and validates it against the protected `/v1/admin/summary` route. Production admin identity/roles remain a platform prerequisite.

## Run

The Ops endpoint is deliberately required; the admin app does not default to the customer Gateway.

```bash
flutter run --dart-define=ADMIN_BASE_URL=https://your-ops-host
```

No admin credential is committed to the repository.
