# U29 – customer support and payment uncertainty (claim)

**Status:** ACTIVE, source implementation in progress; not verified, not deployable. 2026-10-08T17:57:00+01:00. Owner window GPT-6; five-minute exact-path lease subject to fresh revalidation by other windows.

**Main base:** `5e758673ae91082520b21b3153da53791ae2cbf3`. **Branch:** `work/u29-real-customer-support-20261008-gpt6`.

**Owned paths:** `services/gateway/src/customer_support/**`, `apps/mobile/lib/src/customer_support/**`, `packages/**` only if a uniquely named support package is necessary, `docs/workstreams/u29-real-customer-support-20261008.md`, isolated test files under these roots. Shared Gateway `app.ts`/`main.ts`, migrations registry, finance authorities, Flutter root router, Firebase and R15 report routes are **not claimed**. No source changes outside these roots without coordination.

**Depends on:** platform customer session authorizer, verified transaction status/readback, database migration integration, actual support ticket sink. Implement only consented customer support; never auto-approve refunds/chargebacks or retry financial payments.

**Verification:** pending; source/test checks and SHA-specific handoff to follow. Draft/unmerged PR only.
