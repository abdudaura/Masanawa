# Deterministic channel routing

Status: Task 098 isolated routing implementation.

## Purpose

WhatsApp and Telegram provider identifiers must never choose a Masanawa Character or
Relationship directly. By the time this router runs, the channel subject must already
have been resolved through proof-backed Identity to a canonical Tenant + User.

This module then resolves the canonical conversational scope:

`Tenant + User -> platform Character -> UserCharacterRelationship`.

## Character selection

Selection is deterministic and fail-closed.

1. If the User has a `UserAgentPreference`, that exact Character is used only when it
   resolves to a valid support `PlatformAgentProfile` in the same Tenant.
2. If no preference exists, the Tenant must have exactly one support platform Character
   with `defaultForNewUsers=true`.
3. Zero defaults is configuration failure.
4. Multiple defaults is configuration failure.
5. An explicit invalid/stale preference is not silently replaced by a fallback Character.

This preserves the product rule that Gwani/Gwana are canonical platform Characters and
that the user/admin-selected default remains authoritative.

## Relationship routing

The selected Character is passed to the canonical Identity
`UserRelationshipProvisioner.getOrCreateForUserCharacter()`.

The returned Relationship must exactly match:

- TenantId;
- UserId;
- selected CharacterId;
- active Relationship state.

A mismatched or archived Relationship fails closed. The router does not create its own
channel relationship table.

## Output

The router returns only canonical scope:

- TenantId;
- UserId;
- CharacterId;
- RelationshipId;
- selection source (`user-preference` or `tenant-default`).

Provider phone numbers, WhatsApp ids, Telegram ids, callback ids, webhook payloads and
channel-specific session ids are intentionally absent.

## Integration boundary

The owning Gateway composition should call these steps in order:

1. authenticate/admit channel webhook;
2. proof-backed channel subject -> canonical User resolution;
3. deterministic channel router from this module;
4. existing CharacterSession/AgentRun admission using the returned Relationship scope.

This slice does not edit shared Gateway composition or open sessions itself.
