# Current-main financial integration — 2026-10-05

Owner/window: continuation of the Android production-readiness work, explicitly assigned by the user to keep working until the pulled/built app is functional without manual Developer tokens.

Branch: `work/integration-current-main-financial-20261005`
Base: current `main` after PR #132 canonical customer-session authentication.

Purpose:
- integrate the already-built billing, crypto, Flutterwave, NOWPayments and channel financial runtime onto current main;
- preserve the merged mobile shell, current `/agent/**` routes, creator surfaces, live voice, push and canonical PlatformSession auth;
- make one deployable Gateway lineage rather than forcing the APK to depend on the old divergent production branch.

Source/reference lineage:
- `work/billing-customer-journey-20261004` current head;
- its billing/crypto/provider/channel workstreams and existing live Railway settings.
The historical branch is reference-only and must never replace current main wholesale.

Owned integration paths:
- billing-specific Commerce models/migrations/repository/storage paths needed from the source lineage;
- `packages/providers/src/flutterwave-bills/**` and necessary provider exports/dependencies;
- `adapters/crypto/nowpayments/**` and necessary crypto exports/dependencies;
- financial/billing/checkout Gateway modules and focused tests;
- messaging channel adapter/ingress modules needed by the production Gateway, plus narrow export/dependency seams;
- deployment/runtime scripts directly required by the existing fixed-IP Flutterwave relay and financial qualification;
- shared `services/gateway/src/app.ts` and `services/gateway/src/main.ts` for composition only;
- shared package/postgres exports, package manifests and lockfile only when required by imported owned modules;
- server-side shell action execution seam only to preserve both `result.document` and `result.message`;
- this claim/handoff.

Non-ownership / preservation:
- do not replace or copy any `apps/mobile/**` file from the divergent source branch;
- do not replace current Agent/session/auth/creator/live-voice/push implementation with older `/v1/agent/**` or Alpha-token code;
- do not replace current `customer_auth.ts`, PlatformSession or relationship-authorizer work from PR #132 with older source copies;
- do not import unrelated historical Agent/Memory/World files merely because they differ;
- billing, crypto, creator Credits/Float and NGN custody remain separate canonical domains.

Integration contract:
1. The same canonical PlatformSession identity authorizes public Agent, creator, billing and financial operations.
2. Current mobile shell remains capable of rendering generic financial ShellDocuments/actions without product-specific APK rewrites.
3. Billing checkout action execution must surface both updated document and user-visible message/checkout URL.
4. Provider dispatch remains idempotent, exact-amount bound and reconciled; webhook/callback data is evidence, not settlement authority.
5. Crypto custody/conversion/payout capability remains fail-closed behind current provider/config qualification.
6. No production enablement is claimed merely because source integration succeeds; Railway deployment is performed only from this reconciled lineage and only after pre-deploy checks no longer fail.

Status: claim published before implementation.