import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  toInstant,
  type SkillVersionId,
} from "@masanawa/contracts";
import {
  normalizeSkillCertification,
  type SkillCertification,
  type SkillRehearsalCaseEvidence,
} from "./certification.js";

function rehearsal(
  caseKey: string,
  kind: SkillRehearsalCaseEvidence["kind"],
  outcome: SkillRehearsalCaseEvidence["outcome"] = "passed",
): SkillRehearsalCaseEvidence {
  return {
    caseKey,
    kind,
    outcome,
    observedAt: toInstant("2026-10-03T00:00:00.000Z"),
    evidenceRef: `rehearsal://foundation/${caseKey}`,
    evidenceHash: `sha256:${"a".repeat(64)}`,
  };
}

function certification(
  skillVersionId: SkillVersionId,
  overrides: Partial<SkillCertification> = {},
): SkillCertification {
  const cases =
    overrides.cases ??
    [
      rehearsal("activation.basic", "activation"),
      rehearsal("negative.basic", "negative-activation"),
    ];
  return {
    subjectSkillVersionId: skillVersionId,
    profile: "foundation",
    suiteKey: "skills.foundation",
    suiteRevision: "2026.10.03",
    suiteContentHash: `sha256:${"b".repeat(64)}`,
    certifiedAt: toInstant("2026-10-03T00:01:00.000Z"),
    certifierKey: "masanawa.foundation",
    cases,
    testCaseCount: cases.length,
    passedTestCaseCount: cases.filter(
      (item) => item.outcome === "passed",
    ).length,
    ...overrides,
  };
}

describe("Skill rehearsal and certification evidence", () => {
  it("normalizes immutable exact-version-bound rehearsal evidence", () => {
    const skillVersionId = createCanonicalId("skill-version");
    const normalized = normalizeSkillCertification(
      certification(skillVersionId),
      skillVersionId,
    );

    expect(normalized.subjectSkillVersionId).toBe(skillVersionId);
    expect(normalized.suiteKey).toBe("skills.foundation");
    expect(normalized.testCaseCount).toBe(2);
    expect(normalized.passedTestCaseCount).toBe(2);
    expect(normalized.cases.map((item) => item.kind).sort()).toEqual([
      "activation",
      "negative-activation",
    ]);
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(Object.isFrozen(normalized.cases)).toBe(true);
    expect(normalized.cases.every(Object.isFrozen)).toBe(true);
  });

  it("rejects certification evidence bound to another SkillVersion", () => {
    const expected = createCanonicalId("skill-version");
    const other = createCanonicalId("skill-version");

    expect(() =>
      normalizeSkillCertification(
        certification(other),
        expected,
      ),
    ).toThrow("exact SkillVersionId");
  });

  it("requires both positive and negative activation rehearsal coverage", () => {
    const skillVersionId = createCanonicalId("skill-version");
    const cases = [
      rehearsal("activation.basic", "activation"),
      rehearsal("activation.alternate", "activation"),
    ];

    expect(() =>
      normalizeSkillCertification(
        certification(skillVersionId, {
          cases,
          testCaseCount: 2,
          passedTestCaseCount: 2,
        }),
        skillVersionId,
      ),
    ).toThrow("activation and negative-activation");
  });

  it("rejects failed rehearsal cases and counters detached from evidence", () => {
    const skillVersionId = createCanonicalId("skill-version");
    const failedCases = [
      rehearsal("activation.basic", "activation"),
      rehearsal(
        "negative.basic",
        "negative-activation",
        "failed",
      ),
    ];

    expect(() =>
      normalizeSkillCertification(
        certification(skillVersionId, {
          cases: failedCases,
          testCaseCount: 2,
          passedTestCaseCount: 1,
        }),
        skillVersionId,
      ),
    ).toThrow("every rehearsal case to pass");

    expect(() =>
      normalizeSkillCertification(
        certification(skillVersionId, {
          testCaseCount: 99,
        }),
        skillVersionId,
      ),
    ).toThrow("counters must match rehearsal evidence");
  });

  it("rejects duplicate case identities and evidence observed after certification", () => {
    const skillVersionId = createCanonicalId("skill-version");
    const duplicateCases = [
      rehearsal("same.case", "activation"),
      rehearsal("same.case", "negative-activation"),
    ];

    expect(() =>
      normalizeSkillCertification(
        certification(skillVersionId, {
          cases: duplicateCases,
          testCaseCount: 2,
          passedTestCaseCount: 2,
        }),
        skillVersionId,
      ),
    ).toThrow("case keys must be unique");

    const futureCase: SkillRehearsalCaseEvidence = {
      ...rehearsal("negative.future", "negative-activation"),
      observedAt: toInstant("2026-10-03T00:02:00.000Z"),
    };
    const futureCases = [
      rehearsal("activation.basic", "activation"),
      futureCase,
    ];

    expect(() =>
      normalizeSkillCertification(
        certification(skillVersionId, {
          cases: futureCases,
          testCaseCount: 2,
          passedTestCaseCount: 2,
        }),
        skillVersionId,
      ),
    ).toThrow("cannot be observed after certification");
  });
});
