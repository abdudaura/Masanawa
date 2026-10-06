# Home + Rooms Integration Queue

Status: canonical integration handoff, updated 2026-10-06.

This queue starts only after the isolated-feature move-on gate in
`docs/HOME-ROOMS-STATUS.md` is satisfied.

## Integration rules

- PR #136 remains the single shared production Gateway/mobile/APK integration owner.
- Integrate exact recorded heads; do not silently substitute older branch heads.
- Preserve canonical domain/runtime truth. Integration may compose adapters/routes/views,
  but must not reimplement Billing, Teaching, Story Radio, News, Work/Research,
  Identity/Group Room, or Admin publishing domain logic.
- Re-run changed-file and dependency audits before each composition because several lanes
  are stacked on non-main bases.
- A lane becomes **INTEGRATED** only after the production integration branch contains its
  required functionality and shared wiring.
- A lane becomes **DEVICE VERIFIED** only after the exact integrated release head is built
  and its physical-device acceptance succeeds.

## Exact isolated heads to consume

| Order | Lane | PR | Exact head | Dependency note |
| ---: | --- | ---: | --- | --- |
| 1 | H — Home shell | #201 | `8dcee90e49c6773298398ffeed218ff25ddb3ecb` | based on docs overlay |
| 2 | I — Internet Cafe | #203 | `c77dfc5320c2cfdb6865661370e1b98907b8cd61` | compose canonical billing/Skill refs only |
| 3 | S — Story Radio | #199 | `3445db59d2d1a1a64454273b42773cdfc2e047ed` | playback/audio transport remains shared |
| 4 | N — News | #200 | `6ea84ea23a627fb3325bc00ec0b273bd8d2518b3` | evidence/audio transport remains shared |
| 5 | T — Study Center | #205 | `e71111ab7ba6ec707c44ad9e671010194a6f2e87` | stacked on Core Teaching #96; preserve #94/#96 contracts |
| 6 | W — Work & Research | #202 | `14ef78f5acd218728fe51530a2153d7a2dc0bd34` | route opaque intents to canonical Workflow/research runtime |
| 7 | G — Group Rooms | #204 | `01e8a799616754d6da044dd77b621413d8747e1c` | also needs Identity export/persistence/memory composition |
| 8 | A — Admin publishing | #208 | `8a330dc81fc1c07b780ca3540282cf2b55e5dbdd` | stacked on admin #129; Ops command wiring, not customer app |

Always refresh this file if any listed PR head changes before integration.

## Active shared integration

Lane H integration is actively owned by PR #206 at head `78b9664c87ed0b29e148d34f74db64bd76ef1f37`, stacked directly on PR #136. Do not open a second Home integration branch while #206 remains active. After #206 is reconciled into #136, mark Lane H **INTEGRATED** in the status ledger.

## Billing gate

Lane B is actively continued by PR #210 at head `cad5aa030e49cc105348c98ff42d435ac204f2a8`, stacked on PR #126. Its deterministic qualification gate is implemented and tested, but Lane B is not production-complete merely because the gate exists.

Before production enablement, the billing owner must provide:
- live eligible Flutterwave NG/NGN catalog evidence;
- Data/Airtime/Electricity/TV qualification;
- approved fee policy and required production configuration;
- recipient/account validation evidence where required;
- quote/checkout/reconciliation/receipt/refund/unknown-outcome verification;
- at least one real reconciled Data purchase;
- at least one real reconciled additional bill-family purchase;
- no duplicate side effects across retry/restart.

PR #136 must consume Billing only after those qualification gates are met.

## #136 composition checklist

1. Rebase/reconcile the docs overlay and exact isolated lane heads without dropping newer
   production integration work.
2. Mount Home as the launch landing screen and preserve Explore/Activity/Wallet.
3. Resolve Gwana/Gwani from server configuration and wire chat, voice note, live voice.
4. Wire Home quick services to Internet Cafe intents.
5. Mount Internet Cafe and resolve billing/Skill references through canonical runtime.
6. Mount Study Center against Core Teaching runtime/persistence/channel seams.
7. Mount Story Radio with published content transport, playback and progress continuation.
8. Mount News with source-aware projection and approved audio path when enabled.
9. Mount Work & Research intents/results/artifacts/sources through canonical runtime.
10. Integrate Group Rooms only with explicit membership/privacy/memory enforcement.
11. Consume admin-published Home/Story/News presentation from canonical Ops/domain truth.
12. Keep Wallet/Activity tied to canonical outcomes.
13. Reconcile production environment without rewriting migration checksums.
14. Build the exact release APK from the final integration head.
15. Run the physical acceptance checklist from `docs/HOME-ROOMS-MULTI-WINDOW.md`.

## Final reporting rule

Do not report Home/Rooms launch complete until:
- required lanes are **INTEGRATED**;
- Billing is production-qualified;
- the exact APK builds;
- physical-device acceptance passes;
- retry/restart financial idempotency is proven.

If the shared integration owner pauses while safe integration work remains inside its
claimed paths, it should continue rather than hand back a partial status.
