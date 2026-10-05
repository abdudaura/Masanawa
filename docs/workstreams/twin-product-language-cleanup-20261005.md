# Twin product-language cleanup claim

Status: ready for integration
Owner/window: ChatGPT twin-transformation continuation
Branch: `work/twin-product-language-cleanup-20261005`
Base: `2bdd99908d94cc39ada639af1f21ebbdccb6bfe2`
Task references: TWIN-003

## Exact owned paths

- `docs/workstreams/twin-product-language-cleanup-20261005.md`
- `docs/PRODUCT-NORTH-STAR.md`
- `docs/PRODUCT-PROJECT-STRUCTURE.md`

## Scope

Remove remaining contradictory ordinary-user reseller/commercial-Skill/Agent-Float
language from the two active canonical product/structure documents while preserving the
same underlying Commerce, attribution, execution, reserve and runtime invariants.

This is terminology and product-boundary alignment only. It does not delete internal
Commerce concepts or rewrite implementation ownership.

## Explicit non-ownership

This claim does not own:
- `docs/CREATOR-CLONE-ECONOMY.md`, which remains an internal/historical commerce
  foundation under the newer Twin overlay;
- billing, crypto, Commerce code or migrations;
- Gateway/mobile/shared integration;
- any active Twin feature PR path;
- deployment configuration.

## Acceptance

- ordinary-user mental model remains My Twin / Explore / Activity / Wallet;
- user journeys do not require enabling commercial Skills or understanding Agent Float;
- qualifying purchases still preserve originating-Twin attribution and fallback execution;
- internal reserve/settlement/Commerce ownership remains documented as infrastructure;
- Gwani/Gwana remain platform/support Twins/Characters without privileged runtime paths.


## Implementation handoff

Updated canonical product language:
- personal **Twin** is now the ordinary-user term; persisted `personal-clone` remains
  explicitly internal compatibility/domain vocabulary;
- mobile north star now names **My Twin / Explore / Activity / Wallet** as the root shell;
- ordinary-user journeys no longer require enabling a commercial Skill;
- purchase journeys no longer expose Agent Float or executor-capacity fallback;
- originating-Twin attribution and configurable owner commission remain explicit;
- internal Agent Float/reserves remain preserved inside Commerce ownership rather than
  ordinary Wallet fields;
- Gwani/Gwana remain normal platform/support Characters with no privileged runtime.

Validation:
- branch diff is exactly the three claimed documentation paths;
- branch was 0 commits behind current `main` at verification;
- targeted residual scan confirmed the replaced contradictory phrases
  `commercial Skill`, `creator's clone`, `creator/reseller economics` and
  `digital-twin/reseller product` no longer occur in these two canonical documents;
- no code, migration, checksum, package export, Gateway/mobile path or deployment config
  changed.
