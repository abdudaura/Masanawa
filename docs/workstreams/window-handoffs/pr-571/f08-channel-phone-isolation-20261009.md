# F08/R15 — channel phone evidence and linked-principal isolation (2026-10-09)

**Status: IMPLEMENTED_UNVERIFIED (bounded security slice); F08 overall remains PARTIAL_IMPLEMENTATION.**
**Source main/base SHA:** `5e758673ae91082520b21b3153da53791ae2cbf3`
**First source checkpoint SHA:** `c075724e9f4fadc512dbdc50c84ff8afc41dab34`
**Regression test checkpoint SHA:** `4ea22b70c397164d015201fcec61ec92ca914bdd`
**Branch:** `work/f08-channel-phone-cache-isolation-20261009-gpt6`
**Draft PR:** see branch pull request; use its latest head SHA when integrating.

## Ownership and collision check

Claim recorded on coordination branch `factory/claims` in `.factory/leases.json` as `gpt6-f08-channel-phone-isolation-20261009` before source edits. Exact owned paths:

- `services/gateway/src/customer_channel_bridge.ts`
- `services/gateway/src/customer_channel_bridge.test.ts`
- `docs/workstreams/f08-channel-phone-isolation-20261009.md`

Inspected latest main, active U/F drafts, and changed-file lists for R15 webhook security #451, R15 provider-size safety #488, and U26 channel linking #515. Those drafts own `customer_channel_routes.ts` or separate channel-linking paths; do not copy, replace, or merge their competing source here. Existing CI issue #457, Firebase #461, Work #497 and shared Gateway composition remain untouched.

## Confirmed source behavior and correction

The original bridge retained `channel:externalUserId -> normalized phone` indefinitely in a process-wide Map. A later Telegram message without a verified contact reused that prior phone during short-lived internal session setup, consuming stale personal data. A new contact resolving to *another* person could override the durable channel link's user identity when issuing a session.

The bridge now passes an optional normalized phone from **only the current provider message** into both the navigation and conversation session paths, without a process-wide cache. A found platform profile is rejected with `channels.link_identity_mismatch` unless both tenant and user match the durable, server-side channel link. If there is no phone evidence in that message, the original fallback link-bound synthetic profile is used, without phone lookup. Existing provider-signed ingress, de-duplication, session revocation, financial authority, and messaging APIs were not modified.

## Verification evidence (separate source checks from runtime tests)

- **PASS_STATIC:** GitHub connector readback of committed source and tests, 2026-10-09; nine bounded predicates passed: cache removed, no unbounded Map, linked-principal refusal, phone lookup gated on this message, both call paths pass the current phone, and both new test cases present. This is *not* TypeScript or runtime test execution.
- **NOT_RUN:** Two new Vitest cases: (1) Telegram shared contact resolving to another linked account fails before `issueSession`, while recording a failed inbound message; (2) second Telegram message lacking contact data never reuses the earlier phone but stays on the established link user.
- **BLOCKED:** No local repository checkout/working dependency installation in the isolated runtime; outbound github.com DNS failed and local Node is v22 while package requires Node 24/pnpm 12. GitHub Actions incident #457 has previously reported zero-step failures, not application failures. Do not infer current PR CI result without inspecting its actual run.
- **NOT_RUN:** Real provider-signed WhatsApp/Telegram payloads, authenticated PostgreSQL-backed link/user/session tests, two-account concurrency, tenant isolation, load, provider failure, phone change/unlink, real device flows and deployment.

Exact reviewer commands after dependency setup:

```bash
pnpm install --frozen-lockfile
pnpm exec vitest run services/gateway/src/customer_channel_bridge.test.ts
pnpm --filter @masanawa/gateway-service typecheck
pnpm test:ci
```

## Integration and recovery handoff

1. Review this tiny patch against fresh main and R15 #451/#488 + U26 #515. Preserve the stricter Telegram private sender and bounded HTTP/media response changes from those drafts.
2. Execute the focused tests and typecheck with Node 24 and pnpm 12, then two distinct platform identities on disposable PostgreSQL. Verify changed verified Telegram contact cannot gain the other person's session and no phone is cached across messages.
3. Review the **pre-existing** channel-link fallback that issues a short-lived synthetic identity when no phone is provided. This PR preserves that contract; server-side revoked/disabled account and link status still need independent qualification.
4. Run legitimate messages, retries, delivered acknowledgments, recipient/tenant isolation, opted-in channel unlink and outbound response checks. Review financial quote approval separately; this change grants no new financial permission.
5. Keep PR **DRAFT/UNMERGED** pending executable checks and final Work integration. No production configuration, paid services, database migration, root Flutter router or Firebase files changed.

**Trace:** F08/R15 customer identity privacy; U26 channel linking dependent on durable link ownership; R16 release acceptance and issue #457 CI. This focused slice is not F08 or Masanawa production acceptance.
