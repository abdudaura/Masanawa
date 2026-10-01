import { PlatformError } from "@masanawa/contracts";
import type { StoryArcState } from "./model.js";

const allowedTransitions: Readonly<Record<StoryArcState, ReadonlySet<StoryArcState>>> = {
  planned: new Set(["planned", "active", "retired"]),
  active: new Set(["active", "completed", "retired"]),
  completed: new Set(["completed", "retired"]),
  retired: new Set(["retired"]),
};

export function assertStoryArcTransition(
  current: StoryArcState,
  next: StoryArcState,
): void {
  if (!allowedTransitions[current].has(next)) {
    throw new PlatformError({
      code: "world.story_arc_transition_invalid",
      category: "conflict",
      message: `Story arc cannot transition from ${current} to ${next}`,
      retryable: false,
    });
  }
}
