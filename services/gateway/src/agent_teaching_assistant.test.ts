import { describe, expect, it, vi } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import type {
  TeachingProgress,
  TeachingProgressRepository,
} from "@masanawa/skills";
import { createAgentTeachingAssistant } from "./agent_teaching_assistant.js";

describe("Agent Teaching assistant", () => {
  it("strips hidden learning state and persists relationship-scoped progress", async () => {
    const upsert = vi.fn(async (_progress: TeachingProgress) => undefined);
    const repository: TeachingProgressRepository = {
      async read() { return null; },
      upsert,
    };
    const assistant = createAgentTeachingAssistant({
      repository,
      now: () => "2026-10-07T12:00:00.000Z",
    });
    const scope = {
      tenantId: createCanonicalId("tenant"),
      userId: createCanonicalId("user"),
      characterId: createCanonicalId("character"),
      relationshipId: createCanonicalId("relationship"),
    };
    const preparation = await assistant.prepare({
      scope,
      text: "<masanawa_study>Teach me fractions",
    });
    expect(preparation).not.toBeNull();

    const result = await assistant.finish({
      preparation: preparation!,
      modelReply:
        "A fraction is part of a whole. Try 1/2 + 1/2. " +
        '<masanawa_learning_state>{"topic":"Fractions","goal":"Understand basic fractions","level":"beginner","checkpoint":"Introduced halves","nextStep":"Add simple fractions","masteryNotes":["Recognizes halves"]}</masanawa_learning_state>',
    });

    expect(result.reply).toBe("A fraction is part of a whole. Try 1/2 + 1/2.");
    expect(result.reply).not.toContain("masanawa_learning_state");
    expect(upsert).toHaveBeenCalledTimes(1);
    const saved = upsert.mock.calls[0]![0];
    expect(saved.topic).toBe("Fractions");
    expect(saved.relationshipId).toBe(scope.relationshipId);
    expect(saved.updatedAt).toBe(toInstant("2026-10-07T12:00:00.000Z"));
  });
});
