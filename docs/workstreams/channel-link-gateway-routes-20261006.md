# Gateway channel linking routes — Production Task 100 completion seam

Owner/window: ChatGPT continuation window / 2026-10-06
Lease acquired under the merged five-minute stale-claim rule.
Branch: `work/channel-link-gateway-routes-20261006`
Base: PR #315 head `27607d5d35c6a2f25fe49ec9239f4c2897c76a64`

## Exact owned paths

- `docs/workstreams/channel-link-gateway-routes-20261006.md`
- `services/gateway/src/channel_linking_routes.ts`
- `services/gateway/src/channel_linking_routes.test.ts`

## Explicitly excluded

- shared Gateway router/composition files
- WhatsApp/Telegram webhook adapters
- production transport-authorizer implementation
- mobile/APK
- production environment/credentials

## Route acceptance

- authenticated User issue endpoint forwards authorization header and canonical request/account/channel fields;
- transport verify endpoint requires explicit transport evidence and subject;
- resolve endpoint requires exact Tenant/account/channel/subject query scope;
- unknown/extra body fields fail closed;
- invalid channel/body/query values fail before service invocation;
- route layer never logs or persists the one-time secret.

State: CLAIMED.

Last update: 2026-10-06.
