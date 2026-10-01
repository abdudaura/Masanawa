# Phase 0B Coverage — OpenClaw Agent Skills

Pinned revision: `openclaw/agent-skills@edf1e2f436fa2a5375c98052180a090a57223f9e`.

Status: **COVERED at the pinned revision**.

Role: developer/acceptance workflow donor only. This repository does not become a Masanawa runtime skill engine or canonical SkillVersion registry.

## Repository inventory

Pinned `scripts/validate-skills` defines the canonical inventory rule: every immediate `skills/*/SKILL.md` entry is a skill and must contain YAML frontmatter with non-empty `name` and `description`.

Pinned README and direct file inspection yield exactly **8 skills**:

1. `agent-transcript`
2. `autoreview`
3. `behavior-validator`
4. `beam`
5. `crabbox`
6. `handoff`
7. `readme-standard`
8. `session-viewer`

Mapped: **8 / 8**.

## Repository-wide validation contract

Pinned `scripts/check-skills` is the authoritative local/CI check orchestrator. It runs:
- frontmatter validation;
- shell syntax validation for review harness;
- Python syntax compilation for repository scripts;
- installer/validator/checker unit tests;
- AutoReview core/hardening/boundary tests;
- Node syntax checks;
- agent-transcript, Beam and session-viewer tests;
- TypeScript typecheck for session-viewer.

The hardening suite is explicitly sharded by discovered test IDs and refuses empty/duplicate discovery.

Masanawa disposition: **A/B as authoring/acceptance tooling behavior**, never runtime authority.

## Skill dispositions

### 1. agent-transcript

Class: **A/B developer privacy/provenance tooling**.

Selected behavior:
- transcript creation only on explicit request;
- preview is not publication authorization;
- raw logs never uploaded;
- bounded local discovery/read limits;
- visible truncation provenance must survive trimming/export;
- source truncation cannot be described as completeness;
- trim/redact before preview/publication;
- system/developer prompts, reasoning, raw tool output, credentials, cookies, local paths and auth URLs are excluded;
- explicit publication scope is separate from ordinary PR-edit authority.

Masanawa destination:
- developer tooling / support-export privacy patterns;
- optional transcript export utility outside canonical runtime state.

Acceptance:
- publication requires explicit destination-scoped authority;
- export retains truncation/provenance facts;
- raw session data is not transmitted.

### 2. autoreview

Class: **A/B acceptance/code-review tooling**.

Selected behavior:
- explicit review target semantics for local/branch/commit modes;
- dirty candidate and committed candidate are not conflated;
- review evidence is frozen and path/scope checked;
- invalid/out-of-repo finding locations fail rather than silently disappearing;
- source-context evidence is immutable and commit/blob-provenanced;
- credential paths remain excluded;
- external conversion/filter commands are not executed merely to collect an untrusted review diff;
- reviewer output is advice/evidence, not automatic mutation authority;
- engine fallback is explicit and bounded rather than hidden;
- result/diagnostic paths distinguish reviewer failure from clean review.

Masanawa destination:
- CI/release/review tooling only.

Acceptance:
- no code mutation or deployment authority comes from a review finding;
- every result binds to exact reviewed source scope;
- review isolation failures are surfaced, not bypassed.

### 3. behavior-validator

Class: **A acceptance/parity tooling**.

Selected behavior:
- prewritten observable behavior contract;
- source-blind execution;
- source access during validation is contamination and produces a blocked outcome;
- each relevant clause must end pass/fail/blocked/out-of-scope;
- anti-cheat probes vary inputs, persistence, retries and generated artifacts;
- only user/operator-visible evidence counts;
- redacted compact evidence;
- failures reproduce against contract clauses, not implementation guesses.

Masanawa destination:
- Phase 1+ parity/release acceptance harness.

Acceptance:
- implementation-aware tests and source-blind behavior validation stay separate;
- a runtime cannot pass merely because tests or UI text claim success.

### 4. beam

Class: **B optional operational/developer sharing skill**.

Selected behavior:
- one explicit sharing request authorizes one snapshot to the named destination;
- redaction occurs locally before upload;
- no raw JSONL, reasoning, system/developer prompts, tool output, environment values, credentials, browser state/cookies or local paths;
- read-only projection only;
- HTTPS required except loopback development;
- authentication token never printed;
- persistent/live synchronization requires separate explicit opt-in;
- dry-run emits sanitized payload without network activity;
- hook failure must not block the coding session.

Masanawa destination:
- optional developer collaboration projection, not production agent state.

Acceptance:
- destination-scoped sharing authority;
- local sanitization precedes egress;
- receiver gains no terminal/filesystem/tool/session-resume authority.

### 5. crabbox

Class: **B developer validation/remote-proof tooling**.

