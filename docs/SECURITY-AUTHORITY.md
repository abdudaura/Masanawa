# Security and Current-Authority Model

Status: Phase 1 canonical draft.

## Principle

Authentication proves identity evidence. Authorization decides what the current principal may do now. Routing, model intent, session visibility, provider acceptance, and client capability claims are never authorization by themselves.

## Principal types

Canonical Principal is one of:
- User;
- Operator;
- Service;
- Device;
- AgentRun with delegated authority;
- narrowly defined System principal.

Characters are domain identities, not security principals unless an explicit system operation represents them through an AgentRun/System principal.

## Authentication evidence

Authentication produces typed evidence such as:
- platform login/session;
- OAuth subject;
- verified channel transport subject;
- signed device key;
- service credential;
- operator session.

Evidence includes issuer, authentication strength, time, and relevant external subject reference.

Mutable display names/aliases never count as strong identity proof.

## Authorization inputs

A policy decision receives:
- TenantId;
- Principal;
- requested action/capability;
- target resource and resource tenant;
- relationship/world/task scope;
- authentication evidence;
- current policy revision;
- approvals;
- delegation chain;
- environmental constraints such as channel/device/provider;
- current lifecycle state.

It returns allow/deny plus bounded grants/evidence. Absence/unknown fails closed for consequential operations.

## AuthorityContext

AuthorityContext is an immutable admitted snapshot.

It contains:
- authorityContextId;
- tenant;
- principal;
- scopes/capabilities;
- resource constraints;
- policyRevision;
- approval refs;
- delegation ceiling;
- issuedAt;
- optional expiry;
- correlation/request identifiers.

It may travel with queued/child work but cannot override a newer revocation.

## Current-authority assertion

Consequential code uses two stages:

1. prepare/check: potentially asynchronous resolution, approval wait, provider/device lookup;
2. commit/dispatch assertion: synchronous or transaction-local check that the captured authority is still current.

The second check is mandatory when authority can change during the wait.

Examples:
- queued approval settlement;
- session member mutation;
- device command;
- message send on behalf of a requester;
- destructive file/system action;
- payment/commerce fulfillment;
- plugin/runtime ownership replacement.

## Policy revision

Every mutable authorization policy surface has a revision/generation.

Authority prepared under revision N must either:
- prove N is still current at commit; or
- re-evaluate under the latest revision.

Do not silently apply stale allow decisions.

## Tenant isolation

Every durable resource has a tenant owner.

Authorization verifies tenant before relationship/resource permissions.

Cross-tenant access requires an explicit federation/support capability and audited purpose. Operator/global roles do not imply unrestricted ordinary query paths.

## Relationship privacy

Private User-Character Relationship resources require:
- matching User or explicitly authorized operator/service;
- matching Character/relationship scope;
- purpose/capability;
- memory/context scope checks.

A Character's public/shared world role does not grant access to another user's relationship memory.

## Delegation to AgentRun

AgentRun receives an explicit delegated authority ceiling.

Delegation:
- names the parent principal/run;
- lists allowed capabilities/resources;
- carries expiry/policy revision;
- cannot be widened by the model;
- cannot be widened by spawning a child.

Child run authority = intersection(parent delegated authority, child task requirements, current policy).

## Handoffs

Cross-character/agent handoff transfers only explicitly allowed context and delegated capabilities.

Handoff is routing/work delegation, not a new principal or permission source.

Target reauthorizes the requested operation under current policy.

## Approvals

ApprovalRecord states:
`pending -> approved | denied | expired | revoked -> consumed` where relevant.

Approval binds to:
- exact action/tool/version;
- exact normalized arguments/request fingerprint;
- principal;
- tenant;
- resource scope;
- OperationId;
- risk class;
- expiry;
- approver;
- policy revision or compatible policy condition.

Argument/tool/resource/principal changes invalidate approval.

`allow once` consumption is atomic.

Observer/process loss never invents a verdict.

## Operator authorization

Operator roles are separate from User relationship permissions.

At minimum distinguish:
- read;
- write;
- approvals;
- pairing/device administration;
- security/admin;
- support/diagnostics;
- financial adjustment;
- secret access.

