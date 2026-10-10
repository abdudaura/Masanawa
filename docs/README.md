# Documentation index

Current reading order: [continue](../CONTINUE-HERE.md) → [rules](../AGENTS.md) → [product](AUDIO-FIRST-PRODUCT-20261009.md) → [screens](AUDIO-FIRST-SCREEN-SPECS.md) → [money](MSN-WALLET-P2P-CONTRACT.md) → [contracts](AUDIO-FIRST-INTEGRATION-CONTRACTS.md) → [recovery](AUDIO-FIRST-RECOVERY-20261009.md) → [allocation](AUDIO-FIRST-WINDOW-PLAN-20261009.md) → [prompts](AUDIO-FIRST-WINDOW-PROMPTS-20261009.md) → [acceptance](WHOLE-PRODUCT-ACCEPTANCE-JOURNEYS.md).

Current canonical entrypoints PRODUCT-NORTH-STAR, APP-SHELL-CONTRACT, TALKS-PRODUCT, MOBILE-SCREEN-ARCHITECTURE, END-TO-END-UX-ARCHITECTURE and CONSUMER-SERVICES point to these same contracts rather than maintain conflicting copies.

Existing architecture/security/domain references remain useful: ARCHITECTURE.md, PACKAGE-BOUNDARIES.md, SECURITY-AUTHORITY.md, SECURITY-MODEL.md, PRIVACY-SCOPES.md, API-LIFECYCLE.md, EVENT-CONTRACTS.md and provider qualification runbooks. Read only those relevant to the claimed slice; current owner product decisions win conflicts.

Existing DEFAULT-AI-PERSONAS.md retains persona profiles; its live-stage product assumptions are superseded by the current Talks publishing/Rooms separation. FLUTTER-RELEASE-AND-SHOREBIRD-POLICY.md remains applicable.

Historical launch, readiness and recovery originals are [archived](archive/20261009/README.md). Old task IDs remain traceable in [recovery](AUDIO-FIRST-RECOVERY-20261009.md); none is auto-completed by moving a document.

Latest confirmed shell: **Chats · Rooms · Talks · Gwani · Wallet**; Talks centre/default. Read the [completeness audit](AUDIO-FIRST-COMPLETENESS-AUDIT-20261009.md) for unresolved boundaries and activation gates.


## Further whole-app inspection

Read [source findings and Settings contract](WHOLE-APP-SOURCE-AUDIT-20261009.md), [all-screen inventory](WHOLE-APP-SCREEN-INVENTORY-20261009.json) and [backend/storage/operations gates](BACKEND-STORAGE-OPERATIONS-20261009.md). These extend the prior planning audit with actual source observations; none certifies runtime completeness. AF14 owns Settings/account/activity; AF15 owns reusable media/operational lifecycle and DB/storage qualification proposals. The allocation now has sixteen slots; concurrency remains limited.
