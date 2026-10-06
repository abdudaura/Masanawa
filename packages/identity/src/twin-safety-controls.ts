import type {
  CharacterId,
  Instant,
  TenantId,
  UserId,
} from "@masanawa/contracts";

export const twinReportReasons = [
  "harassment",
  "impersonation",
  "fraud",
  "privacy",
  "unsafe-content",
  "minor-safety",
  "other",
] as const;

export type TwinReportReason = (typeof twinReportReasons)[number];

export interface TwinViewerBlock {
  readonly tenantId: TenantId;
  readonly viewerUserId: UserId;
  readonly characterId: CharacterId;
  readonly blocked: boolean;
  readonly revision: number;
  readonly updatedAt: Instant;
}

export interface TwinViewerAccess {
  readonly discoverable: boolean;
  readonly interactable: boolean;
  readonly reason: "owner" | "available" | "hidden" | "viewer-blocked";
}

export interface TwinBlockCommand {
  readonly tenantId: TenantId;
  readonly viewerUserId: UserId;
  readonly characterId: CharacterId;
  readonly requestId: string;
  readonly blocked: boolean;
}

export interface TwinReportCommand {
  readonly tenantId: TenantId;
  readonly reporterUserId: UserId;
  readonly characterId: CharacterId;
  readonly requestId: string;
  readonly reason: TwinReportReason;
  readonly details: string | null;
}

const reasonSet = new Set<string>(twinReportReasons);

function boundedId(value: string, name: string): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (!/^[A-Za-z0-9._:-]{8,128}$/u.test(normalized)) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

export function normalizeTwinBlockCommand(
  input: TwinBlockCommand,
): TwinBlockCommand {
  if (typeof input.blocked !== "boolean") {
    throw new TypeError("blocked must be boolean");
  }
  return Object.freeze({
    tenantId: input.tenantId,
    viewerUserId: input.viewerUserId,
    characterId: input.characterId,
    requestId: boundedId(input.requestId, "requestId"),
    blocked: input.blocked,
  });
}

export function normalizeTwinReportCommand(
  input: TwinReportCommand,
): TwinReportCommand {
  if (!reasonSet.has(input.reason)) {
    throw new TypeError("report reason is invalid");
  }
  let details: string | null = null;
  if (input.details !== null) {
    if (typeof input.details !== "string") {
      throw new TypeError("report details must be a string or null");
    }
    const normalized = input.details.trim().replace(/\s+/gu, " ");
    if (normalized.length < 1 || normalized.length > 1000) {
      throw new RangeError("report details must be between 1 and 1000 characters");
    }
    details = normalized;
  }
  return Object.freeze({
    tenantId: input.tenantId,
    reporterUserId: input.reporterUserId,
    characterId: input.characterId,
    requestId: boundedId(input.requestId, "requestId"),
    reason: input.reason,
    details,
  });
}

export function projectTwinViewerAccess(input: {
  readonly profileDiscoverable: boolean;
  readonly isOwner: boolean;
  readonly block: TwinViewerBlock | null;
  readonly tenantId: TenantId;
  readonly viewerUserId: UserId;
  readonly characterId: CharacterId;
}): TwinViewerAccess {
  if (input.isOwner) {
    return Object.freeze({
      discoverable: true,
      interactable: true,
      reason: "owner",
    });
  }

  if (input.block) {
    if (
      input.block.tenantId !== input.tenantId ||
      input.block.viewerUserId !== input.viewerUserId ||
      input.block.characterId !== input.characterId
    ) {
      throw new Error("Twin block record is out of scope");
    }
    if (input.block.blocked) {
      return Object.freeze({
        discoverable: false,
        interactable: false,
        reason: "viewer-blocked",
      });
    }
  }

  if (!input.profileDiscoverable) {
    return Object.freeze({
      discoverable: false,
      interactable: false,
      reason: "hidden",
    });
  }

  return Object.freeze({
    discoverable: true,
    interactable: true,
    reason: "available",
  });
}
