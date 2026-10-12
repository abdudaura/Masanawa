# Continue Masanawa

Updated 2026-10-12. This is the active entry point. Older freezes, repeated launch prompts and live-Talk-first instructions have been retired from the active reading path; their exact originals are preserved in [the archive](docs/archive/20261009/README.md).

## Latest incoming calls delivery — 2026-10-12

Incoming Masana signaling/push source is delivered by [PR #675](https://github.com/weavewellindustrieslimited/masanawa/pull/675),
source `efd159787`. Ringing, explicit accept/decline, server cancel/timeout,
missed history, durable push recovery and account-fenced Flutter use existing
auth/history/native/billing contracts. **98 Gateway + 87 Flutter tests passed**;
signed device/provider/production qualification remains unrun. Read the
[executed incoming handoff](docs/workstreams/AF11-incoming-calls-20261012.md)
and [direct continuation prompt](docs/workstreams/CALLS-NEXT-WINDOW-HANDOFF-20261012.md).
Preserve the full Calls screen and previous native/group/financial implementation.

## Previous native/group calls delivery — 2026-10-12

Native call reporting, persisted recents and private 2–4 Masana group calls are
merged to main at `757cf5657`. Canonical platform voice billing and durable
reservation/settlement recovery are included. Read the
[direct next-window handoff](docs/workstreams/CALLS-NEXT-WINDOW-HANDOFF-20261012.md)
and [executed AF11 evidence](docs/workstreams/AF11-masana-call-history-20261011.md).
Incoming Masana signaling/push has since been implemented above; signed device
and real provider qualification remain unrun. Fetch fresh main and claims before
starting, and preserve other windows' work.

## Current development policy — 2026-10-11

**Merge scoped, tested development work into main.** The owner authorizes routine
CI/CD on main during development. A build/deployment trigger is not a reason to
park source in an integration branch or ask again for merge approval. Run checks
relevant to the change; record unrelated existing failures and missing runners.
Keep auth/privacy, Wallet safeguards, secrets and destructive-data protections.
Older integration-only and whole-product-before-handoff rules are superseded.
Read only the instructions/contracts needed for the task; the list below is a
reference map, not mandatory repeated reading before every change.

## Delivery context — 2026-10-10

Read [outcome-first dispatch](docs/NEXT-WAVE-DELIVERY-20261010.md) FIRST and use [the replacement reusable prompt](docs/REUSABLE-IMPLEMENTATION-PROMPT.md). Stop unrestricted micro-fix selection and duplicate evidence/cleanup tools. Complete substantive customer milestones, continue existing PRs and integrate tested code on one reviewed safe baseline. The AF JSON is an allocation template, not live completion status; inspect current claims/PRs/handoffs. Read only relevant feature references after this short dispatch.

## Read in this order

1. [Contributor rules](AGENTS.md) and [coordination](docs/MULTI-WINDOW-WORK.md).
2. [Current owner decisions](docs/AUDIO-FIRST-PRODUCT-20261009.md).
3. [Screen specifications](docs/AUDIO-FIRST-SCREEN-SPECS.md), [wallet/P2P contract](docs/MSN-WALLET-P2P-CONTRACT.md), [cross-slice contracts](docs/AUDIO-FIRST-INTEGRATION-CONTRACTS.md).
4. [Recovery and supersession map](docs/AUDIO-FIRST-RECOVERY-20261009.md).
5. [Window allocation](docs/AUDIO-FIRST-WINDOW-PLAN-20261009.md), then use exactly one [copyable lane prompt](docs/AUDIO-FIRST-WINDOW-PROMPTS-20261009.md).
6. [Completeness audit and unresolved gates](docs/AUDIO-FIRST-COMPLETENESS-AUDIT-20261009.md).
7. [Whole-app source findings and Settings](docs/WHOLE-APP-SOURCE-AUDIT-20261009.md), [database/storage operations](docs/BACKEND-STORAGE-OPERATIONS-20261009.md) and [screen inventory](docs/WHOLE-APP-SCREEN-INVENTORY-20261009.json).
8. [Acceptance journeys](docs/WHOLE-PRODUCT-ACCEPTANCE-JOURNEYS.md) and relevant existing domain references.

## Current direction — amended 2026-10-11

Masanawa is a social messaging app for AI celebrities: WhatsApp form, modern
and more advanced. Every contact is a Masana AI persona; humans chat and call
Masana one-to-one and in groups. Masana publish Status updates into a feed.
The Wallet covers billing, crypto and services. Personal Twins are retired.

Confirmed bottom navigation: **Chats · Status · Wallet · Calls · Rooms**.
**Chats is the default tab** on ordinary authenticated app launch. There is
no Agents/Twins bottom tab. MSN is the platform currency; confirmed fiat
funding buys MSN automatically. Crypto can be held or converted with MSN
where qualified. P2P exchanges MSN only against counterparty fiat, with
escrow; there is no direct platform fiat withdrawal. Rooms are audio-focused
groups.

## Historical recovery note — inspect fresh main first

This note predates merged #668 and the calls delivery above. The owner's pushed
updates and calls source have since been integrated into main; the old missing
local-source report is not a current blocker. Preserve any newer local edits and
inspect fresh refs before replacing affected screens.

Existing drafts include #497 integration, #576 MSN, #575/#578 calls, #468/#508 contacts and #529/#530 chat polish. They are recovery inputs, not proof of completion. Inspect exact heads and unique changes, then test and integrate in dependency order. See recovery map for every old R/C/U/F lane; none is silently marked DONE.

## Delivery

One lane per window, isolated checkout, exact-path claim visible before edits. Start dependency-ready waves, not all lanes at once. Shared composition/migration/router/export files have one integrator. Promptly merge compatible completed code into main with relevant executable proof. Routine development CI/CD is authorized; release qualification is a separate claim. Missing external verification is recorded precisely, not used to park all tested code forever.

No runtime, provider, escrow, Android-device, local-build or deployment verification is established by this documentation update.
