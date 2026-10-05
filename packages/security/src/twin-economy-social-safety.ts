export interface TwinSafetyRelationship {
  readonly viewerUserId: string;
  readonly ownerUserId: string;
  readonly viewerBlockedOwner: boolean;
  readonly ownerBlockedViewer: boolean;
  readonly ownerSuspended: boolean;
  readonly twinDiscoverable: boolean;
  readonly ownerAccessEnabled: boolean;
}

export interface TwinSafetyDecision {
  readonly canDiscover: boolean;
  readonly canChat: boolean;
  readonly canRequestOwner: boolean;
  readonly reason:
    | "allowed"
    | "blocked"
    | "owner-suspended"
    | "not-discoverable"
    | "owner-access-disabled";
}

export function evaluateTwinSafetyRelationship(
  input: TwinSafetyRelationship,
): TwinSafetyDecision {
  if (input.viewerBlockedOwner || input.ownerBlockedViewer) {
    return {
      canDiscover: false,
      canChat: false,
      canRequestOwner: false,
      reason: "blocked",
    };
  }
  if (input.ownerSuspended) {
    return {
      canDiscover: false,
      canChat: false,
      canRequestOwner: false,
      reason: "owner-suspended",
    };
  }
  if (!input.twinDiscoverable) {
    return {
      canDiscover: false,
      canChat: true,
      canRequestOwner: input.ownerAccessEnabled,
      reason: "not-discoverable",
    };
  }
  if (!input.ownerAccessEnabled) {
    return {
      canDiscover: true,
      canChat: true,
      canRequestOwner: false,
      reason: "owner-access-disabled",
    };
  }
  return {
    canDiscover: true,
    canChat: true,
    canRequestOwner: true,
    reason: "allowed",
  };
}

export type TwinReportReason =
  | "impersonation"
  | "fraud"
  | "harassment"
  | "sexual-content"
  | "hate"
  | "self-harm"
  | "spam"
  | "other";

export interface TwinReport {
  readonly reporterUserId: string;
  readonly characterId: string;
  readonly reason: TwinReportReason;
  readonly detail: string | null;
  readonly createdAt: string;
}

export function normalizeTwinReport(input: TwinReport): TwinReport {
  if (!input.reporterUserId || !input.characterId) {
    throw new TypeError("Report identity is required");
  }
  if (
    ![
      "impersonation",
      "fraud",
      "harassment",
      "sexual-content",
      "hate",
      "self-harm",
      "spam",
      "other",
    ].includes(input.reason)
  ) {
    throw new TypeError("Unsupported report reason");
  }
  if (input.detail !== null && input.detail.trim().length > 1000) {
    throw new RangeError("Report detail is too long");
  }
  const date = new Date(input.createdAt);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("createdAt is invalid");
  }
  return Object.freeze({
    reporterUserId: input.reporterUserId,
    characterId: input.characterId,
    reason: input.reason,
    detail:
      input.detail === null || input.detail.trim().length === 0
        ? null
        : input.detail.trim(),
    createdAt: date.toISOString(),
  });
}
