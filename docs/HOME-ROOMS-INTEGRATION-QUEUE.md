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
| 2 | I — Internet Cafe | #203 | `4c3ac73796aff5ec05ee0875512cf294e92239e3` | compose canonical billing/Skill refs only |
| 3 | S — Story Radio | #199 | `3445db59d2d1a1a64454273b42773cdfc2e047ed` | playback/audio transport remains shared |
| 4 | N — News | #200 | `6ea84ea23a627fb3325bc00ec0b273bd8d2518b3` | evidence/audio transport remains shared |
| 5 | T — Study Center | #205 | `e71111ab7ba6ec707c44ad9e671010194a6f2e87` | stacked on Core Teaching #96; preserve #94/#96 contracts |
| 6 | W — Work & Research | #202 | `14ef78f5acd218728fe51530a2153d7a2dc0bd34` | route opaque intents to canonical Workflow/research runtime |
| 7 | G — Group Rooms | #214 | `0a5b7722eacc920c135d951b7acd47ff5ef0938c` | supersedes conflicted #204; also needs Identity export/persistence/memory composition |
| 8 | A — Admin publishing | #208 | `344e9eb31516c59a0425fc7e20d46962786e5fef` | stacked on admin #129; Ops command wiring, not customer app |

Always refresh this file if any listed PR head changes before integration.

## Active shared integration

Lane H production integration PR #206 completed at head `764d179543fd629245e8ad0f98d7fbfc6b11506c` and was merged into the canonical PR #136 branch as `effe6d213a8283b0925cbeac7e37db0b84c32376`. Lane H is therefore **INTEGRATED**. Do not reopen or duplicate Home integration. Exact APK/device acceptance remains a Lane P release gate.

Story Radio production integration PR #209 is also open at head `9b3490c6fe1d92b44c679c976cc3396535abb6b1` and touches shared #136-owned Gateway/router/production paths. Treat it as a coordinated #136-side integration branch, not a second independent shared owner. Do not mark Lane S **INTEGRATED** until its changes are reconciled onto the canonical #136 head. News integration PR #207 is closed and must not be treated as active integration ownership.

## Additive server/runtime seams

Before mounting the corresponding Rooms, consume these exact completed seams:

- Teaching progress #215: `7bc1b574f9738f6e8108b3a8e422654b74043c3e`
- Work/Research server #216: `27e45edc2b5b9cbf933cda3ffb50785c9a2f712c`
- Internet Cafe server #218: `ada2ed3f08a9678b2c62def41fee4324b345a8b5`
- Study Center server #220: `37edb1db2c14fe7d9a78a0601492a3cc0274a169`

These seams deliberately avoid shared route files. The #136 integration owner should compose them
rather than reimplementing their projection/validation logic.

## Shared-branch collision warning

Two active Story Radio production branches currently overlap shared Home/router/Gateway composition:

- #209 `work/story-radio-production-integration-20261006`, based directly on #136;
- #211 `work/story-radio-home-integration-20261006`, based on #206 and currently non-mergeable.

Do not open another Story/shared-routing sibling. Reconcile #209/#211 with the #206 Home line
before stacking further shared Room integrations. News #212 is already stacked on #206 and should
not be independently duplicated.

## Billing gate

Lane B is actively continued by PR #210 at head `cff18c160ebe1b7fecc0d3c3ae9b9e200655622e`, stacked on PR #126. Its deterministic qualification gate is implemented and tested, but Lane B is not production-complete merely because the gate exists.

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


## Home production integration qualification — 2026-10-06

Canonical Home integration evidence:

- isolated Home head consumed: PR #201 `8dcee90e49c6773298398ffeed218ff25ddb3ecb`;
- production Home PR #206 final head: `764d179543fd629245e8ad0f98d7fbfc6b11506c`;
- canonical #136 merge commit: `effe6d213a8283b0925cbeac7e37db0b84c32376`;
- exact Home CI qualification pointer: `5b90222f60fd19e957dd64c19f9775ac56c52046`, differing from final Home only by CI-only `.gitmodules` removal and the scoped qualification command;
- full workspace qualification immediately before the final binding-test fix: 156 test files passed / 16 skipped, 831 tests passed / 127 skipped; Gateway `/home` route tests passed; workspace/Gateway production builds passed; Flutter analysis reached completion without compile errors; Home widget/model/continuation/root-shell tests passed;
- the one reproduced failure was test-harness binding initialization in `twin_production_integration_test.dart`; final #206 head adds the required `TestWidgetsFlutterBinding.ensureInitialized()` and changes no production source;
- final GitHub Actions runs on #206 and merged #136 were infrastructure failures before checkout with `steps = null`, not application failures;
- exact Render APK deployment `dep-db2d4orncjis73e9klf0` correctly resolved `5b90222f60fd19e957dd64c19f9775ac56c52046` but was canceled before checkout because the Render workspace had exhausted build-pipeline minutes;
- Railway production deployment `e7bf7f7f-652d-49bc-8121-94444c92ab94` correctly targets `effe6d213a8283b0925cbeac7e37db0b84c32376` and is currently held at `NEEDS_APPROVAL` with no build or deploy logs.

Do not mark Home **DEVICE VERIFIED** until an exact release APK is successfully built from the integrated #136 head and physical-device acceptance passes. The remaining blockers above are external build/deployment account gates, not an unimplemented Home integration handoff.