Selected behavior:
- consumer repository decides when remote proof is required;
- provider identity is explicit and preserved;
- untrusted code never runs on credential-hydrated trusted Testbox;
- task-owned leases/checkouts preserve unrelated operator state;
- no provider override based only on duration/hydration convenience;
- remote command dispatch uncertainty is reconciled before retry;
- live-provider proof never substitutes fake credentials;
- cross-OS proof distinguishes actual platform/provider used;
- cleanup targets only task-owned resources;
- proof records provider/id/command/environment/result.

Masanawa destination:
- CI/validation tooling, not runtime cloud-worker authority.

Acceptance:
- source trust determines permitted execution environment;
- remote proof carries source identity and provider evidence;
- credential and budget boundaries remain explicit.

### 6. handoff

Class: **A/B developer continuity tooling**.

Selected behavior:
- standalone prompt for a fresh agent;
- receiving agent independently rechecks repository/CI/current state;
- prompt uses portable identifiers rather than filesystem paths by default;
- no invented facts;
- handoff carries constraints/non-goals/validation expectations;
- handoff does not itself authorize push/merge/close/public-comment actions.

Masanawa destination:
- operational handoff UX / developer-agent continuity.

Acceptance:
- handoff context is advisory starting state, not canonical runtime truth;
- consequential/public actions require their own authority.

### 7. readme-standard

Class: **B developer documentation-quality tooling**.

Selected behavior:
- progressive README structure;
- examples and quickstart must be verified against real commands/APIs;
- relative/external links and badges are checked;
- hardcoded stale release facts are discouraged;
- removed factual content is moved to docs or explicitly identified obsolete.

Masanawa destination:
- repository documentation tooling only.

Acceptance:
- generated docs cannot claim unverified commands/examples as working.

### 8. session-viewer

Class: **B local developer inspection tooling**.

Selected behavior:
- local browser rendering for Codex/Claude/OpenClaw/Pi JSONL;
- complete file read by default;
- truncation only when explicitly requested;
- truncated exports show visible omission warning;
- unexpected EOF fails rather than claiming completeness;
- raw mode is still local export and may contain sensitive content;
- browser picker remains complete-read;
- session HTML is private unless separately redacted/reviewed.

Masanawa destination:
- local support/developer tooling.

Acceptance:
- partial views retain explicit incompleteness provenance;
- local viewer is not a publication/share authorization mechanism.

## Installer/distribution invariants

Pinned `scripts/install-skills` establishes:
- available skill list derives from directories containing `SKILL.md`;
- unknown requested skills fail;
- installation supports symlink or copy;
- dry-run performs validation without mutation;
- force does not waive source/destination overlap protection;
- source and destination trees cannot contain one another;
- replacement operates on the target entry, not by following it into source;
- source-equal target is skipped rather than destroyed.

Masanawa disposition: **A/B** for import/distribution safety.

Canonical Masanawa mapping:
- imported skill source becomes a candidate `SkillVersion`;
- content is normalized/certified by `packages/skills`;
- install/symlink layout is not canonical persistence;
- runtime tool authority still comes from security/tool policy and workflow context.

## Frontmatter/parser boundary

Pinned validator requires only:
- standalone YAML frontmatter delimiters;
- mapping-shaped YAML;
- non-empty string `name`;
- non-empty string `description`;
- YAML aliases rejected.

Masanawa should accept this as a low-friction import format, but certification adds canonical metadata:
- immutable revision/content hash;
- provenance/source commit;
- dependency/capability declarations;
- risk/readiness/certification state;
- tool/runtime requirements;
- tenant/visibility policy where applicable.

The donor frontmatter never bypasses Masanawa certification.

## Security/privacy boundary

Repository-wide retained principles:
- local-first inspection/redaction;
- explicit publication/egress authority;
- destination scope;
- path and source-root validation;
- untrusted-code isolation;
- no raw credential/transcript leakage;
- uncertainty is represented rather than converted into success;
- developer workflow authorization does not imply production/runtime authority.

## Canonical ownership

Per ADR-0008:
- `packages/skills` is sole canonical skill authority;
- OpenJarvis remains primary structural skill parser/manager/executor donor;
- OpenClaw main contributes immutable revision/distribution/session pinning;
- Microsoft Agent Framework contributes progressive disclosure/resource safety;
- ChatWithStars contributes certification/governance;
- OpenClaw Agent Skills contributes developer authoring, packaging, privacy and acceptance-workflow conventions.

No OpenClaw Agent Skills filesystem directory, symlink, local transcript, Beam record, review report or remote proof lease becomes Character, memory, workflow, business or SkillVersion truth.

## Phase 0B closure

Exact skill inventory: **8 / 8**.

Repository-level validation/install scripts: covered.

Direct test orchestration: covered through pinned `scripts/check-skills`.

Unresolved production runtime families: **0** — this donor intentionally contains no production skill runtime.

Unresolved canonical-authority conflicts: **0**.

OpenClaw Agent Skills is therefore **covered** at the pinned revision.