High-risk operations use narrower capabilities, not one universal admin boolean.

## Service auth

Service-to-service calls use scoped workload identity.

A service authenticates:
- service identity;
- tenant/request context where applicable;
- audience;
- capability scope;
- expiry/rotation generation.

Internal network location is not authentication.

## Device authority

A paired Device has:
- stable DeviceId;
- credential generation;
- approved capability/command scopes;
- current connection claims;
- local permission state.

Device-advertised commands/capabilities are claims intersected with server policy and pairing approval.

Credential rotation/revocation is explicit.

Uncertain bootstrap credential delivery is represented as uncertainty; a consumed secret is not made reusable merely because the client did not receive confirmation.

## Channel authorization

Inbound channel path order:

1. verify/authenticate transport/provider event where supported;
2. normalize external subject;
3. apply DM/group/account/route/mention/command gates;
4. persist durable admission/dedupe when needed;
5. resolve canonical User/Relationship/Character route;
6. create AuthorityContext;
7. dispatch.

Agent bindings select a target after admission. They never grant sender access.

Quoted/history context visibility is separate from trigger authorization.

## Tool authorization

Tool availability is intersection of:
- certified ToolVersion;
- Skill/Agent requested capability;
- tenant policy;
- Principal/AuthorityContext;
- sandbox/elevated policy;
- device/client capability requirements;
- provider readiness;
- approval requirements.

Deny wins.

Elevated execution changes execution location/posture; it does not mint a denied tool.

## Filesystem/network security

Consequential filesystem access:
- resolves trusted roots;
- rejects path traversal;
- revalidates symlink/ancestor containment at use time;
- uses capability-specific read/write/execute scope.

Server-side URL fetch:
- validates hostname and DNS/IP resolution;
- blocks loopback/link-local/metadata/private/special ranges by default;
- re-evaluates policy on redirect;
- scopes explicit exceptions to host/origin/resource;
- applies same effective policy through proxies/custom dispatchers.

## Secrets

Domain state stores CredentialRef, not raw secrets.

Secret resolution is purpose/destination scoped.

Logs/events/diagnostics redact secret material.

Destination-bound provider/tool secret egress is revoked after operation completion/cancellation/failure.

Active unresolved required SecretRef fails the relevant runtime surface visibly.

## Session visibility

Session visibility is not tenant authorization.

Cross-session reads/sends require both:
- visibility/resource relationship rule;
- current AuthorityContext for the action.

Incognito/private scopes cannot be widened by plugin-supplied cached grants.

## Revocation

Revocation stops future effects.

Already committed/externally dispatched effects settle/reconcile; revocation does not rewrite history.

Queued work rechecks current authority before starting consequential action.

Long-running work checks at meaningful effect boundaries, not only at initial admission.

## Audit

Security-relevant attempts write privacy-minimized AuditEvents:
- authentication success/failure class;
- authorization allow/deny for consequential actions;
- approval creation/settlement;
- role/policy changes;
- device pairing/token rotation/revoke;
- secret-access purpose;
- operator financial/security mutations;
- cross-tenant/support access;
- plugin activation affecting capabilities.

Audit identity/provenance is not itself authorization.

## Privacy-safe diagnostics

Diagnostics may expose operational facts, durations, statuses, bounded IDs, and redacted errors.

Raw prompts, chats, tool outputs, credentials, cookies, private memory, account IDs and host details are omitted by default.

Export/share of sensitive diagnostic artifacts requires explicit current authority and destination-aware handling.

## Acceptance invariants

Phase 2 security tests must prove:
- stale policy cannot commit after async wait;
- child AgentRun cannot expand delegated authority;
- changed tool args invalidate approval;
- allow-once is consumed once under concurrency;
- routing/binding does not grant channel access;
- device capability advertisement cannot bypass approved commands;
- revocation blocks next effect without falsifying already-dispatched outcome;
- cross-tenant access fails closed;
- relationship-private memory cannot enter another relationship context;
- SSRF redirect/DNS rebinding/private-network attempts fail;
- secrets do not appear in default events/logs/telemetry.
