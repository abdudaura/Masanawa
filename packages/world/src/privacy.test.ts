import { createCanonicalId } from "@masanawa/contracts";
import { describe, expect, it } from "vitest";
import {
  assertWorldPayloadHasNoPrivateReferences,
  assertWorldTextsHaveNoPrivateReferences,
} from "./privacy.js";

describe("World shared-state privacy", () => {
  it("allows canonical shared World and Character references", () => {
    expect(() =>
      assertWorldPayloadHasNoPrivateReferences({
        worldId: createCanonicalId("world"),
        characterId: createCanonicalId("character"),
        nested: {
          eventId: createCanonicalId("world-event"),
        },
      }),
    ).not.toThrow();
  });

  it("rejects private canonical IDs at any nested payload depth", () => {
    expect(() =>
      assertWorldPayloadHasNoPrivateReferences({
        nested: [
          {
            source: createCanonicalId("relationship"),
          },
        ],
      }),
    ).toThrowError(
      expect.objectContaining({ code: "world.private_reference_forbidden" }),
    );

    expect(() =>
      assertWorldPayloadHasNoPrivateReferences({
        memory: createCanonicalId("memory-record"),
      }),
    ).toThrowError(
      expect.objectContaining({ code: "world.private_reference_forbidden" }),
    );
  });

  it("rejects reserved private fields even when the value is not a canonical ID", () => {
    expect(() =>
      assertWorldPayloadHasNoPrivateReferences({
        relationshipId: "external-private-reference",
      }),
    ).toThrowError(
      expect.objectContaining({ code: "world.private_reference_forbidden" }),
    );
  });

  it("rejects private IDs from shared textual World projections", () => {
    expect(() =>
      assertWorldTextsHaveNoPrivateReferences({
        activeGoal: createCanonicalId("user"),
        storyArc: null,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "world.private_reference_forbidden" }),
    );
  });
});
