# Phase 0B Forensic Coverage — LiveKit Server

Pinned revision: livekit/livekit@7ef0cd014e950373acd789557099305716eea196

Status: COVERED AT PINNED REVISION

LiveKit Server is the selected realtime transport donor. Its responsibility ends at media transport, room/participant transport state, distributed placement, ingress/egress/TURN/SIP, and transport telemetry. Masanawa owns CharacterSession, PresenceSession identity, permissions, workflows, memory, world, commerce, and business truth.

## Descendant capability matrix

| Family | Implementation/test evidence | State treatment | A/B/C | Canonical destination | Acceptance/parity gate |
|---|---|---|---|---|---|
| SFU media forwarding | pkg/sfu/** including buffer, BWE, pacer, forwarder, receiver, stream allocator, RTP stats and tests | runtime media transport state | A/B | services/presence transport | media forwarding remains transport-only; packet loss, out-of-order and restart behavior observable and bounded |
| RTC room lifecycle | pkg/rtc/room.go, participant.go, transport.go, subscription manager and tests | TransportRoom/Participant/Track projections | A/B | services/presence | room admission limits enforced; participant/track updates ordered/versioned; reconnect/move never redefines Character/session identity |
| Track permissions | participant/track publication paths and tests | transport permission projection | A | services/presence + security adapter | disallowed publish source/type rejected before media publication |
| Subscription lifecycle | subscription manager, up/down track managers and tests | runtime subscription state | A/B | services/presence | subscription changes are idempotent/observable and do not mutate domain relationship permissions |
| Migration continuity | migration data cache and move-related RTC paths/tests | bounded D-RTC-052 | B | services/presence | migration buffer size/time bounded; stale/overflow behavior explicit; PresenceSession survives node move |
| RTP accounting | pkg/sfu/rtpstats/** tests | D-RTC-053 rolling telemetry | B | presence/telemetry | loss/out-of-order/duplicate/restart are distinguished and stale/pre-start packets cannot rewrite current baseline |
| Connection quality | pkg/sfu/connectionquality/** tests | rolling quality sample | B | telemetry | quality is transport evidence only; mute/no-packet semantics explicit |
| Bandwidth estimation/congestion | pkg/sfu/bwe/**, ccutils, streamallocator | ephemeral estimates | B | presence transport | estimator failure/degradation changes media allocation, not domain truth |
| Pacing/packetization | pkg/sfu/pacer/** tests | ephemeral send queues | B | presence transport | bounded queues and packet metadata handling; no unbounded growth |
| Data channels | pkg/sfu/datachannel/** + rtc data track tests | transport data stream state | B | presence/gateway | reliable/unreliable transport semantics only; message/domain truth remains above transport |
| Distributed routing | pkg/routing/** + selector tests | D-RTC-054 node/room placement | B | presence infrastructure | region/load routing relocates infrastructure without changing canonical session identity |
| Redis routing/state | redisrouter + service redis stores/tests | distributed transport coordination | B/C | presence infrastructure adapter | optional implementation; canonical domain state remains outside Redis transport records |
| TURN | pkg/service/turn*, turnquota* tests | transport edge/quota state | B | presence edge | TURN quota/admission bounded and independently observable |
| SIP | pkg/service/sip*, ioservice_sip*, redisstore_sip* tests | telephony transport state | B | presence telephony adapter | SIP call leg is transport projection; conversation/relationship state remains Masanawa-owned |
| Ingress/egress | pkg/service/ingress*, egress* | media edge job state | B/C | presence/media adapters | capability optional; long-running media jobs emit evidence but do not own workflow truth |
| WHIP | pkg/service/whipservice.go | transport session | B/C | presence adapter | optional ingress transport only |
| Agent-facing service hooks | pkg/agent/** + service agent files | worker/dispatch transport state | C/B | presence worker bridge | LiveKit Agents repos remain primary live-agent runtime donor; server hooks do not become agent framework |
| Auth/service admission | pkg/service/auth*, request limits/tests | transport/API admission | B | security + presence | service auth complements but never replaces platform account/tenant/relationship authorization |
| Telemetry | pkg/telemetry/**, pkg/metric/** | transport metrics | B | telemetry | redacted infrastructure observations only |
| Client configuration | pkg/clientconfiguration/** | client transport config | C/B | presence/client | config projection only |
| Server/config/deploy | cmd/**, pkg/config/**, deploy/** | deployment config | C/B | deploy/presence infra | operational recipes only |
| Tests | pkg/**/*_test.go + test/** | evidence | evidence | acceptance/parity | retain as behavioral evidence |

## File accounting

livekit-server-file-family-manifest.json accounts for all 429 pinned files with zero unresolved paths.

## Integration disposition

livekit-server-integration-disposition-manifest.json explicitly dispositions 26 edge/distributed integrations covering Redis, TURN, SIP, ingress, egress, WHIP and agent-facing service hooks.

## Canonical merge decision

Adopt LiveKit Server as the media-room infrastructure behind services/presence.

Do not adopt:
- LiveKit room IDs as CharacterSession identity;
- participant identity as canonical user/Character identity;
- LiveKit permissions as complete application authorization;
- Redis/room placement as business state;
- agent-dispatch hooks as Masanawa's agent framework;
- transport telemetry as user/Character quality truth.

## Closure

There are no unresolved LiveKit Server source families at the pinned revision. A future pin change reopens file and transport parity review.
