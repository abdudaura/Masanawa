# Mobile local redesign propagation — 2026-10-06

Status: active handoff / review-ready
Branch: `work/mobile-local-redesign-propagation-20261006`
Base: `work/mobile-local-redesign-preserve-20261006`

## Product rule

Preserve the locally approved mobile direction as the baseline:

- Masanawa should feel like WhatsApp plus Masanawa services, not a collection of mini-apps.
- Services are primarily conversational. Data, airtime, electricity, TV, crypto, funding, transfer and withdrawal entry actions should open Gwani chat and carry the user's intent into that conversation.
- The locally changed white/grey/blue light theme and reduced chrome are preserved.
- Language is dynamic per conversation turn. Do not present configured Twin languages as a consumer setting or discovery attribute.
- Standalone billing/crypto screens remain compatibility surfaces only; they are not the primary navigation model.

## Changes in this branch

- Preserved local Internet Cafe chat mode and expanded service shortcuts with Crypto.
- Wallet actions now hand off to the platform support agent conversation instead of presenting separate primary workflows.
- Wallet "Bills" primary action is now "Internet Cafe".
- Service intent is passed through the router to the chat and automatically starts the conversational turn.
- Explore delegates Internet Cafe routing to the canonical platform-agent directory rather than searching public Twins for a display-name match.
- Removed language badges from Explore and configured language UI from My Twin.
- Updated My Twin empty-state copy to describe Gwani-led setup.
- Home quick services are presented as compact Internet Cafe conversation shortcuts instead of app-grid tiles.
- Preserved the locally updated white/grey/blue theme tokens and composer changes.

## Coordination

PR #321 (`work/twin-voice-chat-first-20261006`) owns the newer Gwani-led Twin creation/interview completion implementation. Do not replace this branch's redesigned chat file wholesale with that PR's chat file. Reconcile the Twin setup state/completion logic surgically during integration so the local composer/theme/service changes survive.

## Remaining verification

Run Flutter formatting, analyze, relevant widget/unit tests and an Android build after reconciliation in a workspace with the Flutter toolchain.
