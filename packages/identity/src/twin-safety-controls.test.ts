import { describe, expect, it } from "vitest";
import {
  normalizeTwinBlockCommand,
  normalizeTwinReportCommand,
  projectTwinViewerAccess,
  type TwinViewerBlock,
} from "./twin-safety-controls.js";

const tenantId = "tenant_00000000-0000-4000-8000-000000000001" as never;
const viewerUserId = "user_00000000-0000-4000-8000-000000000002" as never;
const characterId = "character_00000000-0000-4000-8000-000000000003" as never;

function block(overrides: Partial<TwinViewerBlock> = {}): TwinViewerBlock {
  return {
    tenantId,
    viewerUserId,
    characterId,
    blocked: true,
    revision: 1,
    updatedAt: "2026-10-06T10:00:00.000Z" as never,
    ...overrides,
  };
}

describe("Twin safety controls", () => {
  it("normalizes replay-safe block commands", () => {
    expect(normalizeTwinBlockCommand({
      tenantId,
      viewerUserId,
      characterId,
      requestId: " req:block:0001 ",
      blocked: true,
    })).toMatchObject({ requestId: "req:block:0001", blocked: true });
  });

  it("bounds reports and normalizes details", () => {
    expect(normalizeTwinReportCommand({
      tenantId,
      reporterUserId: viewerUserId,
      characterId,
      requestId: "req:report:0001",
      reason: "privacy",
      details: "  Shared   private information  ",
    })).toMatchObject({
      reason: "privacy",
      details: "Shared private information",
    });
  });

  it("makes an active viewer block override profile discoverability", () => {
    expect(projectTwinViewerAccess({
      profileDiscoverable: true,
      isOwner: false,
      block: block(),
      tenantId,
      viewerUserId,
      characterId,
    })).toEqual({
      discoverable: false,
      interactable: false,
      reason: "viewer-blocked",
    });
  });

  it("keeps hidden profiles unavailable to non-owners", () => {
    expect(projectTwinViewerAccess({
      profileDiscoverable: false,
      isOwner: false,
      block: null,
      tenantId,
      viewerUserId,
      characterId,
    }).interactable).toBe(false);
  });

  it("allows owners to access their own hidden profile", () => {
    expect(projectTwinViewerAccess({
      profileDiscoverable: false,
      isOwner: true,
      block: null,
      tenantId,
      viewerUserId,
      characterId,
    }).reason).toBe("owner");
  });

  it("rejects a forged/out-of-scope block record", () => {
    expect(() => projectTwinViewerAccess({
      profileDiscoverable: true,
      isOwner: false,
      block: block({
        viewerUserId: "user_00000000-0000-4000-8000-000000000999" as never,
      }),
      tenantId,
      viewerUserId,
      characterId,
    })).toThrow("out of scope");
  });
});
