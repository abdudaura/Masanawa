# Masanawa Domain Model

## Core aggregates

### Character
Owns durable identity and public continuity.
- Character ID and slug
- active identity version
- disclosure status
- voice/appearance/avatar references
- language profile
- expertise bindings
- relationship graph references
- world role
- memory policy references
- social/channel identities

Character identity changes are versioned. No channel-specific copy may silently override canonical identity.

### User
Represents a platform human subject independent of channel identity.

Channel identities (web account, WhatsApp number, Telegram user, etc.) resolve to a platform user through explicit linking and verification.

### UserCharacterRelationship
Owns private relationship state between one user and one character.
- relationship tone/state
- private scoped memories
- conversation summaries
- promises/follow-ups
- task history references
- modality/language preferences
- handoff preferences

### World
Owns shared fictional truth.
- world clock
- character life states
- shared events
- routines
- character-to-character relationships
- story arcs
- commitments

### Task
Owns useful work requested by a user/character/system.
- requester
- owning character
- workflow instance
- state
- confirmed entities
- approvals
- price/payment state
- attempts/receipts
- output/artifacts

### Skill
A reusable versioned workflow/capability composition.

### Tool
An atomic callable implementation boundary.

### Provider
A concrete external or local implementation used by tools/presence/media/intelligence.

### PresenceSession
Ephemeral/live media session metadata linked to canonical user, character and conversation/session.

## Identity hierarchy

```
Organization
  |
  +-- World/Product
       |
       +-- Character
             |
             +-- IdentityVersion
             +-- VoiceRef
             +-- AppearanceRef
             +-- ExpertiseBindings
             +-- SocialAccounts
```

## Interaction hierarchy

```
PlatformUser
   |
   +-- UserCharacterRelationship
           |
           +-- Conversations
           +-- Memories
           +-- Tasks
           +-- Promises
```

## State separation

Never combine these scopes:
1. immutable/versioned authored identity;
2. mutable shared character life state;
3. private user-character relationship state;
4. active session/conversation state;
5. task/workflow state;
6. provider/external transaction state.

## Character context compilation

Runtime context is a projection, not storage. It may include only the relevant portions of the scopes above.

## Handoffs

Cross-character handoff transfers a bounded envelope:
- source/destination character;
- user;
- task/conversation IDs;
- current request;
- confirmed entities;
- unresolved questions;
- approvals/payment state;
- safe relevant memory snippets;
- language/modality;
- reason;
- source/target skill;
- privacy classification.

It never clones an entire relationship memory space.

## Multi-tenancy

Organization/tenant boundaries must be explicit on all operational data where multiple organizations can exist. Even if the first deployment is single-company, the schema should not make global singleton assumptions that later force a destructive redesign.
