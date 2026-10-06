# Twin voice/chat-first production integration — 2026-10-06

Status: ACTIVE
Branch: `work/twin-voice-chat-first-prod-20261006`
Base: production integration PR #136 head `0235e7b570689bcdfae432a97eba0ff2bab65f38`

The former #136 ownership lease was inactive for more than five minutes and is reclaimable under the current multi-window coordination rule. This lane layers only the requested Twin/chat-first product changes on top of the existing production integration contracts.

Scope:
- Twin creation begins with only gender, age, and Twin photo.
- Setup continues as a voice-preferred Gwani conversation and completes through the canonical resumable clone-onboarding flow.
- No language picker or persisted user language preference. Agents mirror the language used on each current turn and switch naturally when the user switches.
- Twin completion surfaces the canonical public/referral link and Gwani explains it conversationally in the user's current language.
- Apply the approved Hausa Gwani/Gwana portraits as mobile profile-image fallbacks.
- Keep the real production Wallet/Crypto transports from #136, but present them through conversational/audio-preferred entry points rather than a finance-dashboard-first UX.

Boundaries:
- preserve canonical migrations, billing settlement, NOWPayments custody/payout contracts, auth, and production secrets;
- do not fork Commerce, Twin profile, or clone-onboarding state machines;
- no production deploy from this lane.

Validation:
- inspect all changed source against the #136 production contracts;
- run CI when GitHub runners execute; never claim a pass when the runner does not start.
