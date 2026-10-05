export type TwinReportReason =
  | "impersonation"
  | "fraud"
  | "harassment"
  | "sexual-content"
  | "hate"
  | "self-harm"
  | "spam"
  | "other";

export interface TwinSafetyAuthority {
  readonly tenantId: string;
  readonly userId: string;
}

export interface TwinSafetyAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
    readonly capability: "twin.block" | "twin.unblock" | "twin.report";
    readonly characterId: string;
  }): Promise<TwinSafetyAuthority>;
}

export interface TwinSafetyRepository {
  block(input: {
    readonly tenantId: string;
    readonly actorUserId: string;
    readonly characterId: string;
  }): Promise<{ readonly blocked: true }>;

  unblock(input: {
    readonly tenantId: string;
    readonly actorUserId: string;
    readonly characterId: string;
  }): Promise<{ readonly blocked: false }>;

  report(input: {
    readonly tenantId: string;
    readonly reporterUserId: string;
    readonly characterId: string;
    readonly reason: TwinReportReason;
    readonly detail: string | null;
  }): Promise<{ readonly reportId: string; readonly status: "submitted" }>;
}

export interface TwinSafetyService {
  block(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: string;
  }): Promise<{ readonly blocked: true }>;

  unblock(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: string;
  }): Promise<{ readonly blocked: false }>;

  report(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: string;
    readonly reason: TwinReportReason;
    readonly detail?: string | null;
  }): Promise<{ readonly reportId: string; readonly status: "submitted" }>;
}

function characterId(value: string): string {
  if (typeof value !== "string" || value.length < 8 || value.length > 180) {
    throw new TypeError("characterId is invalid");
  }
  return value;
}

function reason(value: string): TwinReportReason {
  if (
    value !== "impersonation" &&
    value !== "fraud" &&
    value !== "harassment" &&
    value !== "sexual-content" &&
    value !== "hate" &&
    value !== "self-harm" &&
    value !== "spam" &&
    value !== "other"
  ) {
    throw new TypeError("Unsupported report reason");
  }
  return value;
}

function detail(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value.trim().length === 0) return null;
  const normalized = value.trim();
  if (normalized.length > 1000) {
    throw new RangeError("Report detail is too long");
  }
  return normalized;
}

export function createTwinSafetyService(input: {
  readonly authorizer: TwinSafetyAuthorizer;
  readonly repository: TwinSafetyRepository;
}): TwinSafetyService {
  return Object.freeze({
    async block(request) {
      const id = characterId(request.characterId);
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "twin.block",
        characterId: id,
      });
      return input.repository.block({
        tenantId: authority.tenantId,
        actorUserId: authority.userId,
        characterId: id,
      });
    },

    async unblock(request) {
      const id = characterId(request.characterId);
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "twin.unblock",
        characterId: id,
      });
      return input.repository.unblock({
        tenantId: authority.tenantId,
        actorUserId: authority.userId,
        characterId: id,
      });
    },

    async report(request) {
      const id = characterId(request.characterId);
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "twin.report",
        characterId: id,
      });
      return input.repository.report({
        tenantId: authority.tenantId,
        reporterUserId: authority.userId,
        characterId: id,
        reason: reason(request.reason),
        detail: detail(request.detail),
      });
    },
  });
}
