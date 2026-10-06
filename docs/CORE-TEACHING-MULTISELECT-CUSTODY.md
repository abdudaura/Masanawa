# Core Teaching staged multi-select custody

Status: domain/runtime contract hardening.

## Problem

The original `TeachingMultiSelectStagePort` used only:
- actionKey;
- actionBindingHash.

That was enough for an authenticated in-memory/session owner, but not enough for a durable
repository to prove that a stored stage belongs to the exact learner/lesson action. PR #215
therefore correctly refused to persist staged multi-select state in Relationship Memory.

## Durable storage scope

Every stage operation now carries `TeachingMultiSelectStageStorageScope`:

- RelationshipId;
- SkillVersionId;
- RequestId;
- actionKey;
- actionBindingHash.

The coordinator derives this scope only from:
- the admitted `TeachingRuntimeBinding`;
- the exact normalized `TeachingSelectionActionBinding`.

A caller cannot provide arbitrary storage scope independently of the admitted action.

## Port behavior

`TeachingMultiSelectStagePort` now requires the exact scope on:
- create;
- load;
- compare-and-set.

The existing stage revision/hash CAS rules remain unchanged.

A tenant-bound persistence adapter can therefore use a durable identity such as:

`Tenant + Relationship + SkillVersion + RequestId + actionKey + bindingHash`

without trusting the opaque action key as ownership authority.

## What did not change

This slice does not change:
- selectable rubrics;
- staged toggle/commit semantics;
- action expiry;
- stage hash/revision behavior;
- selection evaluation;
- learner progress;
- Shell/WhatsApp/Telegram projections;
- Teaching plan/adaptive lesson logic.

## Next persistence step

A later adapter may now safely implement durable stage custody in a session/pending-action
store or dedicated bounded table.

It must:
1. bind Tenant in the adapter constructor or authenticated call scope;
2. key by the complete storage scope above;
3. enforce exact create replay;
4. enforce expected revision + stage hash CAS;
5. expire/delete stages after action expiry;
6. never promote staged answer state into durable learner Memory before commit.

No Gateway, mobile, channel or PostgreSQL path is claimed here.
