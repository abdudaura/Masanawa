# External MCP/A2A protocol bridge pattern — Task 141

Owner/window: current ChatGPT continuation window — Task 141
Branch: `work/plugin-protocol-bridge-20261006`
Base SHA: `4b8fdc62b4811cf6750acc039a26956a3ce736a4` (Task 140 PR #269 exact head)
Production task: 141 — external MCP/A2A/protocol bridge pattern where justified.

## Exact owned paths

- `packages/plugins/src/bridge.ts` (new)
- `tests/security/plugin-protocol-bridge.test.ts` (new)
- `docs/workstreams/plugin-protocol-bridge-20261006.md`

## Explicitly excluded/shared paths

- Task 139/140-owned `model.ts`, `security.ts`, `index.ts`;
- plugin loader/host process;
- Security credential storage/resolution;
- Tool/Provider registries and execution state;
- Gateway/Worker/Ops/mobile and PR #136;
- network proxy/egress implementation;
- migrations, package manifests, lockfile and production environment.

## Implementation boundary

- support only explicit remote protocol kinds `mcp` and `a2a`;
- bind each bridge to exact Plugin ID/version plus one declared `tool` or `provider` component;
- plugin installation must be `enabled` and exact-version matched;
- evaluate Task 140 capability grants first; every bridge-required capability must be in the effective granted set;
- endpoint must be clean HTTPS with no embedded username/password/fragment;
- reject loopback/private/link-local IP literals, localhost/.local names and obvious cloud-metadata hosts; runtime egress still must enforce DNS/IP allowlists;
- credentials are referenced only by canonical CredentialRefId, never plaintext;
- bridge requests carry canonical OperationId + idempotency key + bounded JSON payload;
- protocol adapter returns `succeeded`, `failed-before-effect` or `unknown`; thrown/ambiguous remote outcomes become `unknown` and never authorize blind retry;
- response evidence is bounded and cannot grant new Plugin capabilities or mutate manifest/grants.

State: CLAIMED. Implement the remote protocol bridge contract and security/recovery tests without editing Task 139/140 owners.
