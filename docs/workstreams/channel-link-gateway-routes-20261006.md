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
- no public identity-resolution endpoint is exposed; resolution remains internal to authenticated channel ingress;
- unknown/extra body fields fail closed;
- invalid channel/body/query values fail before service invocation;
- route layer never logs or persists the one-time secret.

State: IMPLEMENTED / VERIFICATION PENDING.

## Completed

- adds POST `/v1/channels/link/challenges` for platform-authenticated challenge issue;
- adds POST `/v1/channels/link/challenges/:requestId/verify` for transport-authenticated possession verification;
- strict body whitelists reject client-selected Tenant/User authority fields and unknown fields;
- invalid channel, identifier and secret shapes fail before service invocation;
- authorization header is forwarded only to issue; transport evidence is explicit on verify;
- no public identity-resolution endpoint is registered;
- focused Fastify inject tests cover forwarding and fail-closed validation.

Implementation head before handoff: `563f5a1b8a56b891584644c0b91cfcfe045852de`.

Last update: 2026-10-06.
