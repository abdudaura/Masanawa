import {
  isCanonicalId,
  toInstant,
  type Instant,
  type SkillVersionId,
} from "@masanawa/contracts";

export const skillRehearsalCaseKinds = [
  "activation",
  "negative-activation",
  "contract",
  "execution",
  "recovery",
] as const;

export type SkillRehearsalCaseKind =
  (typeof skillRehearsalCaseKinds)[number];

export const skillRehearsalOutcomes = ["passed", "failed"] as const;

export type SkillRehearsalOutcome =
  (typeof skillRehearsalOutcomes)[number];

export interface SkillRehearsalCaseEvidence {
  readonly caseKey: string;
  readonly kind: SkillRehearsalCaseKind;
  readonly outcome: SkillRehearsalOutcome;
  readonly observedAt: Instant;
  readonly evidenceRef: string;
  readonly evidenceHash: string;
}

export interface SkillCertification {
  readonly subjectSkillVersionId: SkillVersionId;
  readonly profile: string;
  readonly suiteKey: string;
  readonly suiteRevision: string;
  readonly suiteContentHash: string;
  readonly certifiedAt: Instant;
  readonly certifierKey: string;
  readonly cases: readonly SkillRehearsalCaseEvidence[];
  readonly testCaseCount: number;
  readonly passedTestCaseCount: number;
}

const tokenPattern =
  /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const revisionPattern =
  /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const sha256Pattern = /^sha256:[0-9a-f]{64}$/u;

function bounded(
  value: string,
  name: string,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > maxLength) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function normalizedToken(
  value: string,
  name: string,
  maxLength = 256,
): string {
  const normalized = bounded(value, name, maxLength).toLowerCase();
  if (!tokenPattern.test(normalized)) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function normalizedRevision(value: string): string {
  const normalized = bounded(
    value,
    "skill.certification.suiteRevision",
    256,
  );
  if (!revisionPattern.test(normalized)) {
    throw new TypeError(
      "skill.certification.suiteRevision is invalid",
    );
  }
  return normalized;
}

function normalizedHash(value: string, name: string): string {
  const normalized = bounded(value, name, 71).toLowerCase();
  if (!sha256Pattern.test(normalized)) {
    throw new TypeError(`${name} must be sha256:<64 lowercase hex>`);
  }
  return normalized;
}

function normalizeCase(
  input: SkillRehearsalCaseEvidence,
  certifiedAt: Instant,
): SkillRehearsalCaseEvidence {
  if (
    !(skillRehearsalCaseKinds as readonly string[]).includes(input.kind)
  ) {
    throw new TypeError("skill rehearsal case kind is invalid");
  }
  if (
    !(skillRehearsalOutcomes as readonly string[]).includes(input.outcome)
  ) {
    throw new TypeError("skill rehearsal case outcome is invalid");
  }

  const observedAt = toInstant(input.observedAt);
  if (observedAt > certifiedAt) {
    throw new TypeError(
      "skill rehearsal evidence cannot be observed after certification",
    );
  }

  return Object.freeze({
    caseKey: normalizedToken(
      input.caseKey,
      "skill.certification.case.caseKey",
      200,
    ),
    kind: input.kind,
    outcome: input.outcome,
    observedAt,
    evidenceRef: bounded(
      input.evidenceRef,
      "skill.certification.case.evidenceRef",
      2_000,
    ),
    evidenceHash: normalizedHash(
      input.evidenceHash,
      "skill.certification.case.evidenceHash",
    ),
  });
}

export function normalizeSkillCertification(
  input: SkillCertification,
  expectedSkillVersionId: SkillVersionId,
): SkillCertification {
  if (!isCanonicalId("skill-version", expectedSkillVersionId)) {
    throw new TypeError(
      "expected certification SkillVersionId is invalid",
    );
  }
  if (
    !isCanonicalId("skill-version", input.subjectSkillVersionId) ||
    input.subjectSkillVersionId !== expectedSkillVersionId
  ) {
    throw new TypeError(
      "skill certification must bind the exact SkillVersionId",
    );
  }

  const certifiedAt = toInstant(input.certifiedAt);
  if (
    !Array.isArray(input.cases) ||
    input.cases.length < 2 ||
    input.cases.length > 10_000
  ) {
    throw new TypeError(
      "skill certification requires bounded rehearsal case evidence",
    );
  }

  const cases = input.cases.map((item) =>
    normalizeCase(item, certifiedAt),
  );
  const caseKeys = cases.map((item) => item.caseKey);
  if (new Set(caseKeys).size !== caseKeys.length) {
    throw new TypeError(
      "skill certification rehearsal case keys must be unique",
    );
  }

  const kinds = new Set(cases.map((item) => item.kind));
  if (!kinds.has("activation") || !kinds.has("negative-activation")) {
    throw new TypeError(
      "skill certification requires activation and negative-activation rehearsal evidence",
    );
  }

  const passedTestCaseCount = cases.filter(
    (item) => item.outcome === "passed",
  ).length;
  if (
    !Number.isSafeInteger(input.testCaseCount) ||
    input.testCaseCount !== cases.length ||
    !Number.isSafeInteger(input.passedTestCaseCount) ||
    input.passedTestCaseCount !== passedTestCaseCount
  ) {
    throw new TypeError(
      "skill certification counters must match rehearsal evidence",
    );
  }
  if (passedTestCaseCount !== cases.length) {
    throw new TypeError(
      "certified SkillVersion requires every rehearsal case to pass",
    );
  }

  return Object.freeze({
    subjectSkillVersionId: input.subjectSkillVersionId,
    profile: normalizedToken(
      input.profile,
      "skill.certification.profile",
    ),
    suiteKey: normalizedToken(
      input.suiteKey,
      "skill.certification.suiteKey",
    ),
    suiteRevision: normalizedRevision(input.suiteRevision),
    suiteContentHash: normalizedHash(
      input.suiteContentHash,
      "skill.certification.suiteContentHash",
    ),
    certifiedAt,
    certifierKey: normalizedToken(
      input.certifierKey,
      "skill.certification.certifierKey",
    ),
    cases: Object.freeze(
      [...cases].sort((left, right) =>
        left.caseKey.localeCompare(right.caseKey),
      ),
    ),
    testCaseCount: input.testCaseCount,
    passedTestCaseCount: input.passedTestCaseCount,
  });
}
