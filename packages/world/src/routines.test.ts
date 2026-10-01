import { createCanonicalId, toInstant } from "@masanawa/contracts";
import { describe, expect, it } from "vitest";
import {
  assertRoutineScheduledTime,
  routineLocalOccurrence,
  routineOccurrenceKey,
} from "./routines.js";

describe("world routines", () => {
  it("derives local date/time in the configured IANA timezone", () => {
    expect(
      routineLocalOccurrence(
        toInstant("2026-10-01T07:00:00Z"),
        "Africa/Lagos",
      ),
    ).toEqual({
      localDate: "2026-10-01",
      localTime: "08:00",
    });
  });

  it("rejects an occurrence scheduled for the wrong local slot", () => {
    expect(() =>
      assertRoutineScheduledTime(
        toInstant("2026-10-01T08:00:00Z"),
        "Africa/Lagos",
        "08:00",
      ),
    ).toThrow(/expected 08:00/u);
  });

  it("builds stable per-character per-date occurrence identity", () => {
    const characterId = createCanonicalId("character");
    expect(
      routineOccurrenceKey(characterId, "morning", "2026-10-01"),
    ).toBe(`routine:${characterId}:morning:2026-10-01`);
  });
});
