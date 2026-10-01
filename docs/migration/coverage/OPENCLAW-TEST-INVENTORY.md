# OpenClaw consequential-invariant test inventory

Pinned donor revision: `openclaw/openclaw@83e4755b55e8864e48348f3eb2364ee3e5f0fb54`.

Status: **COMPLETE — 69/69 retained OpenClaw consequential behaviour rows have direct pinned test evidence.**

This file is the Phase 0B proof index for the normalized OpenClaw behaviour rows in `docs/migration/BEHAVIOUR-LEDGER.md`. It does not claim that Masanawa will reuse OpenClaw's storage or runtime authority. It proves that every retained consequential invariant was checked against concrete executable tests at the pinned donor revision before classification.

Rules used for this inventory:

- a documentation statement alone is not accepted as the closure proof for a consequential invariant;
- every row below names at least one concrete test file at the pinned revision;
- where the invariant spans layers, the row names tests on both sides of the boundary rather than treating a unit test as end-to-end proof;
- provider/channel/native IDs remain external references and none of these tests override Masanawa canonical ownership decisions;
- the upstream `scripts/lib/ci-proof-test-inventory.mts` was also inspected as an independent map of protected runtime proof families, but wildcard membership in that script is not substituted for the exact files below.

| Behaviour | Direct pinned test evidence | What the tests prove for adoption |
|---|---|---|
| B-OCL-001 | `src/channels/message/ingress-monitor.test.ts`; `extensions/slack/src/monitor/ingress.test.ts` | durable admission precedes provider acknowledgement/cursor progress |
| B-OCL-002 | `src/channels/message/ingress-monitor.test.ts`; `src/plugin-sdk/channel-ingress-runtime.test.ts` | completed claim/replay state rejects late duplicate delivery instead of re-executing |
| B-OCL-003 | `src/channels/message/ingress-monitor.restart-drain.test.ts` | restart drains and reopens the same durable ingress ownership path |
| B-OCL-004 | `src/plugin-sdk/ingress-effect-once.test.ts` | stable effect claims execute once, coordinate concurrent callers and fail closed on persistence ambiguity |
| B-OCL-005 | `src/auto-reply/reply/channel-run-admission.test.ts`; `src/channels/message-access/operator-authority.test.ts` | prepared async authority is invalidated when the owning binding/policy generation retires |
| B-OCL-006 | `src/gateway/server-methods/device-pair-setup.test.ts`; `src/gateway/server/ws-connection/connect-hello.setup-completion.test.ts`; `packages/gateway-protocol/src/schema/devices.test.ts` | exact setupId reconciliation preserves deliveryUncertain rather than guessing credential success |
| B-OCL-007 | `src/gateway/server.device-token-rotate-authz.test.ts`; `src/cli/devices-cli.test.ts` | self rotation returns in-band replacement while cross-device/admin rotation withholds bearer material and keeps scopes bounded |
| B-OCL-008 | `src/gateway/server-methods/nodes.invoke-wake.test.ts` | retry is limited to proven readiness recovery and stops after progress/authority/pairing ambiguity |
| B-OCL-009 | `src/gateway/exec-approval-manager.lifetime.test.ts` | manager/observer retirement does not manufacture a durable approval verdict |
| B-OCL-010 | `src/gateway/operator-approval-store.worker.test.ts` | approval mutations revalidate current authority after worker/FIFO delay before commit |
| B-OCL-011 | `src/gateway/operator-approval-store.worker.test.ts`; `src/gateway/operator-approval-receipts.test.ts` | only a committed winning approval produces the receipt and first durable answer remains canonical |
| B-OCL-012 | `src/agents/tools/sessions-access.test.ts`; `src/channels/message-access/operator-authority.test.ts` | session/context visibility and linked identity remain separate from operator/tool authority |
| B-OCL-013 | `src/skills/library/service.test.ts` | skill revisions include immutable bundle bytes/metadata; identical save no-ops and stale writer conflicts |
| B-OCL-014 | `src/skills/library/service.test.ts`; `src/auto-reply/reply/session.test.ts` | existing session/library selections retain exact pinned revision after later update/removal |
| B-OCL-015 | `src/skills/library/service.test.ts`; `src/skills/runtime/remote-skills.test.ts` | skill visibility/source selection does not manufacture tool, credential or node execution authority |
| B-OCL-016 | `src/agents/runtime-plan/prepare-auth.test.ts` | route preference orders already-eligible credentials and fails closed for all-cooldown/incompatible candidates |
| B-OCL-017 | `src/agents/embedded-agent-runner/run/failover-retry-controller.test.ts`; `packages/ai/src/providers/anthropic.test.ts`; `packages/ai/src/transports/openai-completions-transport.test.ts` | host runner owns bounded retry/failover while provider SDK retry is pinned to zero |
| B-OCL-018 | `src/secrets/model-egress.test.ts` | secret sentinel is destination-bound, split-chunk output is redacted and cancellation/failure revokes egress |
| B-OCL-019 | `extensions/memory-core/src/short-term-promotion.test.ts`; `extensions/memory-core/src/dreaming-consolidation.test.ts` | external/unknown/system/automation evidence is conservatively excluded from curated promotion |
| B-OCL-020 | `extensions/memory-core/src/short-term-promotion.test.ts`; `extensions/memory-core/src/dreaming-phases.test.ts` | recalled/dreaming/network-tainted evidence is prevented from recursive or unsafe promotion |
| B-OCL-021 | `extensions/memory-core/src/dreaming-consolidation.test.ts` | consolidation detects content/provenance/ranking races and falls back without clobbering newer memory |
| B-OCL-022 | `src/cron/service/run-recovery.lifecycle.test.ts`; `src/cron/service/run-reservation-settlement.test.ts` | lifecycle generation plus durable run reservation fences stale queued work across restart |
| B-OCL-023 | `src/cron/service/timer.regression.test.ts`; `src/cron/service/run-recovery.lifecycle.test.ts` | restart catch-up is bounded/rechecked and does not create an unbounded replay burst |
| B-OCL-024 | `src/infra/net/fetch-guard.ssrf.test.ts` | DNS/IP/origin/redirect policy is re-evaluated and private/metadata targets fail closed |
| B-OCL-025 | `extensions/diagnostics-otel/src/service.test.ts`; `extensions/diagnostics-otel/src/service.otlp-export.test.ts`; `test/gateway-rpc-exporters.test.ts` | raw diagnostic content requires explicit capture; trace context propagates provenance without becoming authorization |
| B-OCL-026 | `src/auto-reply/reply/commands-diagnostics.test.ts`; `src/logging/diagnostic-stability-bundle.test.ts` | diagnostics require owner approval/private routing and exported bundles redact credentials, IDs and private paths |
| B-OCL-027 | `src/gateway/node-command-policy.test.ts`; `apps/shared/OpenClawKit/Tests/OpenClawKitTests/GatewayNodeSessionTests.swift` | declared capabilities remain support claims intersected with server authority rather than grants |
| B-OCL-028 | `src/gateway/server.plugin-http-auth.test.ts`; `src/gateway/server-methods/server-methods.test.ts` | method/base scope and resource/reserved-surface checks compose with the stricter authorization winning |
| B-OCL-029 | `src/gateway/worker-environments/worker-turn-rpc.test.ts`; `src/worker/worker.runtime.test.ts` | closed worker credentials are fenced by bundle/session/owner epoch/expiry and transcript sequence/CAS |
| B-OCL-030 | `src/channels/plugins/binding-routing.test.ts`; `extensions/telegram/src/channel.gateway.test.ts` | binding route selection occurs inside an already-authorized channel/account context and cannot grant sender access |
| B-OCL-031 | `src/channels/plugins/binding-routing.test.ts`; `src/agents/harness/selection.test.ts` | explicit multi-agent ownership ambiguity returns selection-required instead of fallback |
| B-OCL-032 | `src/agents/subagents/spawn/acp-spawn.authority.test.ts`; `src/gateway/server-methods/sessions-create.child-custody.test.ts` | child/ACP creation and completion retain requester/parent lineage and delegated authority |
| B-OCL-033 | `ui/src/pages/chat/chat-send.test.ts`; `src/infra/outbound/deliver.queue-integration.test.ts` | uncertain/pre-ack retry reuses the same durable send/idempotency identity rather than issuing a fresh operation |
| B-OCL-034 | `src/infra/outbound/deliver.custody.integration.test.ts`; `src/agents/command/delivery.custody.integration.test.ts` | queued/partial/unknown/rejected outcomes retain distinct custody and receipt evidence |
| B-OCL-035 | `src/gateway/server-methods/session-catalog-list-admission.test.ts`; `src/gateway/server-methods/session-catalog-provider-access.test.ts`; `src/gateway/server-methods/session-catalog-list-lifetime.test.ts` | catalog fallback is bounded and every async projection rechecks current visibility |
| B-OCL-036 | `src/gateway/server-methods/session-catalog-list-admission.test.ts`; `src/gateway/server-methods/session-catalog-provider-access.test.ts` | external session import remains owner-scoped, bounded and idempotent by source identity |
| B-OCL-037 | `src/gateway/server-methods/chat-send-attachments.owner.test.ts`; `src/gateway/server-methods/chat-send-attachments.cancel.test.ts` | attachment staging preserves owner/workspace custody through cancellation and cleanup |
| B-OCL-038 | `src/infra/clawhub-skill-security.test.ts`; `src/gateway/server-methods/skills.clawhub.test.ts` | ClawHub verdict correlation is exact on publisher/version and concurrent identical install is deduplicated |
| B-OCL-039 | `src/skills/lifecycle/source-install.test.ts` | skill source intake validates bundle/path/link/size, sanitizes Git execution and records resolved provenance |
| B-OCL-040 | `src/skills/runtime/remote-skills.test.ts`; `src/skills/runtime/remote-reconciliation.test.ts` | remote skills are current-node projections removed on disconnect/generation loss with deterministic collision handling |
| B-OCL-041 | `src/skills/runtime/remote-skills.test.ts` | remote skill metadata cannot directly dispatch a tool around canonical node/tool policy |
| B-OCL-042 | `src/plugin-sdk/channel-lifecycle.test.ts`; `extensions/telegram/src/channel.gateway.test.ts`; `extensions/matrix/src/matrix/monitor/sync-lifecycle.test.ts`; `extensions/imessage/src/monitor.watch-subscribe-retry.test.ts` | account startup/drain exposes typed active/recoverable/terminal/intentional-stop lifecycle |
| B-OCL-043 | `src/channels/typing-lifecycle.test.ts`; `src/infra/heartbeat-runner.typing.test.ts` | typing keepalive has one owner and clears once across success/failure/restart |
| B-OCL-044 | `extensions/whatsapp/src/channel.status.test.ts`; `src/plugin-sdk/channel-outbound.reply-pipeline.test.ts` | media roots and physical sends are host-derived/current-owner checked at I/O |
| B-OCL-045 | `extensions/whatsapp/src/inbound/durable-receive.test.ts` | WhatsApp keeps durable constituent claims through debounce/adoption and same-chat ordering |
| B-OCL-046 | `extensions/telegram/src/channel.gateway.test.ts`; `extensions/telegram/src/telegram-ingress-drain.test.ts` | Telegram blocks bad credentials/ambiguous ownership and keeps retry classes distinct |
| B-OCL-047 | `extensions/discord/src/monitor/message-handler.ingress-recovery.test.ts`; `extensions/discord/src/monitor/thread-bindings.authority.test.ts` | Discord replacement/cancellation retains retry facts and thread mutation is owner-fenced |
| B-OCL-048 | `extensions/slack/src/monitor/ingress.test.ts`; `extensions/slack/src/monitor/message-handler/prepare.route-owner-admission.test.ts` | Slack durable admission precedes ack, restart recovers once, delayed redelivery tombstones and route owner is rechecked |
| B-OCL-049 | `extensions/signal/src/monitor/event-handler.ingress-lifecycle.test.ts` | Signal merged turns settle every constituent durable claim |
| B-OCL-050 | `extensions/matrix/src/matrix/monitor/sync-lifecycle.test.ts` | Matrix preserves fatal sync cause instead of downgrading it during intentional shutdown |
| B-OCL-051 | `extensions/line/src/webhook-spool.test.ts`; `extensions/line/src/monitor.lifecycle.test.ts` | LINE signature/account routing, durable spool, bounded retry and post-effect dead-letter are explicit |
| B-OCL-052 | `extensions/imessage/src/monitor.watch-subscribe-retry.test.ts` | iMessage recovery is bounded, terminal permissions are distinct and diagnostics are redacted |
| B-OCL-053 | `src/gateway/node-command-policy.test.ts`; `src/gateway/node-registry-policy.test.ts` | effective node command authority is the intersection of declaration, approved pairing surface, server/plugin policy and device support |
| B-OCL-054 | `src/gateway/device-scope-upgrade.test.ts`; `src/gateway/node-command-policy.test.ts` | capability/command expansion remains pending until explicit approval and deny wins |
| B-OCL-055 | `src/gateway/node-registry.test.ts`; `src/gateway/node-connect-reconcile.test.ts`; `src/gateway/server-methods/nodes.invoke-wake.test.ts` | dispatch rechecks exact current pairing generation and active connection before I/O |
| B-OCL-056 | `apps/android/app/src/test/java/ai/openclaw/app/gateway/GatewaySessionReconnectTest.kt`; `apps/shared/OpenClawKit/Tests/OpenClawKitTests/GatewayNodeSessionTests.swift`; `apps/macos/Tests/OpenClawIPCTests/MacNodeModeCoordinatorTests.swift` | route replacement/disconnect fences queued native invokes and stale results |
| B-OCL-057 | `apps/android/app/src/test/java/ai/openclaw/app/gateway/GatewaySessionReconnectTest.kt` | sequence gaps trigger reconnect without admitting the gap-triggering command/event |
| B-OCL-058 | `apps/android/app/src/test/java/ai/openclaw/app/node/ConnectionManagerTest.kt`; `apps/android/app/src/test/java/ai/openclaw/app/node/InvokeDispatcherTest.kt` | only the focused Android Gateway owns device capability dispatch |
| B-OCL-059 | `apps/macos/Tests/OpenClawIPCTests/MacNodeModeCoordinatorTests.swift` | macOS native app capabilities stay separate from CLI worker surface and successor route waits for revocation |
| B-OCL-060 | `apps/android/app/src/test/java/ai/openclaw/app/GatewayBootstrapAuthTest.kt`; `apps/ios/Tests/GatewayConnectionControllerTests.swift`; `apps/ios/Tests/GatewayOperatorFleetTests.swift` | native endpoint/token/TLS/settings state supports reconnect but does not replace server-side canonical authorization |
| B-OCL-061 | `src/skills/workshop/service.test.ts`; `src/gateway/server-methods/skills.proposals.test.ts` | Workshop create/update/revise yields pending immutable proposal generations; apply/reject/quarantine are separate operations |
| B-OCL-062 | `src/skills/workshop/service.test.ts` | apply checks target/support baseline and ambiguous proposal names require exact identity |
| B-OCL-063 | `src/skills/workshop/service.test.ts`; `src/skills/workshop/experience-review.apply.test.ts` | apply records rollback/recovery facts and interrupted/tampered/cross-owner recovery fails closed |
| B-OCL-064 | `src/skills/workshop/service.test.ts`; `src/skills/loading/skill-path-containment.test.ts` | unsafe path/link/executable/credential/support content is rejected or quarantined before publication |
| B-OCL-065 | `src/agents/tools/skill-workshop-tool.review.test.ts` | autonomous review is mutation-budgeted and stale prepared patch authority is invalidated |
| B-OCL-066 | `src/gateway/server-cron-skill-review-jobs.test.ts` | collection review converges one declaration per agent and cancels before final write after authority revocation |
| B-OCL-067 | `src/skills/workshop/experience-review.apply.test.ts` | switching autonomous mode does not retroactively auto-apply a manual proposal |
| B-OCL-068 | `src/skills/loading/workspace-skill-snapshot.test.ts` | Custodian packaged skills are absent from all non-owner discovery/prompt/sandbox surfaces and ambiguous owner exposes none |
| B-OCL-069 | `src/skills/loading/workspace-skill-snapshot.test.ts`; `src/skills/loading/skill-path-containment.test.ts` | Custodian loading still obeys filters/containment and cannot grant tools/credentials or mutate package-owned content |

## Closure result

- Behaviour rows inventoried: **69**
- Behaviour rows with exact test-file evidence: **69**
- Architecture-only consequential rows remaining: **0**
- Wildcard-only consequential rows remaining: **0**
- Donor revision ambiguity: **0**

The remaining OpenClaw Phase 0B closure task after this file is repository-wide descendant reconciliation: prove that every production family discovered by the repository/package/plugin/native inventory is either represented by an OpenClaw coverage section/normalized ledger row or explicitly classified as non-authoritative/support-only. Only after that reconciliation reaches zero unexplained production families may `OPENCLAW.md` move from ACTIVE/PARTIAL to COVERED.
