# Masanawa

Masanawa is an audio-first social and assistant app: published Talks, private Chats, a service Gwani, MSN/crypto Wallet and audio-focused Rooms. New chat opens Masana & Contacts. Bottom navigation is **Chats · Rooms · Talks · Gwani · Wallet**, with Talks centred and the ordinary launch default. Calls are inside Chats.

Start at [CONTINUE-HERE.md](CONTINUE-HERE.md) and [AGENTS.md](AGENTS.md).

- [Current product decisions](docs/AUDIO-FIRST-PRODUCT-20261009.md)
- [Screens and complete journeys](docs/AUDIO-FIRST-SCREEN-SPECS.md)
- [MSN wallet and escrow](docs/MSN-WALLET-P2P-CONTRACT.md)
- [Window plan](docs/AUDIO-FIRST-WINDOW-PLAN-20261009.md)
- [Copyable window prompts](docs/AUDIO-FIRST-WINDOW-PROMPTS-20261009.md)
- [Completeness audit](docs/AUDIO-FIRST-COMPLETENESS-AUDIT-20261009.md)
- [Recovery and old-work reconciliation](docs/AUDIO-FIRST-RECOVERY-20261009.md)
- [Documentation index](docs/README.md)

This documentation captures direction, not verified product delivery. The owner reports a local build; its source/artifact still needs reconciliation here. Existing PRs are preserved and recovered rather than rebuilt.

## Repository principles

One canonical implementation with domain packages, services and Flutter presentation. Reference systems are specifications/donors, never runtime architecture boundaries. Runtime code must not import the reference vault.

Reference repositories are pinned as submodules under references/sources. See [reference instructions](references/README.md) and [source lock](docs/migration/SOURCE-LOCK.md).

main remains the canonical source for ordinary pulls and qualified APK builds once local improvements and dependency-ready work have been integrated. Temporary work/integration branches are not an alternative product source of truth.

Previous cumulative product and launch instructions are preserved in [the archive](docs/archive/20261009/README.md); they no longer override current owner decisions.
