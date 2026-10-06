import { describe, expect, it } from "vitest";
import { assertHttpsStoryUrl, assertStoryReaction } from "./index.js";

describe("Story Radio content invariants", () => {
  it("accepts only the bounded reaction vocabulary", () => {
    expect(assertStoryReaction("like")).toBe("like");
    expect(assertStoryReaction("thoughtful")).toBe("thoughtful");
    expect(() => assertStoryReaction("angry")).toThrow("story_radio.reaction.invalid");
  });

  it("requires HTTPS media", () => {
    expect(assertHttpsStoryUrl("https://media.example/story.mp3"))
      .toBe("https://media.example/story.mp3");
    expect(() => assertHttpsStoryUrl("http://media.example/story.mp3"))
      .toThrow("story_radio.url.https_required");
  });
});
