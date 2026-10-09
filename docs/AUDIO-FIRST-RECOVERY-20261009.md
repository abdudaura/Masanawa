# Recovery, supersession and unfinished-work mapping

Snapshot 2026-10-09. GitHub main observed at `5e758673ae91082520b21b3153da53791ae2cbf3`. Documentation is being cleaned, not runtime history. Every implementation state below is **RECONCILE / NOT VERIFIED COMPLETE** unless later immutable execution evidence proves otherwise.

## Local source first

The owner reports local fixes and a built APK. They are not available here. AF00 needs branch/head, dirty diff/untracked files, package/version/signing identity, build commands and APK checksum; preserve before any pull/switch. Accept a pushed branch or secret-free source patch/archive. No reset/clean/force push. Record which local commits are absent remotely and preserve tested behaviour before integration.

If local source remains unavailable, recover non-overlapping remote modules and tests, but do not replace unseen local screen improvements or claim the APK was audited.

## Instruction cleanup

Exact original instruction files are archived under docs/archive/20261009/ with their original path suffix. Main stable entrypoints now link to a single product/screens/money/contracts/window plan. Old launch-prompt paths contain explicit historical notices; don't copy them into new windows.

Superseded product instructions: public live-Talk-first/no-Rooms, mandatory human host for every published post, no autonomous AI posts, bottom Agents destination, mandatory Gwani-hidden arrangements, spendable fiat/Cr customer balances, direct platform fiat cashout and crypto P2P. This is owner-direction supersession, **not a claim those features were finished**.

Historical pauses, repeated override sections and mandatory-all-drafts rules no longer schedule new work. Source-tested merges and separate production gates follow current AGENTS/MULTI-WINDOW rules. Existing old task IDs survive in the following map.

## Existing PRs to reconcile, not rebuild

