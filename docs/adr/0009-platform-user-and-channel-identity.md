# ADR-0009: Platform User, Channel Identity and Character Relationship

Status: accepted
Date: 2026-10-01

## Decision

Masanawa distinguishes:
1. PlatformUser — global human subject/account;
2. ChannelIdentity — verified/observed external identity on WhatsApp/Telegram/web/etc.;
3. UserCharacterRelationship — private relationship state between one PlatformUser and one Character;
4. Tenant/Organization membership and entitlements.

Entitlement/account identity never substitutes for private character relationship memory.

External opaque IDs are not interpreted as phone numbers or other real-world identifiers unless the channel contract proves that representation.

Identity merging is explicit, tenant-aware where applicable, audited and conservative: dependent state is repointed/deduplicated without loosening privacy/Do-Not-Contact choices.
