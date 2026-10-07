# Channel-aware Agent runtime and Twin routing

Owner/window: current ChatGPT window
Branch: `work/channel-aware-twin-routing-20261007`
Base: `main` @ `47b16c19598448835e09f9616da791a69e46054d`
Started: 2026-10-07

## Scope
Make WhatsApp and Telegram first-class Masanawa conversational surfaces rather than
generic transports.

Acceptance:
- every Agent turn receives explicit surface context;
- model gets channel-specific behavior/capability guidance;
- channel replies do not invent app-only UI;
- users can switch from Gwani/Gwana to a public Twin by conversational request and back;
- switching uses canonical public Twin identity and canonical Character sessions;
- free public Twin text remains free on WhatsApp/Telegram;
- existing billing, crypto, Teaching, Wallet and memory stay in the canonical runtime;
- channel link/session state persists the currently selected Character for continuity;
- tests cover surface context, app-only handoff constraints, Twin switch, return-to-Gwani,
  duplicate/exact-once behavior, and unauthorized/non-public Twin rejection.


## Implemented

- Added `mobile | whatsapp | telegram` surface context to the provider-neutral Agent strategy seam.
- Added `platform-agent | public-twin` representation context.
- Production strategy now injects channel-specific UX rules and explicit capability boundaries.
- Channel bridge passes surface/representation on text and media turns.
- Added deterministic public Twin navigation from names, `@publicId`, and share links.
- Exact IDs resolve before fuzzy name search; ambiguous names return choices.
- Hidden/blocked/non-discoverable Twins remain inaccessible through the canonical directory.
- Selected Character is persisted on the channel link and the previous CharacterSession is closed when possible.
- Added return-to-Gwani/Gwana routing.
- Added focused strategy and channel Twin-routing tests.
- Documented the support matrix in `docs/CHANNEL-CUSTOMER-EXPERIENCE.md`.

External evidence still required: real WhatsApp/Telegram device/provider conversation smoke tests.


## Final channel UX/safety hardening

- Telegram explicit group/supergroup chats are ignored before Agent or financial execution.
- A Telegram sender's own verified contact can provision/link the same canonical Masanawa
  phone identity instead of requiring app-first signup.
- Short numbered Telegram choices become a one-tap reply keyboard.
- Twin ambiguity choices use `@publicId` buttons so the next tap performs canonical exact
  Twin resolution.
- WhatsApp retains reliable numbered text choices under linked-device transport.


## Verification status

GitHub Foundation CI run 37575539440 failed before runner assignment:
`runner_id=0`, empty runner name and `steps=[]`. This is the existing hosted-runner
allocation failure and is not a code/test execution result.

A manual type review caught and fixed typed Vitest mock argument issues in the new
surface and Telegram reply-keyboard tests before merge. No green hosted execution is
claimed until GitHub actually assigns a runner.
