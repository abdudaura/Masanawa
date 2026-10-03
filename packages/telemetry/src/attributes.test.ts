import { describe, expect, it } from "vitest";
import { privacySafeAttributes } from "./attributes.js";

describe("privacy-safe Skill trace attributes", () => {
  it("admits bounded Skill identity and plan metadata through the canonical allowlist", () => {
    const attributes = privacySafeAttributes({
      "masanawa.skill_root_version.id": "skill-version_root",
      "masanawa.skill_version.id": "skill-version_step",
      "masanawa.skill.step_ordinal": 2,
      "masanawa.skill.trace_kind": "tool",
      "masanawa.skill.plan_hash": `sha256:${"a".repeat(64)}`,
      "masanawa.skill.reference_key": "send-message",
      "masanawa.skill.target_version.id": "skill-version_dependency",
      "masanawa.tool_version.id": "tool-version_exact",
    });

    expect(attributes["masanawa.skill.trace_kind"]).toBe("tool");
    expect(Object.isFrozen(attributes)).toBe(true);
  });

  it("still rejects arbitrary Skill payload content", () => {
    expect(() =>
      privacySafeAttributes({
        "masanawa.skill.prompt": "private prompt content",
      }),
    ).toThrow("not in the default privacy-safe allowlist");
  });
});