| Input | Observed head SHA | Recovery use |
| --- | --- | --- |
| [#578](https://github.com/Baatiku/masanawa/pull/578) | `fc5ce19e937cb0f016e2cc14562f78c738f4e0c0` | C09: integrate private human audio/video calls into real Chats and Gateway (Work-stacked) |
| [#576](https://github.com/Baatiku/masanawa/pull/576) | `c3d821e5dad6a8405d5efa0cd4a450ac4ce1a775` | MSN crypto-primary wallet: backed issuance foundation, atomic NGN conversion and truthful UI (DRAFT) |
| [#575](https://github.com/Baatiku/masanawa/pull/575) | `5f36f9fc68630726cac82c23202dac811797f8a3` | C09: private human voice and video calls — guarded full-stack draft (integration pending) |
| [#545](https://github.com/Baatiku/masanawa/pull/545) | `3ea4fcfece06c6db0bc8228ba717375c937d3515` | F03: 17-persona catalog and fail-closed private Expert seed recovery (DRAFT) |
| [#534](https://github.com/Baatiku/masanawa/pull/534) | `f099a252de51e6c13bedf2fa8d8273efafcf284e` | U09: private Gemini Live voice focus and reviewed Gwani continuity (draft) |
| [#530](https://github.com/Baatiku/masanawa/pull/530) | `c491bd3a12515235a0f8649c6ba2cd47d64e9dbe` | U10: account-safe human chat composer and idempotent send recovery (draft) |
| [#529](https://github.com/Baatiku/masanawa/pull/529) | `5fd1a41f8e4028532bad1e2f3a665a0e1e907540` | U10: protected human DM composer and honest retry UX (draft, integration pending) |
| [#508](https://github.com/Baatiku/masanawa/pull/508) | `fff8fb6af0bfa845df865d1b1491029ee5809d4a` | U21: human Contacts Hub with C01 admission, C02 compose and account-fenced favorites (draft) |
| [#497](https://github.com/Baatiku/masanawa/pull/497) | `bb73b528862aae403a52b0fdedffd36c3f7a5674` | Work: final 150-window-handoff audit, tested mobile fixes and APK recovery |
| [#468](https://github.com/Baatiku/masanawa/pull/468) | `2a501e0e01c12e7996b33eaf89b0bc1e78332e8c` | C01: private contact admission with Work-verified backend and Flutter tests (draft) |

All were observed open, not independently verified or merged by this documentation change. Refresh actual heads and changed files. #497 overlaps CONTINUE-HERE and many runtime files; retain unique handoffs, Firebase, profile/security and composition but adopt current product instructions. #575/#578 are alternative/stacked calls inputs; elect one canonical implementation. #529/#530 require semantic de-duplication. #576 is MSN foundation, not a complete wallet/P2P product.

Also reconcile C02 #472/#475, C05 #474/#476, C06 #487/#490, C01 #468 vs profile #435 shared composition, and latest recovery PRs. Preserve every unique safety/behaviour change. Old guards that enforce a obsolete tab array must be updated without discarding deep-link/security tests.

Open-PR snapshot: [JSON](AUDIO-FIRST-OPEN-PR-SNAPSHOT-20261009.json). It records all pages observed, not a live ownership registry or proof every PR was reviewed. AF00 must classify **every** remaining open/relevant closed PR as integrate, adapt, retain/defer, or superseded-with-unique-source-accounted-for before closing anything.

## R recovery

| Previous ID | Scope | Current accountable lanes | Disposition |
| --- | --- | --- | --- |
| R01 | Theme/readability | AF00, AF08 | Retain approved app palette; only launch blue removal confirmed. No new green/blue reset. |
| R02 | Native/live audio | AF05, AF11, AF10 | Repair private notes/Gwani/calls first; legacy public live feed becomes optional Room infrastructure. |
| R03 | Persona catalog | AF07, AF12 | Retain seventeen identities and provision actual availability. |
| R04 | Host participant controls | AF10 | Reclassify live-stage controls as optional Room capabilities; preserve source. |
| R05 | Fiat funding/recovery | AF01, AF03 | Fiat buys MSN; preserve settlement obligations/refund recovery. |
| R06 | Wallet/ledger | AF01, AF03 | Replace consumer Cr/spendable fiat rules with backed MSN target through audited compatibility. |
| R07 | Billing | AF04, AF01 | MSN quote, menus/text/voice, authorization and receipts. |
| R08 | Crypto | AF01, AF03, AF06 | Qualified holdings/conversion/withdraw/internal transfer, no crypto P2P. |
| R09 | AI stage events | AF10, AF12 | Optional room context and creator quality; no private finances in public context. |
| R10 | Gifts/earnings | AF01, AF00 | Preserve financial reconciliation; advanced public animations not current mandatory feed work. |
| R11 | Localization | AF00, AF08, AF13 | Single catalog integrator, accessible localized screens/RTL; language icon only. |
| R12 | Deletion/privacy | AF00, AF13 | Recover existing identity worker/profile controls via exact delegated paths; escrow/pending obligations retained. |
| R13 | Replay/media | AF05, AF09, AF10 | Reuse authorized storage/codec/replay assets; don't coerce legacy IDs into posts. |
| R14 | Push/activity | AF00, AF06, AF11 | Preserve Firebase; integrate qualified notifications and deep links. |
| R15 | Safety/support/channels | AF00, AF07, AF13 | Preserve block/report/consented channels/support; feature owners enforce new object permissions. |
| R16 | Release/CI/restore | AF00, AF13 | Exact-SHA evidence and alternate runner, separate release gate. |
| R17 | Root shell | AF00 | Old Agents bottom tab superseded; Gwani, nested directory, Talks centre/default; Chats · Rooms · Talks · Gwani · Wallet confirmed. |
| R18 | Profile/avatar | AF00, AF07, AF12 | Recover #435 unique source and tests without losing profile editing. |
| R19 | Persona performance | AF12 | Distinct disclosed creator roles; listen-test emotional delivery. |

## Communications recovery

| Previous ID | Scope | Current accountable lanes |
| --- | --- | --- |
| C01 | Contacts | AF07 |
| C02 | Human DMs | AF06 |
| C03 | Realtime/push | AF06, AF00 |
| C04 | Private media | AF05, AF06 |
| C05 | Cache/offline | AF06, AF13 |
| C06 | Internal crypto transfers | AF01, AF06 |
| C07 | Gwani/task authority | AF04, AF00 |
| C08 | Shell/acceptance | AF00, AF13 |
| C09 | Private calls | AF11 |

## U recovery

| Previous ID | Scope | Current accountable lanes | Disposition |
| --- | --- | --- | --- |
| U01 | Operator permissions | AF00, AF04 | Retain security contract; no model-authorized spending |
| U02 | Durable tasks | AF04, AF00 | Reuse task journal and uncertain-outcome reconciliation |
| U03 | Task centre | AF04 | Same Gwani state, no second centre |
| U04 | Capability adapters | AF00, AF04 | Use canonical authorized service adapters |
| U05 | Opt-in memory | AF00 | Retain consent/privacy; recover after core stability, no new memory expansion |
| U06 | Teaching continuity | AF00 | Preserve existing skills/source; not a new top-level tab in this round |
| U07 | Work artifacts | AF00 | Preserve secure files, source and audit proof |
| U08 | Selected DM AI assistance | AF06 | Explicit opt-in selection, no ambient chat ingestion |
| U09 | Private Gemini Live | AF05, AF04 | Real microphone/transport/output diagnosis |
| U10 | Composer polish | AF06 | Reconcile duplicate #529/#530 |
| U11 | DM search/pins | AF06 | Recover scoped privacy-safe source |
| U12 | Media preview | AF05, AF06 | One recorder/player flow |
| U13 | Notifications | AF06, AF00 | Actor-free private push and account policy |
| U14 | Host preparation | AF10 | Superseded as public Talks requirement; reuse only for qualified Rooms |
| U15 | Stage copilot | AF10 | Optional Room live context, preserve safety/source |
| U16 | Post-session summaries | AF09, AF10 | Consent-qualified legacy media only; not automatic public clip publication |
| U17 | Owned persona training | AF00, AF12 | Preserve optional owned personas; not human Contacts |
| U18 | Quality/earnings | AF12, AF01 | Preserve financial accounting, extend creator editorial quality |
| U19 | Onboarding/low-end | AF08, AF13 | Current auth/neutral launch/accessibility |
| U20 | Release evidence | AF13, AF00 | Exact artifact/provider/device/restore proof |
| U21 | Contacts Hub | AF07 | Recover #508 |
| U22 | Local phonebook | AF07 | Optional/local-only consent |
| U23 | Invites/shares | AF07, AF09 | No surveillance/contact upload |
| U24 | Requests/privacy | AF07, AF06 | Block/admission applied consistently |
| U25 | Scheduled operations | AF12, AF00 | Reuse occurrence leases for publishing; retain reminders without scope expansion |
| U26 | Linked channels | AF00 | Preserve WhatsApp/Telegram consented Gwani integrations and source |
| U27 | Privileged agent admin | AF12, AF00 | Use existing ops roles for publishing controls; preserve unrelated admin source |
| U28 | Research/provenance | AF12 | Reuse evidence/budget providers for factual scripts |
| U29 | Customer support | AF00, AF02 | Preserve payment-uncertainty support; add escrow dispute operations |
| U30 | Public discovery | AF09, AF07 | Separate public post/persona and private contact indexes |

## F recovery

| Previous ID | Current accountable lanes | Preserved foundation |
| --- | --- | --- |
| F01 | AF00, AF08 | R01 |
| F02 | AF05, AF10, AF11 | R02 |
| F03 | AF07, AF12 | R03/R19 |
| F04 | AF10, AF01 | R04/R09/R10 |
| F05 | AF01, AF03, AF04 | R05/R06/R07 |
| F06 | AF01, AF03, AF06 | R08/C06 |
| F07 | AF00, AF08, AF13 | R11 |
| F08 | AF00, AF07, AF13 | R12/R15 |
| F09 | AF05, AF09, AF10 | R13 |
| F10 | AF00, AF06, AF11 | R14 |
| F11 | AF00, AF13 | R16/CI/restore |
| F12 | AF00 | R17/C08 |
| F13 | AF00, AF07, AF12 | R18 |
| F14 | AF07 | C01 |
| F15 | AF06 | C02 |
| F16 | AF06 | C03/C05 |
| F17 | AF05, AF06 | C04 |
| F18 | AF04, AF00 | C07 |

## Historical 150-task debt and completion rules

[LEGACY-150-TASK-RECONCILIATION-20261008.md](LEGACY-150-TASK-RECONCILIATION-20261008.md) remains a historical source inventory, including 79 unchecked entries. AF13 audits the entries; AF00 maps each applicable unmet requirement to a current lane or a named retained/deferred dependency. Nothing is deleted or auto-checked.

A completed requirement needs exact code SHA, actual passed test/journey, and deployment/provider/device proof where that status is claimed. A superseded requirement needs an owner decision reference, reusable-source disposition and replacement acceptance. A deferred capability needs retained branch/PR/path, reason and future dependency. Lack of evidence means unknown/unfinished, not DONE.

Privacy/deletion, profile/avatar, support, WhatsApp/Telegram, Firebase and secure releases remain preserved product foundations. AF00 coordinates bounded recovery/claims for those existing source paths; no new parallel feature expansion is implied by this round. Active new work always checks five-minute live ownership before edits.
