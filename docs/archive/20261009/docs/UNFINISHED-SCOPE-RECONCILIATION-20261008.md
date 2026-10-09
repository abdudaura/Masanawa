# Re-audit of every current mobile lane and historical production debt

**2026-10-08 · Corrective completeness audit; source evidence, NOT feature acceptance.** This corrects the first U01–U20 plan, which addressed important quality upgrades but did not explicitly absorb the unfinished R01–R19/C01–C08 implementation responsibilities, WhatsApp-style contact-directory experience, and historical 150-task ledger. **Do not interpret this document as "everything implemented" or future features automatically approved.** Current owner-approved priorities, final five-tab shell and finance/privacy safety remain binding.

## 1. Audit method, baseline and limitations

- Live `main` at audit start: `02919d48a8155f71f5d252b0763b4f8c15c9053f`, after first U01–U20 documentation PR #506. All additional source work lives in unmerged PRs until verified.
- Inspected `CONTINUE-HERE.md`, `MOBILE-READINESS-PLAN.md` (all R01–R19), `COMMUNICATIONS-EXTENSION-PLAN.md` (all C01–C08), `APP-SHELL-CONTRACT.md`, owner 77-requirement trace, release gate checklist, golden J01–J11, current U01–U20, backend portability/feature trace, database restore runbook, final Work handoff, production 150-task checklist, persona/release/billing/voice guidance; obtained current open PR inventory **60 open PRs** at audit time. The open PR list/heads can change; every new window must refresh them before claiming.
- Reviewed **draft C01 #468** code and exact file list: a real `HumanContactsScreen` and `HumanContactsTransport` have handle search, contact request/list, privacy controls, accepts/revokes, but are not integrated into main or proven device-ready. No contact/phonebook path exists on main's inspected tree. Thus original 20 plan's Contacts UX gap is real, without claiming previous C01 agent forgot contacts entirely.
- Current Work #497 remains **draft/unmerged** and now merge-conflicts with later `main`; its handoff reports backend 1209 passed/1 failed/143 skipped, Flutter 443 passed/11 failed, baseline typechecking issues, Firebase preservation and missing full DB/device/provider verification. This status is **not** verified on current main. CI issue #457 exhausted Actions capacity; independent executable results are not automatically invalid but zero-step CI is not a pass.
- A spot audit of the historical `PRODUCTION-MASTER-TASKS.md` checklist shows **79 unchecked out of 150 numbered tasks**; this is an old ledger, **not a reliable proof that all 79 source modules are absent**, nor permission to revive retired product directions. [Complete 79-row mapping](LEGACY-150-TASK-RECONCILIATION-20261008.md) preserves every unchecked number and clarifies current-vs-future scope.
- **Known audit limit:** we did not execute a full repo build, database migration, live provider qualification, physical Android/iOS tests or inspect every legacy workstream's implementation line-by-line. All mapped states are source/plan evidence only. Unreported source gaps discovered by coding are tracked as new blockers, not silently called done.

## 2. Master scope classification

| Group | Current directive | Ownership source |
| --- | --- | --- |
| **R01–R19** | Existing current consumer/mobile release capabilities and acceptance, all still open/partial/unverified unless separately executed | R ledger + designated **F01–F13** recovery workstreams |
| **C01–C08** | Existing mandatory human messaging, internal crypto, Assistant and five-tab integration | C ledger + **F06/F12/F14–F18** recovery |
| **U01–U20** | Approved AI-first/task/Chat/Talk/Twin/quality improvements; independently buildable new modules | U workbook; retained with **no arbitrary reassignment** |
| **U21–U30** | Re-audit missing contact, device phonebook, invitations, contacts privacy, scheduler, channel experience, admin, source-backed research, user support and cross-product search | [additional U feature windows](ADDITIONAL-U21-U30-AND-FOUNDATION-F01-F18-20261008.md) |
| **F01–F18** | Recovery/integration of the **already required** R/C scopes and existing PR source, not permission to rewrite it | [foundation integration/recovery assignments](ADDITIONAL-U21-U30-AND-FOUNDATION-F01-F18-20261008.md) |
| **Legacy 001–150** | Historical completeness ledger; 79 unchecked enumerated individually; consumer-critical requirements mapped to R/C/U/F, nonconsumer device/call/studio/plugin scope visibly future-gated | [legacy task crosswalk](LEGACY-150-TASK-RECONCILIATION-20261008.md) |
| **J01–J11, K01–K20** | Real cross-tab and extended contacts user outcomes; NO DONE from code presence | Golden journey docs, original U/K integration and Contacts contract |
| **Work #497 / Firebase #461 / CI #457** | Incomplete shared merge/check/release/platform setup; no new window may bury source, overwrite native keys, or infer readiness | F11/F12/F10/F18 and one future final integrator |

