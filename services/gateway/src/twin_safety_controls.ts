import type {
  CharacterId,
  TenantId,
  UserId,
} from "@masanawa/contracts";
import {
  normalizeTwinBlockCommand,
  normalizeTwinReportCommand,
  projectTwinViewerAccess,
  type TwinReportReason,
  type TwinViewerAccess,
  type TwinViewerBlock,
} from "@masanawa/identity";

export interface TwinSafetyAuthority {
  readonly tenantId: TenantId;
  readonly userId: UserId;
}

export interface TwinSafetyAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
    readonly capability:
      | "twin.safety.read"
      | "twin.safety.block"
      | "twin.safety.report";
  }): Promise<TwinSafetyAuthority>;
}

export interface TwinSafetyProfile {
  readonly tenantId: TenantId;
  readonly characterId: CharacterId;
  readonly ownerUserId: UserId;
  readonly discoverable: boolean;
}

export interface TwinBlockReceipt extends TwinViewerBlock {
  readonly requestId: string;
}

export interface TwinReportReceipt {
  readonly tenantId: TenantId;
  readonly reporterUserId: UserId;
  readonly characterId: CharacterId;
  readonly requestId: string;
  readonly reportId: string;
  readonly reason: TwinReportReason;
  readonly state: "received";
}

export interface TwinSafetyStore {
  readProfile(input: {
    readonly tenantId: TenantId;
    readonly characterId: CharacterId;
  }): Promise<TwinSafetyProfile | null>;
  readBlock(input: {
    readonly tenantId: TenantId;
    readonly viewerUserId: UserId;
    readonly characterId: CharacterId;
  }): Promise<TwinViewerBlock | null>;
  setBlock(input: ReturnType<typeof normalizeTwinBlockCommand>): Promise<TwinBlockReceipt>;
  createReport(input: ReturnType<typeof normalizeTwinReportCommand>): Promise<TwinReportReceipt>;
}

export interface TwinSafetyService {
  readAccess(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: CharacterId;
  }): Promise<TwinViewerAccess>;
  setBlocked(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: CharacterId;
    readonly requestId: string;
    readonly blocked: boolean;
  }): Promise<TwinBlockReceipt>;
  report(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: CharacterId;
    readonly requestId: string;
    readonly reason: TwinReportReason;
    readonly details: string | null;
  }): Promise<TwinReportReceipt>;
}

function assertProfile(
  profile: TwinSafetyProfile,
  tenantId: TenantId,
  characterId: CharacterId,
): void {
  if (profile.tenantId !== tenantId || profile.characterId !== characterId) {
    throw new Error("Twin safety store returned an out-of-scope profile");
  }
}

export function createTwinSafetyService(input: {
  readonly authorizer: TwinSafetyAuthorizer;
  readonly store: TwinSafetyStore;
}): TwinSafetyService {
  async function context(
    authorizationHeader: string | undefined,
    characterId: CharacterId,
    capability: "twin.safety.read" | "twin.safety.block" | "twin.safety.report",
  ): Promise<{ authority: TwinSafetyAuthority; profile: TwinSafetyProfile }> {
    const authority = await input.authorizer.authorize({
      authorizationHeader,
      capability,
    });
    const profile = await input.store.readProfile({
      tenantId: authority.tenantId,
      characterId,
    });
    if (!profile) throw new Error("Twin profile not found");
    assertProfile(profile, authority.tenantId, characterId);
    return { authority, profile };
  }

  return Object.freeze({
    async readAccess(request) {
      const { authority, profile } = await context(
        request.authorizationHeader,
        request.characterId,
        "twin.safety.read",
      );
      const block = await input.store.readBlock({
        tenantId: authority.tenantId,
        viewerUserId: authority.userId,
        characterId: request.characterId,
      });
      return projectTwinViewerAccess({
        profileDiscoverable: profile.discoverable,
        isOwner: profile.ownerUserId === authority.userId,
        block,
        tenantId: authority.tenantId,
        viewerUserId: authority.userId,
        characterId: request.characterId,
      });
    },

    async setBlocked(request) {
      const { authority, profile } = await context(
        request.authorizationHeader,
        request.characterId,
        "twin.safety.block",
      );
      if (profile.ownerUserId === authority.userId) {
        throw new Error("Owners cannot block their own Twin");
      }
      const command = normalizeTwinBlockCommand({
        tenantId: authority.tenantId,
        viewerUserId: authority.userId,
        characterId: request.characterId,
        requestId: request.requestId,
        blocked: request.blocked,
      });
      const receipt = await input.store.setBlock(command);
      if (
        receipt.tenantId !== command.tenantId ||
        receipt.viewerUserId !== command.viewerUserId ||
        receipt.characterId !== command.characterId ||
        receipt.requestId !== command.requestId ||
        receipt.blocked !== command.blocked
      ) {
        throw new Error("Twin block receipt does not match the admitted command");
      }
      return receipt;
    },

    async report(request) {
      const { authority, profile } = await context(
        request.authorizationHeader,
        request.characterId,
        "twin.safety.report",
      );
      if (profile.ownerUserId === authority.userId) {
        throw new Error("Owners cannot report their own Twin");
      }
      const command = normalizeTwinReportCommand({
        tenantId: authority.tenantId,
        reporterUserId: authority.userId,
        characterId: request.characterId,
        requestId: request.requestId,
        reason: request.reason,
        details: request.details,
      });
      const receipt = await input.store.createReport(command);
      if (
        receipt.tenantId !== command.tenantId ||
        receipt.reporterUserId !== command.reporterUserId ||
        receipt.characterId !== command.characterId ||
        receipt.requestId !== command.requestId ||
        receipt.reason !== command.reason ||
        receipt.state !== "received"
      ) {
        throw new Error("Twin report receipt does not match the admitted command");
      }
      return receipt;
    },
  });
}
