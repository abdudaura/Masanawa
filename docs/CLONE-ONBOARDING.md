# Resumable personal clone onboarding

First work item in the user-approved sequence: onboarding, live Teaching, data
purchases, economic views, messaging continuity, crypto operations, recovery/support.
This PR implements the server-side onboarding slice. It does not mark the mobile
journey, deployment or any numbered production gate complete.

## Customer behavior

The authenticated support directory supplies configured Gwani/Gwana identities,
default selection and Bodi/Sulafat voice preferences. No Character IDs or elevated
support roles are hardcoded here. Selecting another support agent delegates to the
existing directory preference service. Missing or conflicting default configuration
returns no selected identity rather than guessing a Character.

Setup asks for a name and languages, with friendly/clear communication defaults.
Biography, personality and expertise are optional refinements. The same profile API
can receive fields collected conversationally or by a simple form. Users are not
asked for prompts, model parameters, provider credentials or Workflow definitions.
This slice intentionally accepts no public-discovery/avatar/clone-voice setting;
those require their owning profile/media/voice contracts before exposure.

Drafts persist privately by canonical Tenant/User. Editing invalidates any preview.
The user must review a complete profile before confirming its exact revision with
one stable canonical RequestId. Confirmation is committed before provisioning.
Confirmed profiles cannot be edited, cancelled or rebound to a different request.
If provisioning or Core setup fails, GET returns the pinned request/revision and a
recover step. Resume that request; never invent a second confirmation.

Actual creation uses `CreatorCloneService` and canonical personal-clone get-or-create
custody. Concurrent/retried provisioning may return an existing clone; it never
authorizes replacing that clone's Constitution with the preview. The final result
includes the actual effective display name and creation flag. Partial presentation
or assignment writes remain repairable through the existing get-or-create path.

Core provisioning consumes current exact automatic `personal-clone` distributions,
requires Core Teaching, checks current dependency eligibility and immutable guidance,
and merges assignments using the existing CAS repository. It preserves optional
assignments, never seeds/certifies Skills, and refuses missing/blocked Core. Runtime
execution must revalidate readiness and authority independently. The view reports
`runtimeReadiness: not-verified`; successful profile/assignment writes do not prove
physical voice, Teaching execution, commercial fulfillment or production rehearsal.

## HTTP surface

| Method | Route | Body |
| --- | --- | --- |
| GET | `/creator/onboarding` | none |
| PUT | `/creator/onboarding/profile` | `expectedRevision` (null for first draft), `profile` patch |
| POST | `/creator/onboarding/preview` | `expectedRevision` |
| POST | `/creator/onboarding/confirm` | `expectedPreviewRevision`, stable `requestId` |
| POST | `/creator/onboarding/cancel` | `expectedRevision` |
| PUT | `/creator/onboarding/support` | `characterId` from the current support directory |

Every route delegates to current authentication; client Tenant/User/price/technical
fields are rejected before Fastify's normal removal of additional properties.
The service reauthorizes after provisioning. Conflict, denial and outage responses
are bounded and never expose vendor/database exceptions or raw profile content.
Failed initial reads cannot be treated as an empty draft by the client.

## Composition for PR #104's owner

The claim explicitly leaves `app.ts`, `main.ts`, `agent_directory.ts`, mobile files,
root config/exports and deployment under their current owners.

1. Apply Identity migration `0003_clone_setup.sql` through existing Identity
   migration discovery. Never edit either previously applied Identity migration.
2. Instantiate `createPostgresCloneSetupRepository(pool)` from `@masanawa/postgres`.
   It is exported through the existing Identity adapter index and root star export.
3. Instantiate `createAutomaticCloneCoreProvisioner` with the existing authorizer,
   personal-clone, assignments, Skills, Guides and distribution repositories.
4. Compose `createCloneOnboardingService` with that Core provisioner, existing
   CreatorCloneService, existing AgentDirectoryService and the setup repository.
5. Register `registerCloneOnboardingRoutes` in the existing Gateway, or use
   `createGatewayWithCloneOnboarding` at `startGatewayService`'s existing appFactory
   seam. The helper composes the same Gateway health/readiness/directory/runtime,
   rather than starting a separate service or creating new authority.
6. Map the view's prompt/nextStep/profile to existing ShellDocument primitives and
   support settings. Bind actions through #104's authenticated opaque dispatcher;
   no label/model output may authorize confirmation. Route action values to these
   methods only after the owner validates current action custody and revision.
7. On restart, GET the server draft. If confirmed, show recovery using its saved
   `confirmationRequestId` and `confirmationPreviewRevision`. If ready, open the
   returned canonical Character; do not create a new identity in the app cache.

**Required privacy gate:** the current main directory lists tenant-visible
presentations, and clone creation marks its presentation visible. Its production
authorizer must restrict private clone visibility to authorized Relationships/users
before this journey is exposed to multiple users. This PR does not edit the
directory owned by #104 or silently claim public discoverability is implemented.
The setup draft is private, but that alone does not prove directory/profile privacy.

The support/Teaching owners must also provision actual Gwani/Gwana and the certified
automatic personal-clone Core bundle. Current main bootstrap distributions do not
provide automatic personal-clone Teaching. This PR deliberately cannot finish Core
setup with an empty assignment or fabricate successful rehearsal evidence.

