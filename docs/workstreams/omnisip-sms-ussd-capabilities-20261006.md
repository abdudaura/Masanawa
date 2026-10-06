# OmniSIP SMS/USSD Device capabilities workstream

Owner/window: current ChatGPT continuation window — Task 128
Branch: `work/omnisip-sms-ussd-capabilities-20261006`
Base SHA: `481249d162405f5725ea3e54e395cb547afae273` (Task 125 PR #256 exact handoff head)
Task reference: `docs/PRODUCTION-MASTER-TASKS.md` — Task 128.
Architecture reference: `docs/AGENT-PHONE-EMBODIMENT.md`.
OmniSIP source evidence: `Baatiku/OmniSIP` commit `ff4084d7742a2008122549f19aee882f99906048`.

## Exact owned paths

- `adapters/devices/android/src/omnisip-messaging.ts` (new)
- `tests/contracts/omnisip-messaging-capabilities.test.ts` (new)
- `docs/workstreams/omnisip-sms-ussd-capabilities-20261006.md`

## Excluded/shared paths

- Task 124 runtime and Task 125 queue source;
- Task 126 OmniSIP voice provider branch/files;
- Task 127 call routing;
- canonical Device/Tool/Operation/Provider registries;
- OmniSIP repository source;
- incoming SMS channel/Gateway routing;
- Android manifests/permissions/package files;
- migrations, manifests, lockfile, production environment and PR #136.

## Implementation boundary

- expose SMS send and USSD execute as explicit-SIM Android Device capability executors compatible with Task 125;
- preflight only from injected runtime-qualified messaging status, never SDK/root/app-version inference;
- normalize E.164 SMS destination, bounded body and bounded USSD code;
- preserve canonical OperationId via Task 125 executor input and return OmniSIP request IDs only as evidence refs;
- asynchronous accepted SMS/USSD requests return `unknown`/reconciliation evidence until callback/status truth arrives;
- explicit pre-dispatch permission/SIM/capability denial returns `failed-before-effect`;
- thrown/ambiguous OmniSIP edge outcomes return `unknown`;
- no raw inbound SMS is promoted to Memory or routed to a Character here.

## Current state

CLAIMED. Implement the isolated SMS/USSD executor boundary and focused contract tests.
