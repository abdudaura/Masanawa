# Gateway channel linking service — Production Task 100 completion seam

Owner/window: ChatGPT continuation window / 2026-10-06
Lease acquired under the merged five-minute stale-claim rule.
Branch: `work/channel-link-gateway-service-20261006`
Base: PR #313 head `30142daf0d08682a44c1c82354745c01835b0914`

## Reclaimed stale prerequisite

- PR #308 proof-backed channel subject resolution

The resolver source is preserved without rewriting the stale branch.

## Exact owned paths

- `docs/workstreams/channel-link-gateway-service-20261006.md`
- `packages/identity/src/channel-identity-resolution.ts`
- `packages/identity/src/index.ts`
- `services/gateway/src/channel_linking.ts`
- `services/gateway/src/channel_linking.test.ts`

## Explicitly excluded

- shared Gateway router/composition files
- WhatsApp/Telegram webhook transport adapters
- mobile/APK
- production environment/credentials
- SMS/message delivery of the one-time link secret

## Acceptance

- platform-authenticated User may issue a challenge only for an active matching ChannelAccount;
- Gateway generates the one-time high-entropy secret; only the durable hash is persisted;
- transport-authenticated channel subject may verify only within exact Tenant/account/channel/subject authority;
- verification creates or reuses one pending binding and activates it with the exact proof;
- exact verified retry returns the same active binding;
- binding owned by another User, revoked binding, account mismatch, or transport-scope mismatch fails closed;
- proof-backed subject resolution returns the canonical User only after activation.

State: IMPLEMENTED / VERIFICATION PENDING.

## Completed

- preserves stale proof-backed channel subject resolver on the durable channel lineage;
- platform-authenticated User can issue only against an active exact ChannelAccount;
- Gateway generates a one-time high-entropy secret and persists only the durable challenge hash;
- exact issue retry returns `already-issued` without minting a second secret;
- transport-authenticated verification must match exact account/channel/subject and challenge Tenant scope;
- successful verification creates/reuses one pending binding and activates it with exact challenge proof;
- exact verified retry returns the same active binding without duplicate activation;
- active binding proof mismatch, revoked binding, foreign identity binding and unavailable account fail closed;
- proof-backed resolver returns canonical User only after activation.

Router/transport wiring remains intentionally separate.

Implementation head before handoff: `18fb2795acf6f1768c9ef2fb2fded4e8508724f7`.

Last update: 2026-10-06.