## Persistence and verification

The new table is Identity-owned profile/provisioning state, not another Character,
relationship, memory, Skill, task or financial engine. Scope serialization plus row
locks enforce revision CAS across connections. Active Tenant/User custody is checked
inside each transaction. Confirmed content/request binding cannot be changed or
deleted directly. Completion binds the result to canonical personal ownership,
active Character/published active CharacterVersion and the user's active Relationship.
Cancelled unconfirmed drafts clear personal profile fields.

Focused tests cover private drafts, revision conflicts, exact replay, interrupted
creation/Core setup, current authority, support selection, strict HTTP input,
redaction, automatic Core assignment and existing Gateway route composition.
The PostgreSQL 18 suite creates an isolated test database, covering independent
connection races, repository restart, lifecycle denial, result ownership, direct DB
immutability and rollback. It requires `MASANAWA_TEST_DATABASE_URL` with test database
creation rights; no production database is used by this suite.

```bash
pnpm exec vitest run packages/identity/src/clone-setup.test.ts services/gateway/src/clone_onboarding.test.ts services/gateway/src/clone_onboarding_routes.test.ts tests/integration/clone-setup.test.ts
```

Local evidence: 49 focused unit/route/shell tests pass; adding package/adapter boundary
checks yields 70 passes. Eight PostgreSQL cases remain skipped in the normal pg suite because no test database
is configured. All eight passed using PGlite 0.5.8 (PostgreSQL 18.3) and a temporary
pool compatibility harness. The harness executes the real migrations, queries and
triggers but serializes transactions and emulates test-database/pool creation; it
does not qualify separate-session races or real process restart. Identity/Gateway/Postgres strict typechecks pass. No native PostgreSQL server,
Windows/Flutter/APK, production deployment or live onboarding pass is claimed.

Finish these item-1 integration/qualification dependencies before declaring onboarding
complete. Continue independent work on later items while shared integration is blocked;
do not interpret this handoff as permission to overwrite active owners.

## Server-generated profile and support screens

`createCloneOnboardingShell` renders existing ShellDocument v1 primitives for the
simple profile form, saved profile review, explicit confirmation, editing, cancel,
interrupted setup recovery, completed profile and support-agent selection. It requires
the existing dispatcher’s durable opaque-token binding store through `issue/resolve`;
there is no new token, session or authority database. Register it only behind current
authenticated conversation/session admission. Never expose `resolve` or the server-only
binding structure as a client endpoint. Persist bindings before sending documents.

Each binding includes Tenant/User, document ID/revision, setup revision/state, command,
node, expiry, and exact confirmation identity or support Character. The executor checks
current creator authority, exact scope, expiry and substitutions before using the
existing onboarding service. Profile changes invalidate old preview actions. Only an
exact already-confirmed request can replay after the setup revision changes. Recovery
projections reuse its saved RequestId rather than starting another creation.

The owner assigns a fresh increasing document revision for each replacement. After
`execute`, render again using its returned mode and replace the document through the
existing event/result path. The v1 input renderer cannot prefill fields, so a saved
profile card shows current values and blank inputs preserve them. Forms carry one Save
action. Preview/edit/cancel/confirm are separate read-only action documents so unsaved
form values cannot accidentally confirm a different profile. A ready view returns the
canonical result; the owner opens that Character through the existing navigation.

Nine bridge regressions pass, including exact recovery, stale preview, forged/cross-user
actions, expiry, hidden-field injection, support selection and current parser bounds.
The SQL qualification also caught and closed SQL CHECK’s NULL-preview-revision escape;
noncanonical confirmation RequestIds are rejected directly by the database.

## Mobile draft/review continuation

The existing clone setup screen now reads the authenticated saved setup before allowing mutations. It saves profile changes, requests a server preview, and requires a separate explicit confirmation. A confirmed setup is immutable in the screen and resumes with the server-persisted request ID. An ambiguous failure requires a saved-status reload; a matching unchanged preview reuses the same pending confirmation ID. Account changes dispose the controller and discard late responses and private form contents. The transport reuses ApiClient's bearer/refresh interceptor, disables redirects, and validates response state and canonical clone IDs. It never calls the legacy one-shot creation endpoint.

The screen says creation succeeded only after a canonical ready result, and does not claim runtime capabilities are verified. Directory refresh precedes opening the canonical clone conversation. This flow still requires composition of the existing clone-onboarding registrar in the shared Gateway; missing registration is a recoverable error, not a locally fabricated draft.

Validation on main a97df254ff04c717e940a7c86f4b5824dea7629d plus owned changes: 49 focused backend tests pass. Mobile DTO/controller/transport tests run against the same source in a standalone Dart harness (only flutter_test imports replaced with package:test); this is not a Flutter widget or device pass. User-owned APK/device verification remains separate.

Current-main full typecheck is blocked by pre-existing imports of missing Agents inference/context/selection/inference_limits and Gateway native_audio files, plus customer_auth's unresolved FinancialAuthorizer. These files belong to active runtime/shared-auth windows and were not added or modified here. Earlier 85-test/typecheck evidence was on the previous isolated baseline and does not establish that current main compiles.
