import { describe, expect, it } from "vitest";
import { assertStoryArcTransition } from "./story-arcs.js";

describe("story arc lifecycle", () => {
  it("allows forward progress", () => {
    expect(() => assertStoryArcTransition("planned", "active")).not.toThrow();
    expect(() => assertStoryArcTransition("active", "completed")).not.toThrow();
    expect(() => assertStoryArcTransition("completed", "retired")).not.toThrow();
  });

  it("rejects resurrection or backward transitions", () => {
    expect(() => assertStoryArcTransition("completed", "active")).toThrowError(
      expect.objectContaining({ code: "world.story_arc_transition_invalid" }),
    );
    expect(() => assertStoryArcTransition("retired", "planned")).toThrowError(
      expect.objectContaining({ code: "world.story_arc_transition_invalid" }),
    );
  });
});
