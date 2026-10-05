# Harness bounded subworkers — 2026-10-05

Owner/window: ChatGPT harness subworker continuation.
Branch: `work/harness-subworkers-20261005`
Base: PR #151 head `33b4fbff2f0bf455417c5299c7b85ebca5358ba8`
PR: #163

## Exact owned paths

- `docs/workstreams/harness-subworkers.md`
- `packages/agents/src/subworker.ts`
- `packages/agents/src/subworker.test.ts`
- append-only export in `packages/agents/src/index.ts`

No Gateway/mobile/finance/provider files are owned.

## Implemented

- subworkers are canonical child AgentRuns, not new Characters or user-visible agents;
- child runs preserve the exact parent CharacterSession/CharacterVersion;
- exact parent/root AgentRun lineage is preserved with bounded depth;
- Task/WorkflowRun request/correlation custody is inherited exactly while initial
  Operation references are empty;
- selected SkillVersions must be a strict subset of the parent harness admission;
- direct-child fan-out is bounded through an injected lineage reader;
- Security attenuation is mandatory before child creation;
- postconditions mechanically reject capability/scope/resource widening, changed
  principal/tenant/request identity, invalid delegation chains, inherited approvals and
  authority lifetime widening;
- an injected safety-policy gate must additionally certify the child as non-financial
  and non-approval-capable before the AgentRun repository is called;
- terminal parents cannot spawn children;
- focused tests cover exact lineage/Work custody, Skill widening, terminal/depth/fan-out
  refusal, authority widening, inherited approvals, resource widening and safety-policy
  denial before child creation.

## Verification

- Compare against PR #151 head: 4 commits ahead, 0 behind.
- Exact changed paths are the four owned paths above.
- Foundation CI run `37292977520` failed before executing any step; job
  `111707518413` has `steps: null`. This is runner-allocation/non-execution, not a
  code test result.
- No deployment or production execution claim.

## Integration handoff

1. AgentHarness integration may use this admission service only for already-admitted
   durable/root work; do not create another conversation or Work store.
2. Security integration must provide the attenuation implementation and safety-policy
   check; child approvalIds remain empty.
3. The executor receives only the returned child authority and selected Skill subset.
4. Child results return to the root harness; mobile/WhatsApp/Telegram continue showing
   the root Gwani/Gwana/twin identity unless product policy explicitly says otherwise.
5. Consequential financial/approval actions remain with the root/user authority path.

Implementation: complete within the isolated Agents slice.
Verification: source/diff audit complete; executable CI unavailable.
Deployment: not claimed.
