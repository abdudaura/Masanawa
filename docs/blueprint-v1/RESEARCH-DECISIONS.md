# Research, product differentiation and decision register
Status: **RESEARCHED INITIAL PASS / OWNER REVIEW PENDING**, 2026-10-10.

## What established products teach us
| Reference | Verified pattern | Adopt | Avoid / differentiation |
|---|---|---|---|
| WhatsApp | Lock voice recording, preview, seek, resume/delete/send before publishing [1] | Familiar one-field composer; send when text exists, mic otherwise; draft safety | Separate clone/agent controls crowding the composer |
| Telegram | Voice trimming and channel DMs [2]; groups, voice sessions, bots with explicit permissions [3] | Media preview, simple role/permission controls, discreet AI labeling | Building a Telegram-sized universal app or unsupported personal-account automation |
| Spotify creator ecosystem | Following, comments, creator discovery and consumption metrics [4]; 30-second podcast-play definition [5] | Follow/Discover, real play thresholds, user-owned draft library | Recommendation-optimization or endless public live sessions at first release |
| Google Android guidance | Offline-first reading with local data source and queued critical writes [6] | Instant cached lists, account-fenced outbox, reliable receipts/status | Pretending queued money instructions are successfully paid |
| Existing Masanawa | Audio-first Talks + service Gwani + wallet/chat/rooms with reusable foundations [7] | Distinctive accessible spoken utility, AI persona disclosure, service menus + typed/voice entry | Duplicated purchase/ledger engines, extra bottom tabs, fake automatic payment completion |

Absence of competitor features has **not** been verified: differentiation is a proposed product strategy, not a monopoly claim. Do not copy third-party copyrighted UI assets.

## Feature classification (proposed)
**CORE SOURCE, qualified before exposing:** email/phone auth and recovery; Chats/Contacts/Masana directory; recorded voice notes; accessible Tabs; published Talks + social actions; durable Rooms; Gwani task/quote/receipt; ledger-backed Wallet history/transfers/funding/conversion; safe settings/profile/admin/operations; Telegram/WhatsApp ingress where official authorization exists; coherent content moderation and account/privacy deletion.

**DELIBERATE DIFFERENTIATION:** voice-first Gwani with quick-reply menus and a durable editable task; platform AI personalities clearly disclosed; per-user personal AI twin, funded task execution and auditable commissions after ledger qualification; AI-generated scheduled audio with sources and budget ceilings.

**LATER / independently gated:** live Rooms and video calls, externally monetized third-party clones at scale, advanced teaching/learning and agent marketplaces, extra social ranking algorithms, arbitrary unsupported crypto networks.

**EXCLUDE:** a second wallet/ledger; client-side financial authority; spendable fiat sub-wallet; platform fiat cashout without approved product change; crypto-to-fiat P2P without separate qualification; screenshot-only escrow release; generic browser TTS masquerading as real-time voice; user-facing developer tokens; fabricated phone verification; user personas impersonating humans.

## Decisions requiring owner approval
| ID | Decision | Recommendation | Why not assume |
|---|---|---|---|
| DEC-01 | Overall identity | Audio-first social + trusted AI services + wallet, not a universal agent marketplace | Positioning controls all tabs |
| DEC-02 | Root navigation | Retain confirmed Chats / Rooms / Talks / Gwani / Wallet; Talks center/default | Changing again causes large routing migration |
| DEC-03 | First release scope | Finish all core source in phases; qualify riskier money/calls before enabling | Not every built feature can be exposed at once |
| DEC-04 | User twin | One per account, guided setup, platform handles most choices | Earnings and access semantics still need detailed contract |
| DEC-05 | Commission | Platform owns tariff/margin; clear commission ledger with refund reversals | Current percentages, reserves, payout restrictions unsettled |
| DEC-06 | MSN asset | Internal exact-unit ledger with documented backing, mint/burn and rates | Financial and compliance consequences |
| DEC-07 | P2P | Approved merchants only; pause activation pending settlement/dispute/regulatory review | Screenshots are not bank proof |
| DEC-08 | Provider setup | Retain Flutterwave and NOWPayments adapters, qualify live account/region/network per function | Adapter existence ≠ account capability |
| DEC-09 | App administration | Android admin first; narrow web ops as auxiliary | Admin/security needs role-specific capability review |
| DEC-10 | Channels | Official Telegram Bot API and approved WhatsApp business integration, permission-aware | Personal WhatsApp automation may be fragile or non-compliant |
| DEC-11 | Voice | Gemini Live for real-time Gwani where qualified; independent device voice-note path | Model/device/audio-focus and continuous cost constraints |
| DEC-12 | Deployment | Continue Railway gateway only after trigger review; retain fixed-IP DigitalOcean relay if Flutterwave needs it | Reversible and existing whitelist |
| DEC-13 | Database | Preserve PostgreSQL ledger/migrations; benchmark current provider vs Neon/DO, no forced migration | Restores, connections, residency and cost vary |
| DEC-14 | Languages | Hausa and English launch minimum; existing translations retained; expansion after tested localization | Voice/provider quality language-specific |
| DEC-15 | APK rollout | Existing Flutter signed Android baseline; staged controlled release, rollback and local APK reconciliation | Cannot overwrite unseen working fixes |

## Provider economics: dated inputs, not procurement authorization
- Railway published Hobby at **$5/month including $5 resource usage**, plus usage beyond that [8]. This is not a guaranteed all-in bill.
- DigitalOcean Basic 512MiB shared-CPU starts **$4/month**; suitability for a fixed-IP relay must be confirmed against actual resource load [9].
- Neon announced **1GB storage per free project** 2026-10-02; other quotas, compute and production recovery still matter [10].
- Flutterwave documents Nigeria bill-payment support, KYC, funded source balance and **server-IP whitelisting** [11]; Nigeria collections currently list local 2% fees, but bill margins/provider rates may differ [12].
- Google Gemini **3.8 Live** lists paid audio input about **$0.005/min** and output about **$0.018/min** in the documented pricing schedule, excluding other tokens/traffic/context effects [13]. Do not treat that as a fixed per-minute whole-session price.
- Regulatory and provider eligibility for MSN, P2P, wallet value, custody, crypto, payment collection and payout must be reviewed before external user activation.

## Evidence
[1] https://faq.whatsapp.com/1044960269529733/
[2] https://telegram.org/blog/direct-to-channel-trim-voice-and-more/
[3] https://telegram.org/blog/group-calls-made-easy
[4] https://creators.spotify.com/resources/news/the-new-home-of-podcasting-on-spotify
[5] https://newsroom.spotify.com/2026-06-11/spotify-for-creators-tools-plays-analytics-updates/
[6] https://developer.android.com/topic/architecture/data-layer/offline-first
[7] ../AUDIO-FIRST-PRODUCT-20261009.md
[8] https://docs.railway.com/pricing/plans
[9] https://www.digitalocean.com/pricing/droplets
[10] https://neon.com/blog/neon-free-plan-1-gb-per-project
[11] https://developer.flutterwave.com/docs/bill-payment
[12] https://flutterwave.com/ng/pricing
[13] https://ai.google.dev/gemini-api/docs/pricing

Research was retrieved 2026-10-10. Vendor schedules can change. Estimates require measured workload assumptions, independent account eligibility checks and total-cost review before provider moves.