**Count:** There are **30 U product workstreams plus 18 F existing-foundation/recovery tracks = 48 named scopes**, **not 48 simultaneous writers**. Initial twenty U windows may continue. When additional capacity is available, launch eligible U21–U30 and only unowned, explicit F recovery scopes whose protected paths are clear. Shared integration requires sequencing; intentionally serialize high-risk database/Gateway/router/finance/native changes. This is an executable backlog, not an instruction to spawn 48 agents on the same files.

## 3. Every R01–R19 accounted for — current R ledger retains its status

| R | Still required actual user capability and unresolved gates | Open draft/source references (reinspect heads) | Recovery/quality owner |
| --- | --- | --- | --- |
| R01 | White/light semantic accessible surfaces, proper contrast on *every* chat/sheet/Talk/Wallet screen, small-device/screen-reader testing; newer blue-brand wish conflicts with older green guidance and requires explicit owner visual decision | #442 | **F01**, U19 |
| R02 | Public LiveKit Host→audience and human/AI Seats, microphone permission/reconnect/fence, device audio routing, native Gemini private voice isolation | #439, #448, #449, #456 | **F02**, U09/U15 |
| R03 | Full 17-persona directory/availability, support-agent recovery, dynamic voice/persona attributes, secure offline roster, owner support selection | #441, #495, #499 | **F03**, U17 |
| R04 | Real Create Talk, invite person/Expert/Twin before/during, Host permissions and AI paid admission | #433 | **F04**, U14 |
| R05 | Billing quote/funding reuse, unattended reconciliation, duplicate webhook, settled receipt/refund/fail states | #440 | **F05**, U04 financial delegation |
| R06 | Actual global wallet fiat/Credits/crypto/earnings separation, quote/fees/account ID, idempotent authorized transfers, real balances | #438 | **F05**, U04/U18 |
| R07 | Real Flutterwave airtime/data/electricity/TV provider route/region, price/terms, voice/text confirmation and delivery/reconciliation, including failed paths | #447, #501 | **F05**, U04/U09 |
| R08 | Actual NOWPayments custody/relay/deposit/buy/convert/withdraw, asset-network fees, payout/2FA/IPN/risk/quotes and receipts; no high-gas ERC-20 by current policy | #444, #454; crypto work #487/#490 | **F06**, U04 |
| R09 | Host-authorized bounded stage AI event context, approved comments/polls/reactions/gift, limited expensive turns | #452, #459 | **F04**, U15 |
| R10 | Actual gifts, animations, server-authoritative settlement/AI acknowledgement, reduced-motion/low-data and creator earnings | #471, #484, Work #497 portions | **F04**, U18 |
| R11 | Global locale UI, Hausa/English/code switching, Arabic/RTL, currency formats, user preference and translated receipts | #426, #482, #501 | **F07**, U19/U09 |
| R12 | Real account deletion, OTP reauth, irreversible steps, audit-retention separation, channel/push/media revocation and privacy | #430 | **F08**, U05/U24 |
| R13 | Recording, S3 object ownership, replay creation/egress, private signed playback/expiry, deletion and permissions | #453, #503 | **F09**, U16 |
| R14 | Actual Firebase client/server/FCM/APNs, device token registration/retry, signed out, safe previews, Activity and deep links | #436, #502, Firebase #461 / Work #497 | **F10**, U13 |
| R15 | Reports, abuse/block/mute, safety across Talks/AI/DM/Teams, WhatsApp/Telegram identity and webhook guard, real customer support | #443, #446, #450, #451, #488, #489/#491, #494/#496 | **F08**, U24/U26/U29 |
| R16 | OTP/logout security, schema migration safe CLI, Gateway readiness/backup/restore, production signing, CI recovery, low-end perf, release/checks and compliance | #455, #479, #485, #492, #500, #460/#497 | **F11**, U19/U20 |
| R17 | Exact five tabs/routes, old links, public Talk/Chats/Assistant separation, contextual Wallet action, headers/FAB/back/drafts, contact nested route | #445, #493, Work #497 | **F12**, U03/U21 |
| R18 | Editable person/owner profiles with avatar/crop/S3 WebP, name/handle/bio, cross-tab cache/invalidation, account settings | #435 (shares gateway with #468) | **F13**, U21 |
| R19 | Accurate role-safe expressive 17 personas, disclosure/safety, voice/turn/persona isolation and serious/playful roles | #448, #498 | **F03**, U09/U17/U18 |

