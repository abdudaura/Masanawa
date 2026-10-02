# Skill Manifest and Import Format

Status: canonical authoring/import contract for production Task 060.

Masanawa owns canonical Skill and SkillVersion state in `@masanawa/skills`. Files,
Markdown and external repositories are untrusted authoring inputs. Successful parsing
creates a **quarantined import candidate**, never a certified or executable SkillVersion.

## Native manifest v1

The native manifest is a JSON object validated against `SkillManifestV1Schema`:

```json
{
  "schemaVersion": 1,
  "key": "research.web",
  "version": "1.0.0",
  "name": "Web Research",
  "description": "Researches public sources.",
  "entrypoint": "SKILL.md",
  "visibility": "model-visible",
  "activationExamples": ["Research this topic"],
  "negativeActivationExamples": ["Do not browse"],
  "resources": [
    { "path": "references/guide.md", "kind": "reference" }
  ]
}
```

Required fields are `schemaVersion`, `key`, `version`, `name`, `description`
and `entrypoint`. Unknown properties are rejected. Optional lists default to empty
and visibility defaults to `model-visible`.

Task 061 will extend capability and Tool requirement semantics. Task 062 owns
dependency-graph validation. Those concerns are deliberately not hidden in Task 060.

## SKILL.md compatibility

`importSkillMarkdown` accepts the small routing-oriented convention used by the
OpenClaw Agent Skills donor:

```markdown
---
name: Research Assistant
description: Researches public information
---
Instructions live here.
```

Masanawa requires exact `key` and `version` from the import descriptor rather than
guessing identity from a filename or filesystem discovery order. The compatibility
parser intentionally supports only `name` and `description` frontmatter. It is not a
general YAML interpreter.

## Resource safety

Manifest resources use relative POSIX paths only. Absolute paths, Windows paths,
backslashes, empty segments, `.`, `..`, duplicate paths and NUL bytes are rejected
before any resource is admitted.

Resource kinds are `reference`, `asset`, `template` and `script`. Scripts are
skipped by default and are included only when the importer explicitly supplies
`allowScripts: true`. This import-time opt-in is not execution authorization.
Execution/certification policy still applies later.

Any filesystem/resource adapter added later must re-check containment and symlink
safety at use time; a safe manifest path alone is not proof that a resolved filesystem
target is safe.

## Provenance and quarantine

Every candidate records:
- source system;
- source reference;
- optional exact source revision;
- trust tier;
- a deterministic SHA-256 fingerprint of normalized manifest + instructions;
- imported resources and scripts skipped by policy.

An import candidate has state `quarantined`. It intentionally has no canonical
`SkillId`, `SkillVersionId`, certification or readiness state. Import therefore
cannot silently activate external content.

## Limits

Manifest strings, examples, resources and instructions are bounded. Unsupported schema
versions and unknown properties fail closed. Source text is normalized only for line
endings/outer whitespace used by the candidate; production SkillVersion creation
remains a separate governed operation.
