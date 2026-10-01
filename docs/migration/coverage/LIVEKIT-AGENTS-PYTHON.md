# LiveKit Agents Python Parity / Delta Boundary

Status: COMPLETE FOR PHASE 0B

LiveKit Agents TypeScript remains the primary realtime-session donor. The Python repository is mined for parity and unique deltas only.

## Duplicated behavior

These Python families substantially duplicate the selected TypeScript runtime and therefore do not create a second Masanawa implementation:
- AgentSession and turn lifecycle;
- STT, TTS and LLM abstractions;
- provider fallback;
- VAD/EOT/inference;
- metrics/telemetry;
- IPC/worker execution;
- tokenization;
- avatar/provider plugins.

For these families the Python tests strengthen parity requirements but do not change canonical ownership.

## Unique or stronger deltas retained

### Realtime model failover

- candidate models must agree on hard pipeline-shaping capabilities such as audio output, turn detection and overlapping-speech support;
- soft capabilities are exposed conservatively as the intersection supported by all candidates;
- active chat context, instructions, tools and tool choice are replayed to the replacement session;
- current playout is interrupted through the live session before swap;
- live input arriving during the swap is dropped rather than replayed late;
- an interrupted reply may be regenerated only under explicit policy;
- failed candidates enter cooldown and availability/recovery state is observable.

This behavior becomes RTC-070 and B-RTC-070/071 under the existing Masanawa provider + presence contracts.

### Multi-speaker diarization adapter

- a diarization-capable STT may be wrapped to identify a primary speaker;
- background speaker transcripts may be separately formatted or suppressed;
- wrapped-provider model/provider identity and metrics remain authoritative;
- adapter-level processing must not double-count provider usage;
- successful final transcripts reset accumulated transient retry state.

This becomes SPK-030/B-SPK-030. Speaker role is conversational evidence only and never authentication.

### Session evaluation

Python includes post-session evaluation with judge groups for task completion, handoff continuity, accuracy, tool use, safety, relevance, coherence and concision. Masanawa retains this as evaluation evidence, not self-authorization. A failed judge is isolated from the rest of the group, and production promotion still flows through rehearsal/certification/governance.

### PII-aware telemetry filtering

Python explicitly strips conversational/tool payload PII and redacts free-form exception messages before unauthorized exporters receive traces/logs. This becomes a canonical telemetry/privacy rule.

### Durable coroutine experiment

The livekit-durable plugin serializes Python execution frames/generators. It remains research evidence only and does not displace Microsoft Agent Framework or Masanawa workflow checkpoints because it is coupled to Python frame internals and is not a cross-language workflow state model.

## No second runtime rule

Masanawa will not run Agents TS and Agents Python as independent live-session authorities, persist separate Python session truth, duplicate provider registries per language, or duplicate tool/workflow state in Python plugins.

Python-specific code may be used only for parity tests, isolated provider integrations, research helpers, or bounded services behind canonical contracts.

## Closure evidence

- livekit-agents-python-file-family-manifest.json accounts for all 1,472 pinned files.
- livekit-agents-python-plugin-disposition-manifest.json dispositions all 750 plugin files.
- unique deltas are represented in Feature/Behaviour/Data ledgers.
- no Python family changes the Phase 0A choice of LiveKit Agents TypeScript as the primary realtime-session donor.
