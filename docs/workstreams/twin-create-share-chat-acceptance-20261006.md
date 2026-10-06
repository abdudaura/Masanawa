# Twin create/share/free-text acceptance — TWIN-100

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/twin-create-share-chat-acceptance-20261006`
Base: PR #136 head @ `be24c984ac47f4d2a0af149f3fb51fda49472536`
Task: TWIN-100 — end-to-end create twin -> share -> free public text chat.

## Ownership boundary

This lane is stacked on #136 only to consume the already-owned production integration contracts. It does not modify any #136-owned Gateway/mobile/router/chat/APK/production path.

## Exact owned paths

- `docs/workstreams/twin-create-share-chat-acceptance-20261006.md`
- `tests/integration/twin-create-share-free-text.test.ts`

## Explicitly excluded/shared paths

- every existing #136 source/config/mobile/APK path
- clone onboarding implementation
- Twin profile/public-share implementation
- Memory representation implementation
- Commerce pricing/runtime implementation
- migrations, production environment, credentials
- physical APK/device validation (TWIN-108)

## Acceptance target

- confirmed onboarding reaches one canonical ready personal Twin result;
- exact retry cannot create a second Twin identity;
- public profile/share identity resolves to that exact Character;
- public projection labels AI representation and owner not present;
- free public text interaction cannot become paid voice/owner-access charging;
- only exact Character-shared memory may enter public Twin representation;
- hidden/private profile is not shareable;
- no duplicate runtime/wallet/identity state machine is introduced.

State: ISOLATED COMPLETE / INTEGRATION READY.

## Completed acceptance evidence

- composes the existing resumable clone/Twin setup contract from the production-integration lineage;
- profile confirmation and completion reach one canonical ready Character/CharacterVersion/Relationship;
- exact confirmation/completion replay preserves the same Twin identity;
- a different confirmation request identity is rejected;
- public profile projection resolves to the exact created Character and emits only the AI-representation/owner-not-present projection;
- hidden/non-discoverable Twin profiles do not produce a public share projection;
- public text-message admission is always `chargeMode: free`, `chargeCredits: 0`, with no paid admission identity, even if paid voice evidence is supplied;
- live voice still requires a separate valid paid/trial admission and cannot silently upgrade free text;
- no new Twin runtime, wallet, pricing engine, profile repository or chat admission path was introduced.

## Remaining production dependencies

1. PR #136 remains the protected owner for production Gateway/mobile/router/chat/APK composition.
2. Public deep-link/mobile share opening and actual device chat remain shared integration/APK acceptance work.
3. TWIN-108 still requires real Android APK/device execution.
4. Full production acceptance remains dependent on executable CI and deployed end-to-end evidence.

Implementation head before handoff: `d20539ae1d016772a71d08e7e63b0e748791a307`.

Last update: 2026-10-06.