**Theme conflict is unresolved:** R01 and historical owner trace say bright green WhatsApp-like palette; later app logo/theme notes mention vibrant blue. Do **not** pretend one was the last explicitly verified sign-off. F01 must gather owner selection; other windows preserve current palette instead of competing redesigns.

## 4. Every C01–C08 accounted for — original C contracts preserved

| C | Actual missing connected proof and source | Open PR recovery and collision | Foundation owner + extension |
| --- | --- | --- | --- |
| C01 | True human @handle search, request/accept/revoke/privacy/block, **accepted contacts list**, safe Contacts→Chat, no forced phonebook; real accounts and migration | **#468** has Gateway+Flutter draft Contact screen, shares `app.ts/main.ts` with #435 | **F14** C01 identity; **U21** Contacts Hub, **U22** optional local device list, **U23** invites |
| C02 | One durable authenticated human DM SQL schema/REST/Flutter thread, idempotency, receipt/history/privacy, no agent-message substitution | **#472 vs #475** both supply competing C02 pieces incl migration 0017 | **F15**, U10/U11/U08 |
| C03 | Real authorized realtime events, cursors/resnapshot, unread/read, offline catch-up, Firebase push/deep links | **#473/#483/#486** stacked, must pick semantic latest; R14 | **F16**, U13 |
| C04 | Actual private voice note/media S3 uploads/read/revoke, text fallback and distinct LiveKit mic | **#478**, isolated and unverified composition | **F17**, U12 |
| C05 | Local encrypted/indexed per-account cache and outbox, lazy pages, cheap-Android performance, sync correctness | **#474 vs #476** competing/stacked implementations | **F16**, U10/U19 |
| C06 | Authorized custody-backed internal crypto A→B atomic ledger with KYC/limits/confirm/receipt/reconciliation, DM Transfer as separate quote | **#487 vs #490**, overlapping migration/ledger source | **F06**, U04 |
| C07 | **One** Gwani/Gwana session/voice/text/task authority, messages/Talks/Wallet/Agents through genuine typed Gateway capabilities | **#480** partial workspace + U01/02/03/04/09 | **F18**, U01–U09 |
| C08 | One five-tab Flutter shell, legacy routes, correct contact/new-chat entry, cross-tab state and Android release quality | **#493** plus Work #497 shell changes | **F12**, U03/U21/U19/U20 |

**No feature can skip C01/02/03/04/05 simply because U10–U13 produce polished Flutter widgets.** Without a composed, authorized DM backend on `main`, there is no dependable real human chat.

## 5. Open PR groups, duplicate control and explicit branch dispositions

**At audit, 60 PRs open**; this count includes dozens of narrow security/recovery changes and the unmerged Work branch. Their timestamps, code and mergeability vary. The following is **not permission to close any**; future integrator must classify every live branch as `MERGE VERIFIED`, `SUPERSEDED AFTER PRESERVING UNIQUE DIFF`, `DEFER/KEEP DRAFT`, or `CLOSE AFTER VERIFIED DISPOSITION`, capturing immutable SHAs and evidence:

| Collision/dependency | Safe strategy |
| --- | --- |
| C01 #468 + R18 #435 | Merge additive Gateway composition and migration 0015→0016; never drop avatar/contacts code; test auth/profile/contact linked state |
| C02 #472 vs #475 | Elect **one** canonical C02 migration/DM contract, salvage unique Flutter/outbox/tests from alternate; no duplicate 0017 |
| C03 #473/#483/#486 | Trace earliest base + stacked changes; preserve cursor pruning/security and original journal; choose a coherent migration lineage |
| C05 #474 vs #476 | One protected cache/outbox/transport; reconcile account key derivation, migration, cursor semantics and tests |
| C06 #487 vs #490 | One actual audited double-entry/custody/identity/risk/quote-bound approval, not two transfers/ledgers |
| R15 #489 vs #491 | Choose one persona report implementation; preserve any non-conflicting tests; `MERGE-STOP` notice remains authoritative until reviewed |
| R17/C08 #493 vs Work #497 | One correct rooted 5-tab router and Assistant; reconcile all independently fixed source, preserve current owner override in `CONTINUE-HERE.md` |
| Firebase #461 vs Work #497 | Restore all native configs/defines and keep local values private; no user secrets in Git. Test real install and FCM/APNs separately |
| CI #460, issue #457 and Work #497 | Keep recovered test fixes; root cause GitHub Actions quota and actual code failures separate; no bypass or fake pass |
| Multiple narrow R02/R03/R07/R08/R10/R11/R13/R14/R15/R16 branches | Group by semantics and layer; preserve security negative tests, runtime and Flutter fixes; recompute common base and resolve conflicts before any merge |

