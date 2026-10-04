# Workstream claim — integration / Core Teaching

- Owner/window: ChatGPT integration continuation, 2026-10-04.
- Branch: `work/integration-core-teaching-20261004`.
- Base: Core Teaching PR #94 head `fbe79ec7dec242d8647302920e9c86b07a0e7169`.
- Purpose: integrate Core Teaching through new provider-neutral runtime/persistence/channel bridge contracts without editing active #89 runtime/Gateway/mobile, #91 chat renderer/coordinator, or #92 channel-ingress owned paths.
- Owned paths:
  - `docs/workstreams/integration-core-teaching.md`
  - `docs/CORE-TEACHING-INTEGRATION.md`
  - `packages/skills/src/teaching-runtime.ts`
  - `packages/skills/src/teaching-runtime.test.ts`
  - `packages/skills/src/index.ts` only for the new integration export
  - `tests/contracts/core-teaching-cross-channel.test.ts`
  - `docs/CORE-TEACHING-ACCEPTANCE.md`
- Dependencies: consumes Core Teaching contracts from stacked PR #94; external owners implement the published ports. No edits to their claimed files.
- Current step: runtime/persistence/presentation bridge, stable replay fingerprint, cross-channel acceptance, fail-closed admission binding, authorized artifact projection and fail-closed evidence routing implemented; owner composition pending.
- Verification: claimed integration/acceptance paths only. Contract source covers app -> lost response -> WhatsApp replay -> Telegram resume, Relationship isolation, changed-payload conflict, English-text -> Hausa-voice continuity, reteach continuity, admitted-binding mismatch, authorized artifact projection and verified/insufficient evidence behavior. GitHub Actions zero-step runner issue remains; latest exact run is checked before handoff.
- Deployment: none. Coordination comments published on PRs #89, #91 and #92; no ownership transfer or foreign-file edits.
- Collision rule: no Gateway/mobile/channel/chat-renderer/migration/lockfile/shared deployment edits in this workstream.