**Never delete unresolved evidence, auto-close all PRs or force-apply stale branch diffs to current main.** Later Work must produce final open/closed/merged accounting.

**Reference-only messaging PR #467:** existing open [messaging UX benchmark and implementation guide](https://github.com/Baatiku/masanawa/pull/467) is an **unmerged advisory/reference document**, not a new C02 authority. **F15/F16/U10/U19** should inspect its useful UX/performance evidence before replacing it or treating its benchmarks as executed tests. It must receive a documented merge/supersede disposition just like code PRs.

## 6. Remaining platform-wide problems outside individual R/C feature PRs

- **DB/restore/portability:** production-safe migration-only path; PG18/pgvector extension/roles/manifests; `/readyz` vs `/healthz`; real encrypted off-account backup and restored copy; no demo bootstrap; worker outbox reconciliation; no split-brain after cutover. Account/provider-level verification still not done.
- **Platform production runtime:** verified deployed release SHA vs GitHub `main`, stable HTTPS custom API DNS, Railway `NEEDS_APPROVAL`, fixed-IP relays, secret references, Work/Firebase Android signing, alerting, monitoring, privacy-safe observability, Android/iOS permissions.
- **Customer trust:** KYC/AML/region/asset eligibility for crypto, receipts and refunds for provider-lost callbacks, deletion/legal audit retention and contact privacy; clear support escalation with actual task/operation references.
- **Agent maturity:** compiled scoped memory, budgets, multi-step task/workflow execution, background work opt-in, approved skills, actual model outputs/documents, Gemini Live and tool security. Some old numbered work tasks remain unchecked even with partial recent source; see 79-row crosswalk.
- **Product adoption:** Contacts/New message usable without uploading phonebook; shareable public Talk/Twin profile and invitations; no promise global E2EE/peer calls/groups or arbitrary third-party WhatsApp takeover.
- **Release:** Flutter remains canonical; Shorebird policy planned but `shorebird init`/base/patched/rollback/device-signing proofs are not executed. No product finish claim until genuine end-to-end tests.

## 7. Required action to reconcile the plan (not just append prose)

1. Keep original **U01–U20 assigned exactly as already issued** so currently launched windows do not invalidate ownership.
2. Add **U21–U30** for missing Contacts, phonebook opt-in, invitations, message-request controls, approved proactivity, channel integration, admin capability controls, verified research, customer support and cross-product people/Talk/agent discovery.
3. Explicitly define **F01–F18** as recovery of the **existing 27 R/C rows**, not fresh parallel reimplementation. Each F owner adopts/reconciles existing draft PR(s) and coordinates shared integrations via delegated claims. High-conflict F lanes may be scheduled after U source has been pushed.
4. Link **all 79 historical unchecked tasks** to R/C/U/F or mark FUTURE/NEEDS-OWNER-DECISION, never promote unchecked status to done on the strength of a planning table.
5. Extend golden journeys **K13–K20** for the Contacts lifecycle and assign a human UI acceptance owner; every extra U/F scope carries actual auth/DB/API/Flutter/restart/negative tests.
6. Put this correction at the **top** of `CONTINUE-HERE.md`, main docs index and per-window handoff. New windows must read the corrected master work allocation before claiming; previously assigned U windows continue their unique paths and report any newly discovered integration collision.
7. **Consolidation sequencing:** R/C source recovery and U01 single operator contract first; integrate real C01/C02/C03/C04/C05/C07 Gateway/Flutter and R17/C08; then U21 Contacts through Chats and U08 contextual DM AI; R05–R08 financial proof, LiveKit/FCM/profiles/replay; finally physical devices, database restore, release signing, Shorebird QA. No hard production claim from feature flags.

## 8. Current release-go/no-go

**GO** for isolated, non-competing source coding/tests in owned U or available F paths, with reviewed drafts and exact claims. **NO-GO** for marking any incomplete R/C release item DONE, unsafe unreviewed PR merges, customer crypto/billing enablement, native signing patch, automatic phonebook upload, all-message AI analysis, or app-store distribution without real evidence.

**Completeness is not a number of windows.** The final Work integrator should publish one line per R01–R19, C01–C08, U01–U30, F01–F18 and K01–K20 with code status, actual merged SHA, test/device/provider/voice results and outstanding blockers. A historical 150-task entry may be source-present but still be unchecked; preserve that distinction until executed evidence exists.
